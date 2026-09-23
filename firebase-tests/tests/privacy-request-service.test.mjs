import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accountDeletionFacts,
  buildPrivacyRequestMailto,
  privacyRequestDefinition,
  privacyRequestSupportAddress
} from '../../app/js/services/privacy-request-service.js';

test('account deletion is modeled as a request, not an automatic browser action',()=>{
  const facts=accountDeletionFacts();
  assert.equal(facts.automatic,false);
  assert.equal(facts.requestRequired,true);
  assert.equal(facts.subscriptionCancellationSeparate,true);
  assert.equal(facts.supportAddress,'support@tefsen.com');
});

test('deletion mailto contains the canonical support address and request subject',()=>{
  const href=buildPrivacyRequestMailto('deletion',{
    email:'student@example.test',
    username:'student-name',
    fullName:'Student Name'
  });
  assert.match(href,/^mailto:support@tefsen\.com\?/);
  assert.match(decodeURIComponent(href),/Tefsen Account Deletion Request/);
  assert.match(decodeURIComponent(href),/Account email: student@example\.test/);
  assert.match(decodeURIComponent(href),/Username: @student-name/);
  assert.match(decodeURIComponent(href),/not included my password or authentication codes/i);
});

test('privacy access and portability requests use distinct subjects',()=>{
  assert.notEqual(privacyRequestDefinition('access').subject,privacyRequestDefinition('portability').subject);
  assert.match(buildPrivacyRequestMailto('access'),/Personal%20Data%20Access%20Request/);
  assert.match(buildPrivacyRequestMailto('portability'),/Data%20Portability%20Request/);
});

test('privacy request helper exposes one canonical support address',()=>{
  assert.equal(privacyRequestSupportAddress(),'support@tefsen.com');
});
