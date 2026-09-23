import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPostAcceptanceModel,
  createDefaultPostAcceptancePlan,
  normalizePostAcceptancePlan,
  validatePostAcceptanceDraft
} from '../../app/js/services/post-acceptance-service.js';

const now = new Date('2026-09-23T10:00:00Z');

function journey(overrides={}) {
  return {
    status:'accepted',
    postAcceptance:null,
    ...overrides
  };
}

function opportunity(overrides={}) {
  return {
    title:'Example Scholarship',
    provider:'Example University',
    officialSourceUrl:'https://example.org/offer',
    ...overrides
  };
}

test('accepted Journey gets a separate default next-stage plan',()=>{
  const model=buildPostAcceptanceModel(journey(),opportunity(),now);
  assert.equal(model.active,true);
  assert.equal(model.plan.offerDecision,'reviewing');
  assert.equal(model.progress.total,6);
  assert.equal(model.tasks.next.id,'post_offer_review');
  assert.equal(model.safety.immigrationAdvice,false);
});

test('non-accepted Journey does not activate post-acceptance workflow',()=>{
  const model=buildPostAcceptanceModel(journey({status:'interview'}),opportunity(),now);
  assert.equal(model.active,false);
});

test('missing offer response date is surfaced without inventing a deadline',()=>{
  const model=buildPostAcceptanceModel(journey(),opportunity(),now);
  assert.equal(model.attention.key,'missing_response_date');

  const validation=validatePostAcceptanceDraft({
    offerDecision:'reviewing',
    offerResponseDate:'',
    enrollmentDate:''
  });
  assert.equal(validation.valid,true);
  assert.equal(validation.warnings.some(item=>item.code==='missing_response_date'),true);
});

test('stored offer response date today receives urgent attention',()=>{
  const plan=createDefaultPostAcceptancePlan();
  plan.offerResponseDate='2026-09-23';
  const model=buildPostAcceptanceModel(journey({postAcceptance:plan}),opportunity(),now);
  assert.equal(model.attention.key,'response_today');
  assert.equal(model.attention.tone,'urgent');
});

test('passed stored response date tells student to verify with provider',()=>{
  const plan=createDefaultPostAcceptancePlan();
  plan.offerResponseDate='2026-09-20';
  const model=buildPostAcceptanceModel(journey({postAcceptance:plan}),opportunity(),now);
  assert.equal(model.attention.key,'response_date_passed');
  assert.match(model.attention.detail,/official offer letter|provider portal/i);
});

test('offer accepted state switches focus to enrollment and official requirements',()=>{
  const plan=createDefaultPostAcceptancePlan();
  plan.offerDecision='accepted_offer';
  const model=buildPostAcceptanceModel(journey({postAcceptance:plan}),opportunity(),now);
  assert.equal(model.attention.key,'offer_accepted');
  assert.match(model.attention.detail,/not an admissions, legal or immigration authority/i);
});

test('declined offer remains a private accepted-journey record',()=>{
  const plan=createDefaultPostAcceptancePlan();
  plan.offerDecision='declined_offer';
  const model=buildPostAcceptanceModel(journey({postAcceptance:plan}),opportunity(),now);
  assert.equal(model.attention.key,'declined');
  assert.match(model.attention.detail,/private plan/i);
});

test('invalid calendar dates are rejected',()=>{
  const result=validatePostAcceptanceDraft({
    offerDecision:'reviewing',
    offerResponseDate:'2026-02-31'
  });
  assert.equal(result.valid,false);
  assert.match(result.errors[0].message,/valid offer-response date/i);
});

test('enrollment before response date is a verification warning, not an invented correction',()=>{
  const result=validatePostAcceptanceDraft({
    offerDecision:'intend_to_accept',
    offerResponseDate:'2026-10-20',
    enrollmentDate:'2026-10-10'
  });
  assert.equal(result.valid,true);
  assert.equal(result.warnings.some(item=>item.code==='date_order'),true);
});

test('normalization preserves custom and completed next-stage tasks',()=>{
  const normalized=normalizePostAcceptancePlan({
    offerDecision:'intend_to_accept',
    tasks:[
      {
        id:'custom-1',
        label:'Upload provider form',
        category:'enrollment',
        source:'custom',
        completed:true,
        createdAtMillis:10
      }
    ]
  });
  assert.equal(normalized.tasks.length,1);
  assert.equal(normalized.tasks[0].completed,true);
  assert.equal(normalized.tasks[0].source,'custom');
  assert.equal(normalized.offerDecision,'intend_to_accept');
});
