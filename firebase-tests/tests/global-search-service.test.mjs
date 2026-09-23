import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGlobalSearchModel } from '../../app/js/services/global-search-service.js';

const users=[
  {
    uid:'u1',
    fullName:'Amina Rahman',
    username:'amina.dev',
    bio:'Computer Science student interested in scholarships',
    role:'student',
    photoUrl:'https://example.test/a.jpg',
    verified:false,
    email:'private@example.test',
    subscriptionPlan:'Private Plan'
  },
  {
    uid:'u2',
    fullName:'Daniel Lee',
    username:'daniel.physics',
    bio:'Physics student',
    role:'student'
  }
];

const posts=[
  {
    id:'p1',
    status:'published',
    visibility:'public',
    postType:'discussion',
    title:'How should I prepare for Computer Science interviews?',
    content:'I am preparing for a scholarship interview.',
    subject:'Computer Science',
    communitySubject:'Computer Science',
    authorName:'Amina Rahman',
    tags:['scholarship','interview']
  },
  {
    id:'p2',
    status:'published',
    visibility:'public',
    postType:'success_story',
    title:'I received the Global Scholars Award',
    content:'My public student outcome.',
    subject:'Computer Science',
    communitySubject:'Computer Science',
    communityUniversity:'Global Tech University',
    communityIntake:'Fall 2027',
    authorName:'Amina Rahman',
    successData:{
      university:'Global Tech University',
      opportunityName:'Global Scholars Award',
      country:'Canada',
      subject:'Computer Science',
      intake:'Fall 2027'
    }
  },
  {
    id:'hidden',
    status:'hidden',
    visibility:'public',
    postType:'discussion',
    title:'Secret Computer Science note',
    content:'Must not appear.',
    subject:'Computer Science'
  },
  {
    id:'private',
    status:'published',
    visibility:'private',
    postType:'discussion',
    title:'Private scholarship note',
    content:'Must not appear.',
    subject:'Computer Science'
  }
];

const opportunities=[
  {
    id:'o1',
    status:'published',
    visibility:'public',
    title:'Global Scholars Award',
    provider:'Global Tech University',
    university:'Global Tech University',
    country:'Canada',
    intake:'Fall 2027',
    opportunityType:'Scholarship',
    fundingType:'Fully funded',
    subjects:['Computer Science'],
    studyLevels:['Undergraduate'],
    summary:'Scholarship for international Computer Science students.',
    verificationStatus:'verified',
    officialSourceUrl:'https://example.test/official'
  },
  {
    id:'o2',
    status:'published',
    visibility:'public',
    title:'Physics Research Fellowship',
    provider:'Science Institute',
    university:'Science Institute',
    country:'Germany',
    intake:'Spring 2028',
    opportunityType:'Fellowship',
    fundingType:'Partial funding',
    subjects:['Physics'],
    studyLevels:['Master'],
    summary:'Research fellowship in Physics.'
  },
  {
    id:'draft',
    status:'draft',
    visibility:'private',
    title:'Private Computer Science Draft',
    university:'Hidden University',
    subjects:['Computer Science']
  }
];

test('global search excludes hidden private posts and non-public opportunities',()=>{
  const model=buildGlobalSearchModel({term:'Computer Science',users,posts,opportunities});
  const communityIds=model.community.map(row=>row.id);
  const opportunityIds=model.opportunities.map(row=>row.id);
  assert.equal(communityIds.includes('hidden'),false);
  assert.equal(communityIds.includes('private'),false);
  assert.equal(opportunityIds.includes('draft'),false);
});

test('global search returns lightweight public person results only',()=>{
  const model=buildGlobalSearchModel({term:'Amina',users,posts,opportunities});
  assert.equal(model.people.length,1);
  const person=model.people[0];
  assert.equal(person.title,'Amina Rahman');
  assert.equal(person.route,'profile/u1');
  assert.equal('email' in person,false);
  assert.equal('subscriptionPlan' in person,false);
});

test('exact opportunity title match ranks above weaker metadata matches',()=>{
  const model=buildGlobalSearchModel({term:'Global Scholars Award',users,posts,opportunities});
  assert.equal(model.opportunities[0].id,'o1');
  assert.equal(model.opportunities[0].verified,true);
});

test('global search finds public discussion and success story surfaces',()=>{
  const model=buildGlobalSearchModel({term:'Computer Science',users,posts,opportunities});
  assert.equal(model.community.some(row=>row.id==='p1'),true);
  assert.equal(model.community.some(row=>row.id==='p2'),true);
  assert.equal(model.community.find(row=>row.id==='p2').kind,'success');
});

test('global search derives subject university and intake spaces from public data',()=>{
  const model=buildGlobalSearchModel({
    term:'Global Tech Fall 2027',
    users,
    posts,
    opportunities
  });
  assert.equal(model.universities.some(row=>row.title==='Global Tech University'),true);
  assert.equal(model.intakes.some(row=>row.title==='Fall 2027'),true);
});

test('subject search derives matching learning community',()=>{
  const model=buildGlobalSearchModel({term:'Computer Science',users,posts,opportunities});
  assert.equal(model.subjects.some(row=>row.title==='Computer Science'),true);
  assert.equal(model.subjects.find(row=>row.title==='Computer Science').route,'subject/Computer%20Science');
});

test('multiword search requires all query tokens somewhere in the result metadata',()=>{
  const model=buildGlobalSearchModel({term:'Physics Germany',users,posts,opportunities});
  assert.equal(model.opportunities.some(row=>row.id==='o2'),true);
  assert.equal(model.opportunities.some(row=>row.id==='o1'),false);
});

test('empty query returns discovery surfaces without pretending there are search matches',()=>{
  const model=buildGlobalSearchModel({term:'',users,posts,opportunities});
  assert.equal(model.query,'');
  assert.equal(model.counts.all,0);
  assert.equal(model.top.length,0);
  assert.equal(model.discover.subjects.length>0,true);
  assert.equal(model.discover.universities.length>0,true);
  assert.equal(model.discover.opportunities.length,2);
});

test('no matching query produces a deterministic empty result',()=>{
  const model=buildGlobalSearchModel({term:'zzzz-no-match',users,posts,opportunities});
  assert.equal(model.empty,true);
  assert.equal(model.counts.all,0);
  assert.deepEqual(model.top,[]);
});

test('search ranking disclaimer avoids recommendation or eligibility claims',()=>{
  const model=buildGlobalSearchModel({term:'Computer Science',users,posts,opportunities});
  assert.match(model.rankingNote,/deterministic text matching/i);
  assert.match(model.rankingNote,/not a quality, eligibility or recommendation score/i);
});
