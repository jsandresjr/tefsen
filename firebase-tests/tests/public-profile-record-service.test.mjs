import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPublicProfileRecord,
  normalizePublicProfileRecord,
  publicProfileContainsPrivateFields
} from '../../app/js/services/public-profile-record-service.js';

test('public profile record contains only intentional public identity fields', () => {
  const record=buildPublicProfileRecord('user-a',{
    fullName:'Amina Rahman',
    username:'@amina.dev',
    bio:'Computer Science student',
    profileImageUrl:'https://example.test/a.jpg',
    email:'private@example.test',
    subscriptionPlan:'Premium',
    role:'ADMIN',
    verified:true
  });
  assert.deepEqual(Object.keys(record).sort(),[
    'bio','fullName','photoURL','profileImageUrl','schemaVersion','uid','username'
  ]);
  assert.equal(record.username,'amina.dev');
  assert.equal('email' in record,false);
  assert.equal('subscriptionPlan' in record,false);
  assert.equal('role' in record,false);
  assert.equal('verified' in record,false);
});

test('email-looking fallback names are never mirrored publicly', () => {
  const record=buildPublicProfileRecord('user-a',{
    fullName:'private@example.test',
    username:''
  });
  assert.equal(record.fullName,'Tefsen User');
});

test('public username is never inferred from email', () => {
  const record=buildPublicProfileRecord('user-a',{
    email:'amina@example.test'
  });
  assert.equal(record.username,'');
});

test('normalization bounds public text', () => {
  const record=normalizePublicProfileRecord({
    uid:'user-a',
    fullName:' Student Name ',
    username:'student',
    bio:'x'.repeat(700)
  });
  assert.equal(record.fullName,'Student Name');
  assert.equal(record.bio.length,500);
});

test('privacy detector identifies account-only fields', () => {
  assert.equal(publicProfileContainsPrivateFields({uid:'u1',fullName:'Amina'}),false);
  assert.equal(publicProfileContainsPrivateFields({uid:'u1',email:'private@example.test'}),true);
  assert.equal(publicProfileContainsPrivateFields({uid:'u1',subscriptionActive:true}),true);
});
