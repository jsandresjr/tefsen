import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../../app/js/app.js', import.meta.url), 'utf8');
const auth = await readFile(new URL('../../app/js/services/auth-service.js', import.meta.url), 'utf8');
const privacyService = await readFile(new URL('../../app/js/services/privacy-request-service.js', import.meta.url), 'utf8');
const deleteCanonical = await readFile(new URL('../../delete-account/index.html', import.meta.url), 'utf8');
const deleteLegacy = await readFile(new URL('../../delete-account.html', import.meta.url), 'utf8');
const privacyPolicy = await readFile(new URL('../../privacy-policy/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../../app/sw.js', import.meta.url), 'utf8');

test('Settings exposes request-based deletion, access and portability actions',()=>{
  assert.match(app,/buildPrivacyRequestMailto/);
  assert.match(app,/buildPrivacyRequestMailto\('deletion'/);
  assert.match(app,/buildPrivacyRequestMailto\('access'/);
  assert.match(app,/buildPrivacyRequestMailto\('portability'/);
  assert.match(app,/Requests open your email app; nothing is sent automatically/);
  assert.match(app,/Tefsen Web does not delete the account immediately from this browser/);
  assert.match(app,/Google Play subscriptions are separate/);
});

test('browser auth layer does not pretend to perform full account deletion',()=>{
  assert.doesNotMatch(auth,/deleteUser/);
  assert.doesNotMatch(app,/deleteUser/);
  assert.match(privacyService,/automatic:false/);
  assert.match(privacyService,/requestRequired:true/);
});

test('canonical delete-account page explains verified request and self-service boundaries',()=>{
  assert.match(deleteCanonical,/rel="canonical" href="https:\/\/www\.tefsen\.com\/delete-account\/"/);
  assert.match(deleteCanonical,/does not perform full account deletion as an immediate one-click browser action/i);
  assert.match(deleteCanonical,/verify that the request comes from the account owner/i);
  assert.match(deleteCanonical,/Never send your password, one-time code, recovery code, or authentication token/i);
  assert.match(deleteCanonical,/Delete your post/);
  assert.match(deleteCanonical,/Remove your profile photo/);
  assert.match(deleteCanonical,/post's uploaded image slots are cleaned up with the post/i);
  assert.match(deleteCanonical,/does not automatically cancel a Google Play subscription/i);
});

test('legacy delete-account URL redirects to canonical route',()=>{
  assert.match(deleteLegacy,/rel="canonical" href="https:\/\/www\.tefsen\.com\/delete-account\/"/);
  assert.match(deleteLegacy,/url=\/delete-account\//);
  assert.match(deleteLegacy,/window\.location\.replace\('\/delete-account\/'\)/);
  assert.doesNotMatch(deleteLegacy,/Data we delete/);
});

test('Privacy Policy describes the same Web deletion request flow',()=>{
  assert.match(privacyPolicy,/Last updated:<\/strong> September 23, 2026/);
  assert.match(privacyPolicy,/Settings → Security → Account deletion/);
  assert.match(privacyPolicy,/verified request, not an immediate one-click browser action/i);
  assert.match(privacyPolicy,/Self-service removal of an individual post or profile photo is separate/i);
  assert.match(privacyPolicy,/Settings → Privacy also provides prefilled email actions/i);
  assert.doesNotMatch(privacyPolicy,/Open Tefsen → Profile → Settings → Delete Account/);
});

test('privacy request helper never asks users to send authentication secrets',()=>{
  assert.match(privacyService,/not included my password or authentication codes/i);
  assert.doesNotMatch(privacyService,/send your password/i);
  assert.match(privacyService,/support@tefsen\.com/);
});

test('PWA shell keeps privacy request helper cached after later version bumps',()=>{
  assert.match(sw,/tefsen-web-shell-v\d+/);
  assert.match(sw,/privacy-request-service\.js/);
});
