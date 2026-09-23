import test from 'node:test';
import assert from 'node:assert/strict';

import { buildJourneyDetailModel, validateJourneyPlanningDraft } from '../../app/js/services/journey-detail-service.js';

const now=new Date('2026-09-22T10:00:00Z');

function opportunity(overrides={}) {
  return {
    id:'opp-1',
    title:'Example Scholarship',
    provider:'Example University',
    deadline:'2026-10-20',
    officialSourceUrl:'https://example.org/opportunity',
    ...overrides
  };
}

function journey(overrides={}) {
  return {
    opportunityId:'opp-1',
    status:'preparing',
    personalTargetDate:'2026-10-10',
    notes:'',
    checklist:[
      {id:'a',label:'Prepare transcript',source:'system',completed:true},
      {id:'b',label:'Prepare recommendation',source:'system',completed:false},
      {id:'c',label:'Draft motivation letter',source:'custom',completed:false}
    ],
    history:[
      {status:'interested',atMillis:1},
      {status:'preparing',atMillis:2}
    ],
    ...overrides
  };
}

test('detail model groups checklist and identifies next unfinished task',()=>{
  const model=buildJourneyDetailModel(journey(),opportunity(),now);
  assert.equal(model.progress.completed,1);
  assert.equal(model.progress.total,3);
  assert.equal(model.progress.remaining,2);
  assert.equal(model.tasks.incomplete.length,2);
  assert.equal(model.tasks.completed.length,1);
  assert.equal(model.tasks.next.label,'Prepare recommendation');
});

test('pre-submission stages show target planning and deadline urgency',()=>{
  const model=buildJourneyDetailModel(journey({status:'preparing'}),opportunity(),now);
  assert.equal(model.preSubmission,true);
  assert.equal(model.planning.showTarget,true);
  assert.equal(model.planning.showDeadlineUrgency,true);
});

test('applied stage hides preparation-target editing context',()=>{
  const model=buildJourneyDetailModel(journey({status:'applied'}),opportunity({deadline:'2026-09-10'}),now);
  assert.equal(model.preSubmission,false);
  assert.equal(model.planning.showTarget,false);
  assert.equal(model.priority.officialDays,null);
  assert.match(model.guidance.title,/provider response/i);
});

test('interview stage focuses on review preparation instead of old deadline',()=>{
  const model=buildJourneyDetailModel(journey({status:'interview'}),opportunity({deadline:'2026-09-10'}),now);
  assert.equal(model.priority.officialDays,null);
  assert.equal(model.guidance.tone,'review');
  assert.match(model.guidance.detail,/original application deadline/i);
});

test('accepted stage keeps official-guidance disclaimer',()=>{
  const model=buildJourneyDetailModel(journey({status:'accepted'}),opportunity(),now);
  assert.equal(model.terminal,true);
  assert.equal(model.guidance.tone,'accepted');
  assert.match(model.guidance.detail,/does not replace official visa, legal or admissions guidance/i);
});

test('planning target after official deadline is invalid before submission',()=>{
  const result=validateJourneyPlanningDraft({
    status:'preparing',
    personalTargetDate:'2026-10-25',
    officialDeadline:'2026-10-20',
    notes:''
  });
  assert.equal(result.valid,false);
  assert.match(result.errors[0].message,/on or before/i);
});

test('planning target on official deadline is allowed',()=>{
  const result=validateJourneyPlanningDraft({
    status:'preparing',
    personalTargetDate:'2026-10-20',
    officialDeadline:'2026-10-20'
  });
  assert.equal(result.valid,true);
});

test('missing personal target is a warning not a save blocker',()=>{
  const result=validateJourneyPlanningDraft({
    status:'preparing',
    personalTargetDate:'',
    officialDeadline:'2026-10-20'
  });
  assert.equal(result.valid,true);
  assert.equal(result.warnings.some(item=>item.code==='no_personal_target'),true);
});

test('historical target after submission is preserved as warning context',()=>{
  const result=validateJourneyPlanningDraft({
    status:'applied',
    personalTargetDate:'2026-10-25',
    officialDeadline:'2026-10-20'
  });
  assert.equal(result.valid,true);
  assert.equal(result.warnings.some(item=>item.code==='historical_target'),true);
});

test('notes remain editable across terminal outcome stage',()=>{
  const model=buildJourneyDetailModel(journey({status:'rejected'}),opportunity(),now);
  assert.equal(model.planning.notesEditable,true);
  assert.equal(model.terminal,true);
});

test('detail guidance exposes a passed stored deadline before submission',()=>{
  const model=buildJourneyDetailModel(
    journey({status:'preparing',personalTargetDate:''}),
    opportunity({deadline:'2026-09-20'}),
    now
  );
  assert.equal(model.priority.attention.key,'deadline_expired');
  assert.match(model.guidance.detail,/official provider source/i);
});
