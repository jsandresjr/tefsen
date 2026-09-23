import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSubjectCommunityModel } from '../../app/js/services/community-service.js';

const posts=[
  {
    id:'d1',
    status:'published',
    visibility:'public',
    subject:'Computer Science',
    title:'How does recursion work?',
    commentCount:4,
    saveCount:2,
    likeCount:5
  },
  {
    id:'d2',
    status:'published',
    visibility:'public',
    communitySubject:'Computer Science',
    title:'How should I debug recursive code?',
    commentCount:0,
    saveCount:3,
    likeCount:2
  },
  {
    id:'success',
    status:'published',
    visibility:'public',
    postType:'success_story',
    successData:{subject:'Computer Science',university:'Global Tech University'},
    title:'My CS scholarship result',
    commentCount:1,
    saveCount:2,
    likeCount:7
  },
  {
    id:'journey',
    status:'published',
    visibility:'public',
    postType:'journey_story',
    communitySubject:'Computer Science',
    title:'My application journey',
    commentCount:2,
    saveCount:1,
    likeCount:3
  },
  {
    id:'hidden',
    status:'hidden',
    visibility:'public',
    subject:'Computer Science',
    title:'Hidden record',
    commentCount:99,
    saveCount:99,
    likeCount:99
  },
  {
    id:'private',
    status:'published',
    visibility:'private',
    subject:'Computer Science',
    title:'Private record',
    commentCount:99,
    saveCount:99,
    likeCount:99
  },
  {
    id:'physics',
    status:'published',
    visibility:'public',
    subject:'Physics',
    title:'Different subject',
    commentCount:5
  }
];

const opportunities=[
  {
    id:'o1',
    title:'Global CS Scholarship',
    subjects:['Computer Science','Data Science'],
    university:'Global Tech University',
    country:'Canada',
    fundingType:'Fully funded'
  },
  {
    id:'o2',
    title:'Software Engineering Award',
    subjects:['Computer Science'],
    university:'Future University',
    country:'Germany',
    fundingType:'Partial funding'
  },
  {
    id:'o3',
    title:'Physics Fellowship',
    subjects:['Physics'],
    university:'Science Institute',
    country:'Japan',
    fundingType:'Fully funded'
  }
];

test('subject model excludes hidden, private and unrelated posts',()=>{
  const model=buildSubjectCommunityModel('Computer Science',posts,opportunities);
  const ids=[...model.discussions,...model.outcomes].map(row=>row.id);
  assert.equal(ids.includes('hidden'),false);
  assert.equal(ids.includes('private'),false);
  assert.equal(ids.includes('physics'),false);
});

test('subject model separates discussions from outcomes',()=>{
  const model=buildSubjectCommunityModel('Computer Science',posts,opportunities);
  assert.deepEqual(model.discussions.map(row=>row.id),['d1','d2']);
  assert.deepEqual(new Set(model.outcomes.map(row=>row.id)),new Set(['success','journey']));
});

test('subject model finds unanswered public discussions',()=>{
  const model=buildSubjectCommunityModel('Computer Science',posts,opportunities);
  assert.deepEqual(model.unanswered.map(row=>row.id),['d2']);
  assert.equal(model.counts.unanswered,1);
});

test('subject model links only matching opportunities',()=>{
  const model=buildSubjectCommunityModel('Computer Science',posts,opportunities);
  assert.deepEqual(model.opportunities.map(row=>row.id),['o1','o2']);
  assert.equal(model.counts.opportunities,2);
});

test('subject model derives unique universities destinations and funding context',()=>{
  const model=buildSubjectCommunityModel('Computer Science',posts,opportunities);
  assert.deepEqual(model.universities,['Global Tech University','Future University']);
  assert.deepEqual(model.destinations,['Canada','Germany']);
  assert.deepEqual(model.fundingTypes,['Fully funded','Partial funding']);
});

test('subject model keeps source and ranking disclaimers explicit',()=>{
  const model=buildSubjectCommunityModel('Computer Science',posts,opportunities);
  assert.match(model.rankingNote,/not a quality or accuracy score/i);
  assert.match(model.sourceNote,/official provider sources remain authoritative/i);
});

test('subject model is deterministic for a subject with no data',()=>{
  const model=buildSubjectCommunityModel('Astronomy',posts,opportunities);
  assert.equal(model.name,'Astronomy');
  assert.equal(model.empty,true);
  assert.deepEqual(model.discussions,[]);
  assert.deepEqual(model.outcomes,[]);
  assert.deepEqual(model.opportunities,[]);
});
