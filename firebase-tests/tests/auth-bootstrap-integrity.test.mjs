import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const auth = await readFile(new URL('../../app/js/services/auth-service.js', import.meta.url), 'utf8');
const bootstrap = await readFile(new URL('../../app/js/services/account-bootstrap-service.js', import.meta.url), 'utf8');
const rules = await readFile(new URL('../firestore.web-v1.test.rules', import.meta.url), 'utf8');
const sw = await readFile(new URL('../../app/sw.js', import.meta.url), 'utf8');

test('auth service has no hard-coded admin email or role derivation',()=>{
  assert.doesNotMatch(auth,/ADMIN_EMAIL/);
  assert.doesNotMatch(auth,/normalizeStoredRole/);
  assert.doesNotMatch(auth,/email.*ADMIN/i);
});

test('every Firebase auth path retries account bootstrap',()=>{
  assert.match(auth,/export async function ensureUserDocument/);
  assert.match(auth,/signInWithEmailAndPassword[\s\S]*ensureUserDocument\(credential\.user\)/);
  assert.match(auth,/createUserWithEmailAndPassword[\s\S]*ensureUserDocument\(credential\.user/);
  assert.match(auth,/signInWithPopup[\s\S]*ensureUserDocument\(credential\.user\)/);
  assert.match(auth,/onAuthStateChanged[\s\S]*ensureUserDocument\(user\)/);
});

test('new account bootstrap emits strict non-privileged defaults',()=>{
  assert.match(bootstrap,/role:'student'/);
  assert.match(bootstrap,/verified:false/);
  assert.match(bootstrap,/username:''/);
  assert.match(bootstrap,/bio:''/);
  assert.doesNotMatch(bootstrap,/role:'ADMIN'/);
});

test('existing account bootstrap patch cannot write protected fields',()=>{
  const start=bootstrap.indexOf('export function buildExistingAccountProfilePatch');
  const end=bootstrap.indexOf('export function accountCreateHasExactSchema',start);
  const block=bootstrap.slice(start,end);
  assert.doesNotMatch(block,/email:/);
  assert.doesNotMatch(block,/role:/);
  assert.doesNotMatch(block,/verified:/);
  assert.doesNotMatch(block,/subscription/);
});

test('Firestore owner rule remains compatible with safe bootstrap fields only',()=>{
  const start=rules.indexOf('match /users/{uid}');
  const end=rules.indexOf('match /public_profiles/{uid}',start);
  const block=rules.slice(start,end);
  assert.match(block,/validOwnerAccountCreate/);
  assert.match(block,/request\.resource\.data\.role == "student"/);
  assert.match(block,/request\.resource\.data\.verified == false/);
  assert.match(block,/safeOwnerAccountUpdate/);
});

test('PWA caches account bootstrap module',()=>{
  assert.match(sw,/account-bootstrap-service\.js/);
});
