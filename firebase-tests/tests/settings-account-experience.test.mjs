import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../../app/js/app.js', import.meta.url), 'utf8');
const dataService = await readFile(new URL('../../app/js/services/data-service.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../../app/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../../app/sw.js', import.meta.url), 'utf8');

test('Settings no longer uses global legacy preference keys', () => {
  assert.doesNotMatch(app, /tefsen_pref_compact/);
  assert.doesNotMatch(app, /tefsen_pref_motion/);
});

test('Settings does not duplicate the public profile edit form', () => {
  const start = app.indexOf('function renderSettings()');
  const end = app.indexOf('function adminStatusMarkup', start);
  assert.ok(start >= 0 && end > start);
  const settingsBlock = app.slice(start, end);
  assert.doesNotMatch(settingsBlock, /data-profile-form/);
  assert.match(settingsBlock, /data-edit-profile/);
  assert.match(settingsBlock, /Public profile is edited separately/);
});

test('private settings use the authenticated user settings document', () => {
  assert.match(dataService, /doc\(db, C\.users, String\(userId\), 'settings', 'preferences'\)/);
  assert.match(dataService, /export async function getUserSettings/);
  assert.match(dataService, /export async function saveUserSettings/);
});

test('Settings exposes real notification preference controls', () => {
  assert.match(app, /notificationOpportunityDeadlines/);
  assert.match(app, /notificationJourneyReminders/);
  assert.match(app, /notificationCommunityActivity/);
  assert.match(app, /applyNotificationPreferences/);
});

test('existing Google Play subscription experience remains connected', () => {
  assert.match(app, /GOOGLE_PLAY_APP_URL/);
  assert.match(app, /GOOGLE_PLAY_SUBSCRIPTIONS_URL/);
  assert.match(app, /data-sync-subscription/);
});

test('Step 25 assets stay loaded and cached after later cache-version bumps', () => {
  assert.match(index, /css\/v25-settings\.css/);
  assert.match(sw, /css\/v25-settings\.css/);
  assert.match(sw, /js\/services\/settings-service\.js/);
});
