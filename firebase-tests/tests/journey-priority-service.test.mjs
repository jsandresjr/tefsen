import test from 'node:test';
import assert from 'node:assert/strict';

import { buildJourneyPriorityRow, buildJourneyPriorityWorkspace } from '../../app/js/services/journey-priority-service.js';

const now = new Date('2026-09-22T10:00:00Z');

function opportunity(overrides={}) {
  return {
    id:'opp-1',
    title:'Example Scholarship',
    deadline:'2026-10-20',
    ...overrides
  };
}

function journey(overrides={}) {
  return {
    opportunityId:'opp-1',
    started:true,
    saved:true,
    status:'preparing',
    personalTargetDate:'',
    checklist:[
      { id:'a', label:'Prepare transcript', completed:true },
      { id:'b', label:'Prepare recommendation letter', completed:false }
    ],
    updatedAtMillis:100,
    ...overrides
  };
}

test('deadline today becomes the highest attention state before submission', () => {
  const row=buildJourneyPriorityRow(journey(),opportunity({deadline:'2026-09-22'}),now);
  assert.equal(row.attention.key,'deadline_today');
  assert.equal(row.priority,0);
  assert.equal(row.officialDays,0);
});

test('missed personal target is urgent when official deadline is still ahead', () => {
  const row=buildJourneyPriorityRow(
    journey({personalTargetDate:'2026-09-20'}),
    opportunity({deadline:'2026-10-20'}),
    now
  );
  assert.equal(row.attention.key,'personal_overdue');
  assert.equal(row.personalDays,-2);
});

test('personal target after official deadline is called out explicitly', () => {
  const row=buildJourneyPriorityRow(
    journey({personalTargetDate:'2026-10-25'}),
    opportunity({deadline:'2026-10-20'}),
    now
  );
  assert.equal(row.targetAfterOfficial,true);
  assert.equal(row.attention.key,'target_after_official');
});

test('preparing state surfaces next unfinished checklist task', () => {
  const row=buildJourneyPriorityRow(journey(),opportunity(),now);
  assert.equal(row.progress.nextTask,'Prepare recommendation letter');
  assert.match(row.attention.title,/recommendation letter/i);
});

test('ready-to-apply state is explicit when no deadline urgency is closer', () => {
  const row=buildJourneyPriorityRow(
    journey({status:'ready_to_apply',checklist:[{id:'a',label:'Done',completed:true}]}),
    opportunity({deadline:'2026-12-20'}),
    now
  );
  assert.equal(row.attention.key,'ready_to_apply');
});

test('applied stage ignores a passed original application deadline', () => {
  const row=buildJourneyPriorityRow(
    journey({status:'applied'}),
    opportunity({deadline:'2026-09-10'}),
    now
  );
  assert.equal(row.preSubmission,false);
  assert.equal(row.officialDays,null);
  assert.equal(row.attention.key,'applied');
  assert.notEqual(row.attention.tone,'urgent');
});

test('interview stage ignores the original application deadline', () => {
  const row=buildJourneyPriorityRow(
    journey({status:'interview'}),
    opportunity({deadline:'2026-09-10'}),
    now
  );
  assert.equal(row.officialDays,null);
  assert.equal(row.attention.key,'interview');
});

test('accepted rejected and withdrawn are outcomes not active urgency rows', () => {
  const workspace=buildJourneyPriorityWorkspace([
    {journey:journey({opportunityId:'a',status:'accepted'}),opportunity:opportunity({id:'a'})},
    {journey:journey({opportunityId:'r',status:'rejected'}),opportunity:opportunity({id:'r'})},
    {journey:journey({opportunityId:'w',status:'withdrawn'}),opportunity:opportunity({id:'w'})}
  ],now);
  assert.equal(workspace.active.length,0);
  assert.equal(workspace.outcomes.length,3);
});

test('active workspace sorts deadline attention before ordinary preparation', () => {
  const workspace=buildJourneyPriorityWorkspace([
    {journey:journey({opportunityId:'normal'}),opportunity:opportunity({id:'normal',deadline:'2026-12-20'})},
    {journey:journey({opportunityId:'urgent'}),opportunity:opportunity({id:'urgent',deadline:'2026-09-24'})}
  ],now);
  assert.equal(workspace.primary.journey.opportunityId,'urgent');
  assert.equal(workspace.counts.needsAttention,1);
});

test('submitted rows are counted separately from preparation work', () => {
  const workspace=buildJourneyPriorityWorkspace([
    {journey:journey({opportunityId:'applied',status:'applied'}),opportunity:opportunity({id:'applied'})},
    {journey:journey({opportunityId:'interview',status:'interview'}),opportunity:opportunity({id:'interview'})},
    {journey:journey({opportunityId:'prep',status:'preparing'}),opportunity:opportunity({id:'prep'})}
  ],now);
  assert.equal(workspace.counts.submitted,2);
  assert.equal(workspace.counts.active,3);
});
