import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildIntakeCommunityModel,
  buildUniversityCommunityModel
} from '../../app/js/services/community-service.js';

const posts=[
  {
    id:'u-discussion',
    status:'published',
    visibility:'public',
    communityUniversity:'Global Tech University',
    communityIntake:'Fall 2027',
    communitySubject:'Computer Science',
    title:'How should I prepare for orientation?',
    commentCount:3,
    saveCount:2,
    likeCount:5
  },
  {
    id:'u-unanswered',
    status:'published',
    visibility:'public',
    communityUniversity:'Global Tech University',
    communityIntake:'Fall 2027',
    communitySubject:'Data Science',
    title:'When should I arrange housing?',
    commentCount:0,
    saveCount:4,
    likeCount:2
  },
  {
    id:'u-other-intake',
    status:'published',
    visibility:'public',
    communityUniversity:'Global Tech University',
    communityIntake:'Spring 2028',
    communitySubject:'Computer Science',
    title:'Spring discussion',
    commentCount:2
  },
  {
    id:'u-success',
    status:'published',
    visibility:'public',
    postType:'success_story',
    successData:{
      university:'Global Tech University',
      intake:'Fall 2027',
      subject:'Computer Science',
      country:'Canada'
    },
    title:'My admission result',
    commentCount:1,
    saveCount:2,
    likeCount:7
  },
  {
    id:'u-hidden',
    status:'hidden',
    visibility:'public',
    communityUniversity:'Global Tech University',
    communityIntake:'Fall 2027',
    title:'Hidden',
    commentCount:99
  },
  {
    id:'u-private',
    status:'published',
    visibility:'private',
    communityUniversity:'Global Tech University',
    communityIntake:'Fall 2027',
    title:'Private',
    commentCount:99
  },
  {
    id:'other-university',
    status:'published',
    visibility:'public',
    communityUniversity:'Science Institute',
    communityIntake:'Fall 2027',
    title:'Different university',
    commentCount:5
  }
];

const opportunities=[
  {
    id:'exact-fall',
    title:'Fall CS Scholarship',
    university:'Global Tech University',
    intake:'Fall 2027',
    country:'Canada',
    fundingType:'Fully funded',
    subjects:['Computer Science']
  },
  {
    id:'exact-fall-2',
    title:'Fall Data Science Award',
    university:'Global Tech University',
    intake:'Fall 2027',
    country:'Canada',
    fundingType:'Partial funding',
    subjects:['Data Science']
  },
  {
    id:'spring',
    title:'Spring Engineering Award',
    university:'Global Tech University',
    intake:'Spring 2028',
    country:'Canada',
    fundingType:'Partial funding',
    subjects:['Engineering']
  },
  {
    id:'general',
    title:'University-wide Merit Award',
    university:'Global Tech University',
    intake:'',
    country:'Canada',
    fundingType:'Merit award',
    subjects:['Computer Science','Engineering']
  },
  {
    id:'other',
    title:'Physics Fellowship',
    university:'Science Institute',
    intake:'Fall 2027',
    country:'Germany',
    fundingType:'Fully funded',
    subjects:['Physics']
  }
];

test('university model excludes hidden private and unrelated posts',()=>{
  const model=buildUniversityCommunityModel('Global Tech University',posts,opportunities);
  const ids=[...model.discussions,...model.outcomes].map(row=>row.id);
  assert.equal(ids.includes('u-hidden'),false);
  assert.equal(ids.includes('u-private'),false);
  assert.equal(ids.includes('other-university'),false);
});

test('university model separates discussions outcomes and unanswered questions',()=>{
  const model=buildUniversityCommunityModel('Global Tech University',posts,opportunities);
  assert.deepEqual(new Set(model.discussions.map(row=>row.id)),new Set(['u-discussion','u-unanswered','u-other-intake']));
  assert.deepEqual(model.outcomes.map(row=>row.id),['u-success']);
  assert.deepEqual(model.unanswered.map(row=>row.id),['u-unanswered']);
});

