import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../../app/js/app.js', import.meta.url), 'utf8');
const data = await readFile(new URL('../../app/js/services/data-service.js', import.meta.url), 'utf8');
const opportunities = await readFile(new URL('../../app/js/services/opportunity-service.js', import.meta.url), 'utf8');
const search = await readFile(new URL('../../app/js/services/global-search-service.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../../app/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../../app/sw.js', import.meta.url), 'utf8');

test('public search no longer calls a first-100 corpus global', () => {
  const start=data.indexOf('export async function searchAll');
  const end=data.indexOf('export async function updateUserProfile',start);
  assert.ok(start>=0 && end>start);
  const block=data.slice(start,end);
  assert.match(data,/SEARCH_USER_SCAN_LIMIT = 250/);
  assert.match(data,/SEARCH_POST_SCAN_LIMIT = 300/);
  assert.match(block,/limit\(SEARCH_USER_SCAN_LIMIT \+ 1\)/);
  assert.match(block,/limit\(SEARCH_POST_SCAN_LIMIT \+ 1\)/);
  assert.doesNotMatch(block,/limit\(100\)/);
  assert.doesNotMatch(block,/\.slice\(0, 20\)/);
  assert.doesNotMatch(block,/\.slice\(0, 30\)/);
});

test('opportunity search uses a wider dedicated corpus with truncation detection', () => {
  assert.match(opportunities,/SEARCH_OPPORTUNITY_SCAN_LIMIT = 180/);
  assert.match(opportunities,/export async function getOpportunitySearchCorpus/);
  assert.match(opportunities,/limit\(SEARCH_OPPORTUNITY_SCAN_LIMIT \+ 1\)/);
});

test('search merges live feed posts with the bounded search corpus', () => {
  assert.match(app,/mergeSearchPublicPosts\(state\.posts,rawSearch\.posts\)/);
  assert.doesNotMatch(app,/posts:state\.posts\.length \? state\.posts : rawSearch\.posts/);
});

test('search UI describes coverage and does not label itself global search', () => {
  const start=app.indexOf("async function renderSearch");
  const end=app.indexOf("function renderRoute",start);
  const block=app.slice(start,end);
  assert.match(block,/PUBLIC SEARCH/);
  assert.match(block,/Bounded search coverage/);
  assert.match(block,/Matches found in current search coverage/);
  assert.doesNotMatch(block,/GLOBAL SEARCH/);
});

test('search model carries explicit coverage metadata', () => {
  assert.match(search,/export function buildSearchCoverage/);
  assert.match(search,/countLabel:'Matches found in current search coverage'/);
  assert.match(search,/Matches outside those windows may not appear/);
});

test('Step 29 search integrity asset is loaded and cached', () => {
  assert.match(index,/css\/v29-search-integrity\.css/);
  assert.match(sw,/css\/v29-search-integrity\.css/);
});
