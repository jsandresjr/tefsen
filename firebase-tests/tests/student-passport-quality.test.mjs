import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('../app/js/services/student-passport-service.js', 'utf8');
const withoutImports = source.replace(/import[\s\S]*?from\s+['"][^'"]+['"];\s*/g, '');
const pureSection = withoutImports.slice(0, withoutImports.indexOf('function demoKey'));
const api = new Function(
  'const SCHEMA = { collections: {} };\n' +
  pureSection.replace(/\bexport\s+/g, '') +
  '; return { emptyStudentPassport, normalizeStudentPassport, studentPassportCompletionDetails, studentPassportCompleteness, validateStudentPassportInput };'
)();

function passport(overrides = {}) {
  return {
    ...api.emptyStudentPassport('student-1'),
    currentCountry:'Kenya',
    nationality:'Kenyan',
    currentEducationLevel:'Undergraduate',
    targetEducationLevel:'Master',
    mainField:'Computer Science',
    fundingPreference:'Fully funded only',
    ...overrides
  };
}

test('GPA above selected 4.0 scale is rejected', () => {
  const result = api.validateStudentPassportInput(passport({ gpa:4.7, gpaScale:4 }));
  assert.equal(result.valid, false);
  assert.match(result.errors[0].message, /higher than the selected 4\.0 scale/i);
});

test('same GPA is valid on a 5.0 scale', () => {
  const result = api.validateStudentPassportInput(passport({ gpa:4.7, gpaScale:5 }));
  assert.equal(result.valid, true);
});

test('normalization drops impossible GPA values instead of storing them', () => {
  const normalized = api.normalizeStudentPassport(passport({ gpa:4.7, gpaScale:4 }), 'student-1');
  assert.equal(normalized.gpa, null);
  assert.equal(normalized.gpaScale, 4);
});

test('missing essential fields warn but do not block partial save', () => {
  const result = api.validateStudentPassportInput(api.emptyStudentPassport('student-1'));
  assert.equal(result.valid, true);
  assert.equal(result.warnings.some(item => item.code === 'missing_essential'), true);
});

test('completion details separate essentials, academic profile, preferences and documents', () => {
  const details = api.studentPassportCompletionDetails(passport());
  assert.equal(details.sections.essential.complete, 6);
  assert.equal(details.sections.essential.total, 6);
  assert.equal(details.sections.academic.total, 3);
  assert.equal(details.sections.preferences.total, 4);
  assert.equal(details.sections.documents.total, 6);
});

test('document readiness contributes only a small part of overall completion', () => {
  const none = api.studentPassportCompletionDetails(passport());
  const all = api.studentPassportCompletionDetails(passport({
    documentsReady:{
      passport:true,
      transcript:true,
      englishCertificate:true,
      recommendationLetter:true,
      cv:true,
      personalStatement:true
    }
  }));
  assert.equal(all.percent - none.percent, 10);
});

test('global student examples do not require any default country', () => {
  for (const [country,nationality] of [
    ['Brazil','Brazilian'],
    ['Japan','Japanese'],
    ['Ghana','Ghanaian'],
    ['Canada','Canadian']
  ]) {
    const result = api.validateStudentPassportInput(passport({ currentCountry:country, nationality }));
    assert.equal(result.valid, true);
  }
});
