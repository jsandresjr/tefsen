import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NEW_ACCOUNT_KEYS,
  buildNewAccountDocument,
  buildExistingAccountProfilePatch,
  accountCreateHasExactSchema
} from '../../app/js/services/account-bootstrap-service.js';

test('new account payload exactly matches the owner-create schema',()=>{
  const record=buildNewAccountDocument({
    uid:'user-a',
    email:'student@example.test',
    displayName:'Amina Rahman',
    photoURL:'https://example.test/photo.jpg'
  },{createdAt:1,updatedAt:2});

  assert.deepEqual(Object.keys(record).sort(),[...NEW_ACCOUNT_KEYS].sort());
  assert.equal(accountCreateHasExactSchema(record),true);
  assert.equal(record.role,'student');
  assert.equal(record.verified,false);
  assert.equal(record.username,'');
  assert.equal(record.bio,'');
});

test('new account bootstrap never derives admin from email',()=>{
  const record=buildNewAccountDocument({
    uid:'user-a',
    email:'admin@example.test',
    displayName:'Admin Looking Name'
  },{createdAt:1,updatedAt:2});
  assert.equal(record.role,'student');
  assert.equal('admin' in record,false);
});

test('email-looking display names are not published into account display name',()=>{
  const record=buildNewAccountDocument({
    uid:'user-a',
    email:'student@example.test',
    displayName:'student@example.test'
  },{createdAt:1,updatedAt:2});
  assert.equal(record.fullName,'Tefsen User');
  assert.equal(record.displayName,'Tefsen User');
});

test('existing-account bootstrap patch contains only owner-safe profile fields',()=>{
  const patch=buildExistingAccountProfilePatch({
    uid:'user-a',
    email:'changed@example.test',
    displayName:'Provider Name',
    photoURL:'https://example.test/provider.jpg'
  },{
    fullName:'Custom Public Name',
    profileImageUrl:'https://example.test/custom.jpg',
    role:'ADMIN',
    subscriptionActive:true
  },{updatedAt:3});

  assert.deepEqual(Object.keys(patch).sort(),[
    'displayName','fullName','photoURL','profileImageUrl','updatedAt'
  ]);
  assert.equal(patch.fullName,'Custom Public Name');
  assert.equal(patch.profileImageUrl,'https://example.test/custom.jpg');
  assert.equal('email' in patch,false);
  assert.equal('role' in patch,false);
  assert.equal('verified' in patch,false);
  assert.equal('subscriptionActive' in patch,false);
});

test('provider identity fills empty legacy public profile fields safely',()=>{
  const patch=buildExistingAccountProfilePatch({
    uid:'user-a',
    displayName:'Provider Name',
    photoURL:'https://example.test/provider.jpg'
  },{}, {updatedAt:3});
  assert.equal(patch.fullName,'Provider Name');
  assert.equal(patch.profileImageUrl,'https://example.test/provider.jpg');
});
