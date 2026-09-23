import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSavedCommunityModel } from '../../app/js/services/saved-community-service.js';

const posts=[
  {
    id:'discussion-1',
    status:'published',
    visibility:'public',
    postType:'discussion',
    title:'Useful discussion',
    _savedAtMillis:100
  },
  {
    id:'success-1',
    status:'published',
    visibility:'public',
    postType:'success_story',
    title:'Student success',
    _savedAtMillis:300
  },
  {
    id:'journey-1',
    status:'published',
    visibility:'public',
    postType:'journey_story',
    title:'Journey story',
    _savedAtMillis:200
  }
];

test('saved Community model sorts by saved time descending',()=>{
  const model=buildSavedCommunityModel({posts,referenceCount:3});
  assert.deepEqual(model.items.map(post=>post.id),['success-1','journey-1','discussion-1']);
});

test('saved Community model separates discussions and outcome stories',()=>{
  const model=buildSavedCommunityModel({posts,referenceCount:3});
  assert.equal(model.counts.saved,3);
  assert.equal(model.counts.discussions,1);
  assert.equal(model.counts.successStories,1);
  assert.equal(model.counts.journeyStories,1);
  assert.equal(model.counts.outcomes,2);
  assert.deepEqual(model.outcomes.map(post=>post.id),['success-1','journey-1']);
});

test('hidden and private posts never enter saved Community output',()=>{
  const model=buildSavedCommunityModel({
    posts:[
      ...posts,
      {id:'hidden',status:'hidden',visibility:'public',postType:'discussion',_savedAtMillis:999},
      {id:'private',status:'published',visibility:'private',postType:'discussion',_savedAtMillis:998}
    ],
    referenceCount:5,
    staleCount:2
  });
  assert.equal(model.items.some(post=>post.id==='hidden'),false);
  assert.equal(model.items.some(post=>post.id==='private'),false);
  assert.equal(model.counts.unavailable,2);
});

test('duplicate saved records collapse to one public post',()=>{
  const model=buildSavedCommunityModel({
    posts:[
      {...posts[0],_savedAtMillis:100},
      {...posts[0],_savedAtMillis:400}
    ],
    referenceCount:2
  });
  assert.equal(model.items.length,1);
  assert.equal(model.items[0]._savedAtMillis,400);
});

test('empty saved library stays deterministic',()=>{
  const model=buildSavedCommunityModel({posts:[],referenceCount:0,staleCount:0});
  assert.equal(model.empty,true);
  assert.equal(model.counts.saved,0);
  assert.equal(model.referenceCount,0);
});

test('privacy and distinction copy keep saved posts separate from application data',()=>{
  const model=buildSavedCommunityModel({posts});
  assert.match(model.privacyNote,/private account data/i);
  assert.match(model.distinctionNote,/separate from Saved Opportunities and application Journeys/i);
});
