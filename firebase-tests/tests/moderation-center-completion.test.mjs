import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../../app/js/app.js', import.meta.url), 'utf8');
const data = await readFile(new URL('../../app/js/services/data-service.js', import.meta.url), 'utf8');
const moderation = await readFile(new URL('../../app/js/services/moderation-service.js', import.meta.url), 'utf8');
const schema = await readFile(new URL('../../app/js/config/schema.js', import.meta.url), 'utf8');
const rules = await readFile(new URL('../firestore.web-v1.test.rules', import.meta.url), 'utf8');
const index = await readFile(new URL('../../app/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../../app/sw.js', import.meta.url), 'utf8');

test('legacy report writer is removed from data-service', () => {
  assert.doesNotMatch(data, /export async function reportPost/);
  assert.doesNotMatch(data, /doc\(collection\(db, 'support_requests'\)\)/);
});

test('new student reports use canonical reports collection', () => {
  assert.match(moderation, /doc\(collection\(db, C\.reports\)\)/);
  assert.match(moderation, /submitPostReport/);
  assert.match(moderation, /status:'open'/);
});

test('admin moderation keeps legacy support-request compatibility', () => {
  assert.match(moderation, /support_requests/);
  assert.match(moderation, /where\('type','==','post_report'\)/);
  assert.match(schema, /supportRequests: 'support_requests'/);
});

test('moderation actions are atomic and audited', () => {
  assert.match(moderation, /writeBatch\(db\)/);
  assert.match(moderation, /moderation_audit/);
  assert.match(moderation, /batch\.update\(doc\(db,C\.posts/);
  assert.match(moderation, /batch\.set\(auditRef/);
});

test('admin UI includes Community reports without replacing opportunity tools', () => {
  assert.match(app, /Community reports/);
  assert.match(app, /Opportunity review/);
  assert.match(app, /Opportunity import/);
  assert.match(app, /data-admin-moderation-action/);
  assert.match(app, /submitPostReport/);
});

test('student report modal explains privacy', () => {
  assert.match(app, /Reports are private/);
  assert.match(app, /Submit private report/);
});

test('report and moderation audit rules are explicit', () => {
  assert.match(rules, /match \/reports\/\{reportId\}/);
  assert.match(rules, /validPostReportCreate/);
  assert.match(rules, /match \/moderation_audit\/\{auditId\}/);
  assert.match(rules, /allow update, delete: if false/);
});

test('Step 27 assets are loaded and cached under V54', () => {
  assert.match(index, /css\/v27-moderation\.css/);
  assert.match(sw, /tefsen-web-shell-v54-moderation-center/);
  assert.match(sw, /moderation-model\.js/);
  assert.match(sw, /moderation-service\.js/);
});
