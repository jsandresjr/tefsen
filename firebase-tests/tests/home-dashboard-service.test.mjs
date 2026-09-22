import test from 'node:test';
import assert from 'node:assert/strict';

import { buildHomeDashboardModel } from '../../app/js/services/home-dashboard-service.js';

const now = new Date('2026-09-22T10:00:00Z');

function passport(overrides = {}) {
  return {
    mainField:'Computer Science',
    targetEducationLevel:'Master',
    studyGoal:'',
    ...overrides
  };
}

function passportDetails(overrides = {}) {
  return {
    percent:80,
    sections:{
      essential:{
        complete:6,
        total:6,
        percent:100,
        missing:[]
      }
    },
    next:[],
    ...overrides
  };
}

function ranked(id='opp-1', score=82, overrides={}) {
  return {
    item:{
      id,
      title:`Opportunity ${id}`,
      deadline:'2026-11-10',
      ...overrides
    },
    profileScore:score,
    personalized:true
  };
}

function journey(opportunityId='opp-1', overrides={}) {
  return {
    opportunityId,
    saved:true,
    started:true,
    status:'preparing',
    checklist:[
      { id:'a', completed:true },
      { id:'b', completed:false }
    ],
    updatedAtMillis:100,
    ...overrides
  };
}

test('urgent deadline outranks all other actions', () => {
  const model = buildHomeDashboardModel({
    passport:passport(),
    passportDetails:passportDetails(),
    rankedOpportunities:[ranked('opp-1',90,{ deadline:'2026-09-25' })],
    journeys:[journey('opp-1')],
    now
  });
  assert.equal(model.state,'deadline');
  assert.match(model.action.title,/3 days/i);
  assert.equal(model.action.route,'journey/opp-1');
});

test('accepted Journey outranks ordinary active work', () => {
  const model = buildHomeDashboardModel({
    passport:passport(),
    passportDetails:passportDetails(),
    rankedOpportunities:[ranked('accepted',80,{ deadline:'2026-09-24' }), ranked('active')],
    journeys:[
      journey('active',{ status:'preparing', updatedAtMillis:200 }),
      journey('accepted',{ status:'accepted', updatedAtMillis:100 })
    ],
    now
  });
  assert.equal(model.state,'accepted');
  assert.equal(model.action.route,'journey/accepted');
});

test('active Journey outranks incomplete non-essential Passport fields', () => {
  const model = buildHomeDashboardModel({
    passport:passport(),
    passportDetails:passportDetails({ percent:65 }),
    rankedOpportunities:[ranked('opp-1')],
    journeys:[journey('opp-1')],
    now
  });
  assert.equal(model.state,'journey');
  assert.match(model.action.detail,/1\/2 preparation tasks/i);
});

test('missing essential Passport fields are prioritized before discovery', () => {
  const model = buildHomeDashboardModel({
    passport:passport({ mainField:'', targetEducationLevel:'' }),
    passportDetails:passportDetails({
      percent:20,
      sections:{
        essential:{
          complete:2,
          total:6,
          percent:33,
          missing:[
            { field:'mainField', label:'Main field / subject' },
            { field:'fundingPreference', label:'Funding preference' }
          ]
        }
      }
    }),
    rankedOpportunities:[ranked('opp-1',0)],
    journeys:[],
    now
  });
  assert.equal(model.state,'getting_started');
  assert.equal(model.action.route,'passport');
  assert.match(model.action.detail,/Main field/i);
});

test('saved but not-started opportunity routes back to opportunity review', () => {
  const model = buildHomeDashboardModel({
    passport:passport(),
    passportDetails:passportDetails(),
    rankedOpportunities:[ranked('opp-1',70)],
    journeys:[journey('opp-1',{ started:false, checklist:[] })],
    now
  });
  assert.equal(model.state,'saved');
  assert.equal(model.action.route,'opportunity/opp-1');
});

test('profile match is used when there is no more urgent personal action', () => {
  const model = buildHomeDashboardModel({
    passport:passport(),
    passportDetails:passportDetails(),
    rankedOpportunities:[ranked('a',67), ranked('b',91)],
    journeys:[],
    now
  });
  assert.equal(model.state,'match');
  assert.equal(model.topMatch.item.id,'b');
  assert.match(model.action.detail,/91% profile match/i);
});

test('brand-new student gets a getting-started state', () => {
  const model = buildHomeDashboardModel({
    passport:{},
    passportDetails:{
      percent:0,
      sections:{ essential:{ complete:0,total:6,percent:0,missing:[{field:'currentCountry',label:'Current country'}] } },
      next:[{ field:'currentCountry', label:'Current country', priority:'essential' }]
    },
    rankedOpportunities:[],
    journeys:[],
    now
  });
  assert.equal(model.newUser,true);
  assert.equal(model.state,'getting_started');
});

test('empty but complete profile falls back to global discovery', () => {
  const model = buildHomeDashboardModel({
    passport:passport(),
    passportDetails:passportDetails(),
    rankedOpportunities:[],
    journeys:[],
    now
  });
  assert.equal(model.state,'discovery');
  assert.equal(model.action.route,'opportunities');
});
