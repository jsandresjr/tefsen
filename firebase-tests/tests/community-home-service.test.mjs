import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCommunityHomeModel } from '../../app/js/services/community-service.js';

const opportunities=[
  {id:'o1',subjects:['Computer Science'],university:'Global Tech University',country:'Canada',intake:'Fall 2027'},
  {id:'o2',subjects:['Physics'],university:'Science Institute',country:'Germany',intake:'2027'}
];

const posts=[
  {
    id:'d1',postType:'discussion',status:'published',visibility:'public',
    subject:'Computer Science',title:'How should I learn recursion?',
    likeCount:4,commentCount:5,saveCount:3
  },
  {
    id:'d2',postType:'discussion',status:'published',visibility:'public',
    subject:'Physics',title:'Why does current change?',
    likeCount:20,commentCount:0,saveCount:2
  },
  {
    id:'hidden',postType:'discussion',status:'hidden',visibility:'public',
    subject:'Chemistry',title:'Hidden',likeCount:999,commentCount:999,saveCount:999
  },
  {
    id:'private',postType:'discussion',status:'published',visibility:'private',
    subject:'Biology',title:'Private',likeCount:999,commentCount:999,saveCount:999
  },
  {
    id:'s1',postType:'success_story',status:'published',visibility:'public',
    subject:'Computer Science',communitySubject:'Computer Science',
    communityUniversity:'Global Tech University',
    successData:{university:'Global Tech University',subject:'Computer Science',country:'Canada',intake:'Fall 2027'},
    likeCount:8,commentCount:2,saveCount:4
  },
  {
    id:'j1',postType:'journey_story',status:'published',visibility:'public',
    subject:'Physics',communitySubject:'Physics',
    communityUniversity:'Science Institute',
    communityIntake:'2027',
    likeCount:3,commentCount:1,saveCount:1
  }
];

test('community home excludes hidden and private posts',()=>{
  const model=buildCommunityHomeModel(posts,opportunities);
  const ids=[
    ...model.discussions.map(row=>row.id),
    ...model.outcomes.map(row=>row.id),
    ...model.unanswered.map(row=>row.id)
  ];
  assert.equal(ids.includes('hidden'),false);
  assert.equal(ids.includes('private'),false);
});

test('community home keeps discussions separate from outcomes',()=>{
  const model=buildCommunityHomeModel(posts,opportunities);
  assert.deepEqual(model.discussions.map(row=>row.id),['d1','d2']);
  assert.deepEqual(new Set(model.outcomes.map(row=>row.id)),new Set(['s1','j1']));
});

test('discussion ranking uses engagement signals deterministically',()=>{
  const model=buildCommunityHomeModel(posts,opportunities);
  assert.equal(model.discussions[0].id,'d1');
});

test('unanswered panel contains public discussions with zero replies only',()=>{
  const model=buildCommunityHomeModel(posts,opportunities);
  assert.deepEqual(model.unanswered.map(row=>row.id),['d2']);
  assert.equal(model.counts.unanswered,1);
});

test('community home builds subject and university discovery from public data',()=>{
  const model=buildCommunityHomeModel(posts,opportunities);
  assert.equal(model.subjects.some(row=>row.name==='Computer Science'),true);
  assert.equal(model.subjects.some(row=>row.name==='Physics'),true);
  assert.equal(model.universities.some(row=>row.name==='Global Tech University'),true);
  assert.equal(model.universities.some(row=>row.name==='Science Institute'),true);
});

test('ranking note does not claim quality or accuracy',()=>{
  const model=buildCommunityHomeModel(posts,opportunities);
  assert.match(model.rankingNote,/not a quality or accuracy score/i);
});

test('empty model remains useful and deterministic',()=>{
  const model=buildCommunityHomeModel([],[]);
  assert.equal(model.empty,true);
  assert.equal(model.counts.discussions,0);
  assert.deepEqual(model.discussions,[]);
  assert.deepEqual(model.subjects,[]);
  assert.deepEqual(model.universities,[]);
});
