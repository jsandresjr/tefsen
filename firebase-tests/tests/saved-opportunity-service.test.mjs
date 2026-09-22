import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSavedOpportunityWorkspace, buildSavedComparison, savedDeadlineState } from '../../app/js/services/saved-opportunity-service.js';

const now = new Date('2026-09-22T10:00:00Z');

function opportunity(id, overrides = {}) {
  return {
    id,
    title:`Opportunity ${id}`,
    provider:`Provider ${id}`,
    fundingType:'Fully funded',
    country:'Germany',
    studyLevels:['Master'],
    deadline:'2026-11-10',
    verificationStatus:'verified',
    officialSourceUrl:'https://example.org',
    ...overrides
  };
}

function journey(id, overrides = {}) {
  return {
    opportunityId:id,
    saved:true,
    started:false,
    status:'interested',
    notes:'',
    updatedAtMillis:100,
    ...overrides
  };
}

test('saved-not-started, active and completed are separated', () => {
  const workspace = buildSavedOpportunityWorkspace({
    opportunities:[opportunity('saved'), opportunity('active'), opportunity('done')],
    journeys:[
      journey('saved'),
      journey('active',{ started:true,status:'preparing' }),
      journey('done',{ started:true,status:'accepted' })
    ],
    now
  });
  assert.equal(workspace.savedReview.length,1);
  assert.equal(workspace.active.length,1);
  assert.equal(workspace.completed.length,1);
});

test('active Journey is not duplicated in saved review even when saved remains true', () => {
  const workspace = buildSavedOpportunityWorkspace({
    opportunities:[opportunity('a')],
    journeys:[journey('a',{ started:true,saved:true,status:'preparing' })],
    now
  });
  assert.equal(workspace.savedReview.length,0);
  assert.equal(workspace.active.length,1);
});

test('closing deadlines sort before future and expired saved opportunities', () => {
  const workspace = buildSavedOpportunityWorkspace({
    opportunities:[
      opportunity('future',{ deadline:'2026-12-20' }),
      opportunity('expired',{ deadline:'2026-09-10' }),
      opportunity('soon',{ deadline:'2026-09-29' })
    ],
    journeys:[journey('future'),journey('expired'),journey('soon')],
    now
  });
  assert.deepEqual(workspace.savedReview.map(row => row.journey.opportunityId),['soon','future','expired']);
  assert.equal(workspace.counts.closingSaved,1);
  assert.equal(workspace.counts.expiredSaved,1);
});

test('saved opportunities without a date remain visible', () => {
  const workspace = buildSavedOpportunityWorkspace({
    opportunities:[opportunity('undated',{ deadline:'' })],
    journeys:[journey('undated')],
    now
  });
  assert.equal(workspace.savedReview.length,1);
  assert.equal(workspace.savedReview[0].deadline.state,'unknown');
});

test('private decision notes are counted without changing saved state', () => {
  const workspace = buildSavedOpportunityWorkspace({
    opportunities:[opportunity('note')],
    journeys:[journey('note',{ notes:'Check programme modules and funding details.' })],
    now
  });
  assert.equal(workspace.counts.withNotes,1);
  assert.equal(workspace.savedReview[0].journey.saved,true);
  assert.equal(workspace.savedReview[0].journey.started,false);
});

test('comparison returns no more than three selected opportunities', () => {
  const rows=['a','b','c','d'].map((id,index) => ({
    opportunity:opportunity(id,{country:index % 2 ? 'Japan' : 'Canada'}),
    journey:journey(id),
    profileScore:80-index
  }));
  const comparison=buildSavedComparison(rows);
  assert.equal(comparison.length,3);
  assert.deepEqual(comparison.map(row=>row.id),['a','b','c']);
});

test('expired deadline remains classified rather than disappearing', () => {
  const deadline=savedDeadlineState('2026-09-20',now);
  assert.equal(deadline.state,'expired');
  assert.equal(deadline.days,-2);
});
