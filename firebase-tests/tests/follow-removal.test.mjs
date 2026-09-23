import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildPublicProfileModel,
  projectPublicUser,
  publicProfileCapabilities
} from '../../app/js/services/public-profile-service.js';

async function source(path){
  return readFile(new URL(path, import.meta.url),'utf8');
}

test('public profile capability keeps follow disabled',()=>{
  const capabilities=publicProfileCapabilities();
  assert.equal(capabilities.follow,false);
});

test('public profile model does not expose follower or following stats',()=>{
  const model=buildPublicProfileModel({
    profile:{
      fullName:'Alex Student',
      followersCount:999,
      followingCount:888
    },
    posts:[{id:'p1'}]
  });
  assert.deepEqual(model.publicStats,{posts:1});
  assert.equal('followers' in model.publicStats,false);
  assert.equal('following' in model.publicStats,false);
});

test('public user projection strips legacy follower and following counts',()=>{
  const projected=projectPublicUser({
    uid:'u1',
    fullName:'Alex Student',
    followersCount:999,
    followingCount:888,
    followerCount:777
  });
  assert.equal('followersCount' in projected,false);
  assert.equal('followingCount' in projected,false);
  assert.equal('followerCount' in projected,false);
});

test('Web app has no active Follow control or Follow handler',async()=>{
  const app=await source('../../app/js/app.js');
  assert.doesNotMatch(app,/data-follow-user/);
  assert.doesNotMatch(app,/handleFollow\s*\(/);
  assert.doesNotMatch(app,/\bgetFollowState\b/);
  assert.doesNotMatch(app,/\btoggleFollow\b/);
});

test('data service no longer exports fake follow APIs',async()=>{
  const data=await source('../../app/js/services/data-service.js');
  assert.doesNotMatch(data,/export async function getFollowState/);
  assert.doesNotMatch(data,/export async function toggleFollow/);
});

test('demo user fixtures do not invent follower or following counts',async()=>{
  const demo=await source('../../app/js/services/demo-data.js');
  assert.doesNotMatch(demo,/\bfollowersCount\s*:/);
  assert.doesNotMatch(demo,/\bfollowingCount\s*:/);
});

test('public profile service contains no follower popularity fields',async()=>{
  const service=await source('../../app/js/services/public-profile-service.js');
  assert.doesNotMatch(service,/followersCount/);
  assert.doesNotMatch(service,/followingCount/);
  assert.doesNotMatch(service,/\bfollowers\s*:/);
  assert.doesNotMatch(service,/\bfollowing\s*:/);
});
