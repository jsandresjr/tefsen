import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProfilePresentation,
  publicProfileCompletion,
  validatePublicProfileDraft
} from '../../app/js/services/profile-presentation-service.js';

test('public profile completion is separate from Student Passport completion',()=>{
  const completion=publicProfileCompletion({
    fullName:'A Student',
    username:'astudent',
    bio:'Learning engineering.',
    photoUrl:'https://example.org/photo.jpg'
  });
  assert.equal(completion.percent,100);
});

test('missing public fields produce clear improvement actions',()=>{
  const completion=publicProfileCompletion({fullName:'A Student'});
  assert.equal(completion.percent,35);
  assert.equal(completion.improve.some(item=>item.key==='photo'),true);
  assert.equal(completion.improve.some(item=>item.key==='username'),true);
  assert.equal(completion.improve.some(item=>item.key==='bio'),true);
});

test('profile presentation never exposes private workspace to another student',()=>{
  const view=buildProfilePresentation({
    profile:{fullName:'Public Student',username:'publicstudent'},
    own:false,
    passportCompleteness:92,
    savedOpportunities:8,
    activeJourneys:3,
    goal:'Private goal'
  });
  assert.equal(view.private,null);
  assert.equal(view.public.fullName,'Public Student');
});

test('own profile keeps private Student Passport and Journey metrics in private model',()=>{
  const view=buildProfilePresentation({
    profile:{fullName:'Owner'},
    own:true,
    passportCompleteness:76,
    savedOpportunities:4,
    activeJourneys:2,
    goal:'Study computer science'
  });
  assert.equal(view.private.passportCompleteness,76);
  assert.equal(view.private.savedOpportunities,4);
  assert.equal(view.private.activeJourneys,2);
  assert.equal(view.private.goal,'Study computer science');
});

test('missing username is not replaced by a fake public handle',()=>{
  const own=buildProfilePresentation({profile:{fullName:'Owner'},own:true});
  const other=buildProfilePresentation({profile:{fullName:'Other'},own:false});
  assert.equal(own.public.username,'');
  assert.equal(own.public.displayHandle,'Add a username');
  assert.equal(other.public.displayHandle,'No public username');
});

test('valid public profile draft accepts supported username characters',()=>{
  const result=validatePublicProfileDraft({
    fullName:'A Student',
    username:'a.student_27',
    bio:'Physics learner'
  });
  assert.equal(result.valid,true);
});

test('invalid username characters are rejected instead of silently stripped',()=>{
  const result=validatePublicProfileDraft({
    fullName:'A Student',
    username:'bad username!'
  });
  assert.equal(result.valid,false);
  assert.equal(result.errors.some(item=>item.field==='username'),true);
});

test('very short non-empty username is rejected',()=>{
  const result=validatePublicProfileDraft({
    fullName:'A Student',
    username:'ab'
  });
  assert.equal(result.valid,false);
});

test('username and bio remain optional with warnings',()=>{
  const result=validatePublicProfileDraft({fullName:'A Student'});
  assert.equal(result.valid,true);
  assert.equal(result.warnings.some(item=>item.code==='missing_username'),true);
  assert.equal(result.warnings.some(item=>item.code==='missing_bio'),true);
});
