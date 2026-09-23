import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../../app/js/app.js', import.meta.url), 'utf8');
const data = await readFile(new URL('../../app/js/services/data-service.js', import.meta.url), 'utf8');
const profile = await readFile(new URL('../../app/js/services/public-profile-service.js', import.meta.url), 'utf8');
const store = await readFile(new URL('../../app/js/store.js', import.meta.url), 'utf8');
const appCss = await readFile(new URL('../../app/css/app.css', import.meta.url), 'utf8');
const premiumCss = await readFile(new URL('../../app/css/premium-v2.css', import.meta.url), 'utf8');
const index = await readFile(new URL('../../app/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../../app/sw.js', import.meta.url), 'utf8');

test('visible navigation no longer presents a student leaderboard', () => {
  assert.doesNotMatch(app, /\['leaderboard',\s*'Leaderboard'/);
  assert.doesNotMatch(premiumCss, /data-route="leaderboard"/);
});

test('old leaderboard route is preserved only as an integrity compatibility page', () => {
  assert.match(app, /function renderLeaderboardRetired/);
  assert.match(app, /case 'leaderboard': renderLeaderboardRetired\(\)/);
  assert.match(app, /does not rank students with unverified points/);
  assert.doesNotMatch(app, /state\.leaderboard/);
});

test('client no longer queries users and ranks sampled points', () => {
  assert.doesNotMatch(data, /export async function getLeaderboard/);
  assert.doesNotMatch(data, /sort\(\(a, b\) => b\.points - a\.points\)/);
  assert.doesNotMatch(data, /reputation \|\| 0/);
});

test('public user projection does not expose points as reputation', () => {
  const start=profile.indexOf('export function projectPublicUser');
  const end=profile.indexOf('export function isPublicProfileActivity',start);
  assert.ok(start>=0 && end>start);
  assert.doesNotMatch(profile.slice(start,end), /points/);
});

test('obsolete leaderboard state and styles are removed', () => {
  assert.doesNotMatch(store, /leaderboard:/);
  assert.doesNotMatch(appCss, /\.leaderboard-row/);
  assert.doesNotMatch(appCss, /\.rank\.top/);
});

test('Step 28 recognition page is loaded and cached under V55', () => {
  assert.match(index, /css\/v28-recognition\.css/);
  assert.match(sw, /tefsen-web-shell-v55-recognition-integrity/);
  assert.match(sw, /css\/v28-recognition\.css/);
});
