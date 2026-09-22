import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateEligibility } from '../../app/js/services/eligibility-engine.js';

function passport(overrides = {}) {
  return {
    nationality: 'Kenyan',
    targetEducationLevel: 'Master',
    mainField: 'Computer Science',
    gpa: 3.6,
    gpaScale: 4,
    englishTestStatus: 'IELTS completed',
    documentsReady: {
      passport: true,
      transcript: true,
      englishCertificate: true,
      recommendationLetter: false,
      cv: true,
      personalStatement: true
    },
    ...overrides
  };
}

function opportunity(overrides = {}) {
  return {
    eligibleNationalities: ['Kenyan'],
    studyLevels: ['Master'],
    subjects: ['Computer Science'],
    minGpa: 3.2,
    gpaScale: 4,
    languageRequirements: ['IELTS 6.5'],
    requiredDocuments: ['Passport', 'Transcript', 'CV'],
    ...overrides
  };
}

test('matching structured criteria does not become an admission guarantee', () => {
  const result = evaluateEligibility(passport(), opportunity());
  assert.equal(result.hasBlockingMismatch, false);
  assert.equal(result.counts.not_met, 0);
  assert.equal(result.counts.met >= 4, true);
  assert.equal(result.outcome.key, 'official_verification_needed');
  assert.match(result.disclaimer, /not an admission/i);
});

test('missing Student Passport fields produce action-needed guidance', () => {
  const result = evaluateEligibility(
    passport({ nationality:'', targetEducationLevel:'', mainField:'', gpa:null, englishTestStatus:'' }),
    opportunity()
  );
  assert.equal(result.outcome.key, 'action_needed');
  assert.equal(result.counts.action >= 5, true);
  assert.equal(result.nextActions.some(item => item.type === 'passport'), true);
});

test('structured nationality mismatch is explicit but requires official verification', () => {
  const result = evaluateEligibility(passport({ nationality:'Brazilian' }), opportunity({ eligibleNationalities:['Kenyan'] }));
  const check = result.checks.find(item => item.id === 'nationality');
  assert.equal(check.status, 'not_met');
  assert.equal(check.requiresOfficialSource, true);
  assert.equal(result.outcome.key, 'structured_mismatch');
  assert.equal(result.nextActions.some(item => item.type === 'official_source'), true);
});

test('different GPA scales stay unknown instead of being auto-converted', () => {
  const result = evaluateEligibility(passport({ gpa:4.4, gpaScale:5 }), opportunity({ minGpa:3.2, gpaScale:4 }));
  const check = result.checks.find(item => item.id === 'gpa');
  assert.equal(check.status, 'unknown');
  assert.match(check.message, /will not convert/i);
});

test('document readiness is preparation guidance, not a hard eligibility mismatch', () => {
  const result = evaluateEligibility(
    passport({ documentsReady:{ passport:true, transcript:false, englishCertificate:true, recommendationLetter:false, cv:true, personalStatement:true } }),
    opportunity({ requiredDocuments:['Passport','Transcript','CV'] })
  );
  const check = result.checks.find(item => item.id === 'documents');
  assert.equal(check.category, 'preparation');
  assert.equal(check.status, 'action');
  assert.equal(result.hasBlockingMismatch, false);
});

test('coverage reports comparable criteria and does not pretend unknowns are failures', () => {
  const result = evaluateEligibility(
    passport(),
    opportunity({
      minGpa:null,
      languageRequirements:[],
      requiredDocuments:[]
    })
  );
  assert.equal(result.coverage < 100, true);
  assert.equal(result.counts.unknown >= 3, true);
  assert.equal(result.compatibility, 100);
});

test('broad international nationality rules work for students from any country', () => {
  for (const nationality of ['Ghanaian','Japanese','Canadian','Egyptian']) {
    const result = evaluateEligibility(
      passport({ nationality }),
      opportunity({ eligibleNationalities:['All nationalities'] })
    );
    const check = result.checks.find(item => item.id === 'nationality');
    assert.equal(check.status, 'met');
  }
});
