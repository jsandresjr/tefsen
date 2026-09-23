import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../../app/index.html', import.meta.url), 'utf8');
const data = await readFile(new URL('../../app/js/services/data-service.js', import.meta.url), 'utf8');
const rules = await readFile(new URL('../firestore.web-v1.test.rules', import.meta.url), 'utf8');
const sw = await readFile(new URL('../../app/sw.js', import.meta.url), 'utf8');

function block(startNeedle,endNeedle){
  const start=data.indexOf(startNeedle);
  const end=data.indexOf(endNeedle,start);
  assert.ok(start>=0 && end>start, `Missing block: ${startNeedle}`);
  return data.slice(start,end);
}

test('legacy rules sync is no longer loaded by the app shell', () => {
  assert.doesNotMatch(index,/latest-rules-sync\.js/);
});

test('Web like hydration checks only the current user like document', () => {
  const source=block('export async function hydratePostLikeState','export async function toggleLike');
  assert.match(source,/getDoc\(likeRef\)/);
  assert.doesNotMatch(source,/getCountFromServer/);
  assert.doesNotMatch(source,/collection\(db, C\.posts, postId, S\.likes/);
});

test('new real posts do not publish client asserted role verification or plan metadata', () => {
  const source=block('export async function createPost','export async function getPost');
  const realStart=source.indexOf('const postRef =');
  const real=source.slice(realStart);
  assert.doesNotMatch(real,/authorRole:/);
  assert.doesNotMatch(real,/authorVerified:/);
  assert.doesNotMatch(real,/verified:/);
  assert.doesNotMatch(real,/webPlan:/);
  assert.doesNotMatch(real,/quotaDay:/);
});

test('new real answers do not publish client asserted trust metadata', () => {
  const source=block('export async function addComment','function notificationReadKey');
  const realStart=source.indexOf('const canonicalPostId');
  const real=source.slice(realStart);
  assert.doesNotMatch(real,/authorRole:/);
  assert.doesNotMatch(real,/authorVerified:/);
  assert.doesNotMatch(real,/verified:/);
});

test('rules cover self authored Web posts private likes and public answers', () => {
  assert.match(rules,/validWebPostCreate/);
  assert.match(rules,/match \/likes\/\{uid\}/);
  assert.match(rules,/allow read: if isAdmin\(\) \|\| isOwner\(uid\)/);
  assert.match(rules,/match \/answers\/\{answerId\}/);
  assert.match(rules,/validWebAnswerCreate/);
});

test('ordinary clients cannot update public post counters', () => {
  const start=rules.indexOf('match /posts/{postId}');
  const end=rules.indexOf('match /reports/{reportId}',start);
  const source=rules.slice(start,end);
  assert.doesNotMatch(source,/allow update:[\s\S]{0,300}likeCount/);
  assert.match(source,/affectedKeys\(\)\.hasOnly/);
});

test('PWA shell remains versioned after interaction security cleanup', () => {
  assert.match(sw,/tefsen-web-shell-v\d+/);
});
