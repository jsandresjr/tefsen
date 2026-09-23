import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildNotificationCenterModel,
  normalizeActivityNotification
} from '../../app/js/services/notification-service.js';

const now=new Date('2027-01-10T10:00:00Z');

const opportunities=[
  {
    id:'opp-soon',
    title:'Global Scholarship',
    deadline:'2027-01-12',
    status:'published',
    visibility:'public'
  },
  {
    id:'opp-later',
    title:'Future Fellowship',
    deadline:'2027-02-20',
    status:'published',
    visibility:'public'
  },
  {
    id:'opp-accepted',
    title:'Accepted Program',
    deadline:'2026-12-01',
    status:'published',
    visibility:'public'
  }
];

test('saved opportunity creates a real approaching-deadline alert',()=>{
  const model=buildNotificationCenterModel({
    opportunities,
    journeys:[{
      opportunityId:'opp-soon',
      saved:true,
      started:false,
      status:'interested'
    }],
    now
  });
  assert.equal(model.items.length,1);
  const item=model.items[0];
  assert.equal(item.type,'deadline');
  assert.equal(item.priority,'critical');
  assert.equal(item.route,'opportunity/opp-soon');
  assert.equal(item.dueDays,2);
});

test('started Journey can create official deadline and personal target alerts',()=>{
  const model=buildNotificationCenterModel({
    opportunities,
    journeys:[{
      opportunityId:'opp-soon',
      saved:true,
      started:true,
      status:'preparing',
      personalTargetDate:'2027-01-11',
      checklist:[
        {id:'t1',label:'Prepare transcript',completed:false}
      ],
      updatedAtMillis:123
    }],
    now
  });
  assert.equal(model.items.some(item=>item.id.startsWith('deadline:opp-soon')),true);
  assert.equal(model.items.some(item=>item.id.startsWith('target:opp-soon')),true);
  assert.equal(model.items.some(item=>item.id==='next-task:opp-soon'),false);
});

test('non-urgent Journey exposes a useful next unfinished task',()=>{
  const model=buildNotificationCenterModel({
    opportunities,
    journeys:[{
      opportunityId:'opp-later',
      saved:true,
      started:true,
      status:'preparing',
      personalTargetDate:'2027-02-01',
      checklist:[
        {id:'t1',label:'Review official document requirements',completed:false},
        {id:'t2',label:'Draft essay',completed:false}
      ],
      updatedAtMillis:999
    }],
    now
  });
  const next=model.items.find(item=>item.id==='next-task:opp-later');
  assert.ok(next);
  assert.equal(next.category,'planning');
  assert.match(next.message,/official document requirements/i);
});

test('ready-to-apply Journey produces a verification reminder',()=>{
  const model=buildNotificationCenterModel({
    opportunities,
    journeys:[{
      opportunityId:'opp-later',
      saved:true,
      started:true,
      status:'ready_to_apply',
      checklist:[]
    }],
    now
  });
  const item=model.items.find(row=>row.id==='ready:opp-later');
  assert.ok(item);
  assert.match(item.message,/official requirements/i);
});

test('accepted Journey creates offer-response and enrollment alerts from private planning dates',()=>{
  const model=buildNotificationCenterModel({
    opportunities,
    journeys:[{
      opportunityId:'opp-accepted',
      saved:true,
      started:true,
      status:'accepted',
      postAcceptance:{
        offerDecision:'reviewing',
        offerResponseDate:'2027-01-11',
        enrollmentDate:'2027-01-20',
        tasks:[{id:'a',label:'Review offer letter',completed:false}]
      }
    }],
    now
  });
  assert.equal(model.items.some(item=>item.id.startsWith('offer-response:opp-accepted')),true);
  assert.equal(model.items.some(item=>item.id.startsWith('enrollment:opp-accepted')),true);
  assert.equal(model.items.some(item=>item.id==='accepted-next:opp-accepted'),false);
});

test('declined offer does not create enrollment reminders',()=>{
  const model=buildNotificationCenterModel({
    opportunities,
    journeys:[{
      opportunityId:'opp-accepted',
      saved:true,
      started:true,
      status:'accepted',
      postAcceptance:{
        offerDecision:'declined_offer',
        offerResponseDate:'2027-01-11',
        enrollmentDate:'2027-01-20',
        tasks:[{id:'a',label:'Review offer letter',completed:false}]
      }
    }],
    now
  });
  assert.equal(model.items.some(item=>item.id.startsWith('offer-response:opp-accepted')),false);
  assert.equal(model.items.some(item=>item.id.startsWith('enrollment:opp-accepted')),false);
});

test('final non-accepted Journey does not keep producing old application deadline alerts',()=>{
  const model=buildNotificationCenterModel({
    opportunities,
    journeys:[{
      opportunityId:'opp-soon',
      saved:true,
      started:true,
      status:'rejected',
      checklist:[]
    }],
    now
  });
  assert.equal(model.items.some(item=>item.type==='deadline'),false);
});

test('activity notification is normalized to a safe known route',()=>{
  const item=normalizeActivityNotification({
    id:'n1',
    type:'answer',
    actorName:'Student Two',
    message:'replied to your question',
    postId:'post-123',
    createdAt:'2027-01-10T09:00:00Z',
    arbitraryRoute:'https://evil.example'
  });
  assert.equal(item.route,'post/post-123');
  assert.equal(item.type,'reply');
  assert.equal('arbitraryRoute' in item,false);
});

test('read IDs keep derived alerts acknowledged across rebuilds',()=>{
  const first=buildNotificationCenterModel({
    opportunities,
    journeys:[{
      opportunityId:'opp-soon',
      saved:true,
      started:false,
      status:'interested'
    }],
    now
  });
  const id=first.items[0].id;
  const second=buildNotificationCenterModel({
    opportunities,
    journeys:[{
      opportunityId:'opp-soon',
      saved:true,
      started:false,
      status:'interested'
    }],
    readIds:new Set([id]),
    now
  });
  assert.equal(second.items[0].read,true);
  assert.equal(second.unreadCount,0);
});

test('attention alerts sort ahead of lower-priority Community activity',()=>{
  const model=buildNotificationCenterModel({
    opportunities,
    journeys:[{
      opportunityId:'opp-soon',
      saved:true,
      started:false,
      status:'interested'
    }],
    activityNotifications:[{
      id:'n2',
      type:'like',
      message:'Someone liked your post',
      createdAt:'2027-01-10T09:59:00Z'
    }],
    now
  });
  assert.equal(model.items[0].category,'attention');
  assert.equal(model.items[1].category,'activity');
});

test('source note keeps official-source trust boundary explicit',()=>{
  const model=buildNotificationCenterModel({now});
  assert.match(model.sourceNote,/verify official deadlines and requirements/i);
});
