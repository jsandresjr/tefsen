import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const data = await readFile(new URL('../../app/js/services/data-service.js', import.meta.url), 'utf8');
const schema = await readFile(new URL('../../app/js/config/schema.js', import.meta.url), 'utf8');
const record = await readFile(new URL('../../app/js/services/public-profile-record-service.js', import.meta.url), 'utf8');
const rules = await readFile(new URL('../firestore.web-v1.test.rules', import.meta.url), 'utf8');
const sw = await readFile(new URL('../../app/sw.js', import.meta.url), 'utf8');

function block(startNeedle,endNeedle){
  const start=data.indexOf(startNeedle);
  const end=data.indexOf(endNeedle,start);
  assert.ok(start>=0 && end>start, `Missing block: ${startNeedle}`);
  return data.slice(start,end);
}

test('other-user public lookup reads only public_profiles', () => {
  const source=block('export async function getUserById','export async function getProfile');
  assert.match(source,/publicProfileDocument\(userId\)/);
  assert.doesNotMatch(source,/C\.users/);
});

test('Public Search reads public_profiles instead of private users', () => {
  const source=block('export async function searchAll','export async function updateUserProfile');
  assert.match(source,/collection\(db, C\.publicProfiles\)/);
  assert.doesNotMatch(source,/collection\(db, C\.users\)/);
});

test('signed-in owner profile remains the only users document read path for account profile', () => {
  const source=block('export async function getProfile','export function subscribePosts');
  assert.match(source,/doc\(db, C\.users, user\.uid\)/);
  assert.match(source,/syncOwnPublicProfile/);
});

test('profile writes mirror a stripped public record atomically', () => {
  const source=block('export async function updateUserProfile','export async function removeProfilePhoto');
  assert.match(source,/writeBatch\(db\)/);
  assert.match(source,/publicProfileWritePayload/);
  assert.match(source,/publicProfileDocument\(userId\)/);
});

test('email is no longer used to infer public username', () => {
  const start=data.indexOf('export function normalizeUser');
  const end=data.indexOf('function cleanPublicText',start);
  const source=data.slice(start,end);
  assert.doesNotMatch(source,/split\('@'\)/);
  assert.match(source,/username: raw\.username \|\| raw\.handle \|\| ''/);
});

test('public profile record model cannot carry account-only fields', () => {
  assert.match(record,/publicProfileContainsPrivateFields/);
  assert.doesNotMatch(record,/subscriptionActive:/);
  assert.doesNotMatch(record,/email:/);
});

test('schema maps a dedicated public profile collection', () => {
  assert.match(schema,/publicProfiles: 'public_profiles'/);
});

test('rules make users private and public_profiles field-limited', () => {
  assert.match(rules,/match \/users\/\{uid\}/);
  assert.match(rules,/allow read: if isOwner\(uid\) \|\| isAdmin\(\)/);
  assert.match(rules,/match \/public_profiles\/\{uid\}/);
  assert.match(rules,/allow read: if true/);
  assert.match(rules,/validPublicProfile/);
  assert.doesNotMatch(rules,/public_profiles[\s\S]{0,1800}"email"/);
});

test('PWA caches the public profile privacy service', () => {
  assert.match(sw,/public-profile-record-service\.js/);
});