test('university model links only that university opportunities',()=>{
  const model=buildUniversityCommunityModel('Global Tech University',posts,opportunities);
  assert.deepEqual(new Set(model.opportunities.map(row=>row.id)),new Set(['exact-fall','exact-fall-2','spring','general']));
  assert.equal(model.opportunities.some(row=>row.id==='other'),false);
});

test('university model builds intake summaries from public posts and exact opportunity labels',()=>{
  const model=buildUniversityCommunityModel('Global Tech University',posts,opportunities);
  const fall=model.intakeSummaries.find(row=>row.name==='Fall 2027');
  const spring=model.intakeSummaries.find(row=>row.name==='Spring 2028');
  assert.ok(fall);
  assert.equal(fall.discussionCount,2);
  assert.equal(fall.outcomeCount,1);
  assert.equal(fall.opportunityCount,2);
  assert.ok(spring);
  assert.equal(spring.discussionCount,1);
  assert.equal(spring.opportunityCount,1);
});

test('university model derives public discovery context without a default country',()=>{
  const model=buildUniversityCommunityModel('Global Tech University',posts,opportunities);
  assert.deepEqual(model.countries,['Canada']);
  assert.equal(model.subjects.includes('Computer Science'),true);
  assert.equal(model.subjects.includes('Data Science'),true);
  assert.equal(model.subjects.includes('Engineering'),true);
  assert.equal(model.fundingTypes.includes('Fully funded'),true);
  assert.equal(model.fundingTypes.includes('Merit award'),true);
});

test('intake model includes only exact public intake posts',()=>{
  const model=buildIntakeCommunityModel('Global Tech University','Fall 2027',posts,opportunities);
  const ids=[...model.discussions,...model.outcomes].map(row=>row.id);
  assert.deepEqual(new Set(ids),new Set(['u-discussion','u-unanswered','u-success']));
  assert.equal(ids.includes('u-other-intake'),false);
  assert.equal(ids.includes('u-hidden'),false);
  assert.equal(ids.includes('u-private'),false);
});

test('intake model separates exact opportunities from unspecified university opportunities',()=>{
  const model=buildIntakeCommunityModel('Global Tech University','Fall 2027',posts,opportunities);
  assert.deepEqual(new Set(model.opportunities.map(row=>row.id)),new Set(['exact-fall','exact-fall-2']));
  assert.deepEqual(model.generalUniversityOpportunities.map(row=>row.id),['general']);
  assert.equal(model.opportunities.some(row=>row.id==='spring'),false);
  assert.equal(model.opportunities.some(row=>row.id==='general'),false);
});

test('intake model does not pretend unspecified opportunities belong to the intake',()=>{
  const model=buildIntakeCommunityModel('Global Tech University','Fall 2027',posts,opportunities);
  assert.equal(model.counts.opportunities,2);
  assert.equal(model.counts.generalUniversityOpportunities,1);
});

test('intake model keeps privacy and official-source boundaries explicit',()=>{
  const model=buildIntakeCommunityModel('Global Tech University','Fall 2027',posts,opportunities);
  assert.match(model.sourceNote,/official university or provider sources/i);
  assert.match(model.privacyNote,/application IDs/i);
  assert.match(model.privacyNote,/passport or visa numbers/i);
});

test('university and intake ranking disclaimers avoid accuracy claims',()=>{
  const university=buildUniversityCommunityModel('Global Tech University',posts,opportunities);
  const intake=buildIntakeCommunityModel('Global Tech University','Fall 2027',posts,opportunities);
  assert.match(university.rankingNote,/not a quality or accuracy score/i);
  assert.match(intake.rankingNote,/not a quality or accuracy score/i);
});

test('unknown intake remains deterministic and does not inherit another intake opportunities',()=>{
  const model=buildIntakeCommunityModel('Global Tech University','Winter 2030',posts,opportunities);
  assert.equal(model.intake,'Winter 2030');
  assert.equal(model.discussions.length,0);
  assert.equal(model.outcomes.length,0);
  assert.equal(model.opportunities.length,0);
  assert.deepEqual(model.generalUniversityOpportunities.map(row=>row.id),['general']);
});
