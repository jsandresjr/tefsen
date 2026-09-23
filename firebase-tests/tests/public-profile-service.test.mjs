import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPublicProfileModel,
  validatePublicProfileDraft
} from '../../app/js/services/public-profile-service.js';

test('public profile model separates public identity from private student workspace',()=>{
  const model=buildPublicProfileModel({
    profile:{
      fullName:'Alex Student',
      username:'alex.student',
      bio:'Engineering student sharing scholarship application lessons.',
      photoUrl:'https://example.org/photo.jpg',
      followersCount:12,
      followingCount:5
    },
    own:true,
    posts:[{id:'p1'},{id:'p2'}],
    passportCompleteness:80,
    activeJourneys:2,
    savedOpportunities:4
  });

  assert.equal(model.publicStats.posts,2);
  assert.equal(model.publicStats.followers,12);
  assert.equal(model.privateWorkspace.passportCompleteness,80);
  assert.equal(model.privateWorkspace.activeJourneys,2);
  assert.equal(model.privateWorkspace.savedOpportunities,4);
  assert.equal(model.privacy.privateFields.includes('Student Passport'),true);
});

test('other student model never exposes private workspace',()=>{
  const model=buildPublicProfileModel({
    profile:{fullName:'Public Student',username:'public.student'},
    own:false,
    passportCompleteness:100,
    activeJourneys:9,
    savedOpportunities:9
  });
  assert.equal(model.privateWorkspace,null);
});

test('identity completeness is deterministic and not an admission score',()=>{
  const complete=buildPublicProfileModel({
    profile:{
      fullName:'Alex Student',
      username:'alex',
      bio:'A sufficiently detailed public biography for another student.',
      photoUrl:'https://example.org/photo.jpg'
    },
    own:true
  });
  assert.equal(complete.identity.percent,100);
  assert.equal(complete.identity.total,4);

  const partial=buildPublicProfileModel({
    profile:{fullName:'Alex Student',username:'',bio:'',photoUrl:''},
    own:true
  });
  assert.equal(partial.identity.percent,25);
  assert.deepEqual(partial.identity.missing.map(item=>item.key),['username','bio','photo']);
});

test('username validation accepts supported public handle characters',()=>{
  const result=validatePublicProfileDraft({
    fullName:'Alex Student',
    username:'alex.student_26-test',
    bio:''
  });
  assert.equal(result.valid,true);
});

test('username validation rejects unsupported characters',()=>{
  const result=validatePublicProfileDraft({
    fullName:'Alex Student',
    username:'alex student!',
    bio:''
  });
  assert.equal(result.valid,false);
  assert.equal(result.errors.some(item=>item.field==='username'),true);
});

test('short username is rejected when provided',()=>{
  const result=validatePublicProfileDraft({
    fullName:'Alex Student',
    username:'ab',
    bio:''
  });
  assert.equal(result.valid,false);
});

test('missing username and bio are guidance warnings not blockers',()=>{
  const result=validatePublicProfileDraft({
    fullName:'Alex Student',
    username:'',
    bio:''
  });
  assert.equal(result.valid,true);
  assert.equal(result.warnings.some(item=>item.code==='missing_username'),true);
  assert.equal(result.warnings.some(item=>item.code==='missing_bio'),true);
});

test('public name must contain meaningful text',()=>{
  const result=validatePublicProfileDraft({
    fullName:'A',
    username:'alex',
    bio:''
  });
  assert.equal(result.valid,false);
  assert.equal(result.errors[0].field,'fullName');
});

test('bio maximum is enforced',()=>{
  const result=validatePublicProfileDraft({
    fullName:'Alex Student',
    username:'alex',
    bio:'x'.repeat(501)
  });
  assert.equal(result.valid,false);
  assert.equal(result.errors.some(item=>item.field==='bio'),true);
});
