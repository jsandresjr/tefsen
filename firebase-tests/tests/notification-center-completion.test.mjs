import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../../app/js/app.js', import.meta.url), 'utf8');
const data = await readFile(new URL('../../app/js/services/data-service.js', import.meta.url), 'utf8');
const rules = await readFile(new URL('../firestore.web-v1.test.rules', import.meta.url), 'utf8');
const sw = await readFile(new URL('../../app/sw.js', import.meta.url), 'utf8');

test('startup and refresh merge account-synced notification read IDs', () => {
  assert.match(app, /getSyncedNotificationReadIds\(state\.mode, user\.uid\)/);
  assert.match(app, /getSyncedNotificationReadIds\(state\.mode,state\.user\.uid\)/);
  assert.match(app, /readIds:notificationReadIds/);
  assert.match(app, /readIds,/);
});

test('canonical and legacy notification queries are both loaded and merged', () => {
  assert.match(data, /notificationQueryByField\(userId, 'userId'\)/);
  assert.match(data, /notificationQueryByField\(userId, 'recipientId'\)/);
  assert.match(data, /mergeActivityNotificationRecords\(canonical, legacy\)/);
  assert.doesNotMatch(data, /if \(canonical\.length\) return canonical/);
});

test('activity acknowledgement no longer performs a read-before-write', () => {
  const start = data.indexOf('async function markActivityNotificationRead');
  const end = data.indexOf('export async function markNotificationsRead', start);
  assert.ok(start >= 0 && end > start);
  const block = data.slice(start, end);
  assert.match(block, /updateDoc\(/);
  assert.doesNotMatch(block, /getDoc\(/);
  assert.doesNotMatch(block, /setDoc\(/);
});

test('mark all and mark section use the bulk acknowledgement path', () => {
  assert.match(app, /markNotificationsRead\(state\.mode,state\.user\.uid,unread\)/);
  assert.match(app, /data-notifications-mark-section/);
  assert.match(app, /handleNotificationsMarkSection/);
});

test('Notifications can deep-link to alert preferences', () => {
  assert.match(app, /data-route="settings\/notifications"/);
  assert.match(app, /allowedSettingsTabs/);
});

test('notification Firestore rules enforce recipient-only reads and safe acknowledgement', () => {
  assert.match(rules, /match \/notifications\/\{notificationId\}/);
  assert.match(rules, /notificationOwner/);
  assert.match(rules, /affectedKeys\(\)\.hasOnly/);
  assert.match(rules, /match \/users\/\{uid\}\/notificationState\/\{stateId\}/);
});

test('notification-state service stays cached after later cache-version bumps', () => {
  assert.match(sw, /notification-state-service\.js/);
});
