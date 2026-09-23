import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const app = await readFile(new URL('../../app/js/app.js', import.meta.url), 'utf8');
const data = await readFile(new URL('../../app/js/services/data-service.js', import.meta.url), 'utf8');
const settings = await readFile(new URL('../../app/js/services/settings-service.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../../app/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../../app/sw.js', import.meta.url), 'utf8');

async function exists(relativePath){
  try {
    await access(new URL(relativePath, import.meta.url));
    return true;
  } catch {
    return false;
  }
}

function sourceBlock(content,startNeedle,endNeedle){
  const start=content.indexOf(startNeedle);
  const end=content.indexOf(endNeedle,start);
  assert.ok(start>=0 && end>start,`Missing block: ${startNeedle}`);
  return content.slice(start,end);
}

test('data layer has no email-derived admin authority',()=>{
  assert.doesNotMatch(data,/jsandresjr@gmail\.com/i);
  assert.doesNotMatch(data,/String\(email[^\n]+ADMIN/);
  assert.doesNotMatch(data,/function isAdminRole/);
});

test('posting policy accepts explicit trusted admin capability',()=>{
  const block=sourceBlock(data,'export function getWebPostingPolicy','function utcDayKey');
  assert.match(block,/\{ admin = false \}/);
  assert.match(block,/if \(admin === true\)/);
  assert.doesNotMatch(block,/profile\?\.role/);
});

test('profile updates do not write identity authority fields',()=>{
  const block=sourceBlock(data,'export async function updateUserProfile','export async function removeProfilePhoto');
  const payloadStart=block.indexOf('const payload = {');
  const payloadEnd=block.indexOf('};',payloadStart);
  const payload=block.slice(payloadStart,payloadEnd);
  assert.doesNotMatch(payload,/uid:/);
  assert.doesNotMatch(payload,/email/);
  assert.doesNotMatch(payload,/role/);
  assert.doesNotMatch(payload,/verified/);
  assert.match(payload,/fullName/);
  assert.match(payload,/username/);
});

test('app admin presentation uses custom-claim capability rather than profile role',()=>{
  assert.doesNotMatch(app,/String\(state\.profile\?\.role[^\n]+admin/i);
  assert.doesNotMatch(app,/String\(p\.role[^\n]+admin/i);
  assert.match(app,/adminCapability === true/);
  assert.match(app,/adminAuthorized:adminCapability/);
});

test('composer and post creation propagate trusted admin capability',()=>{
  assert.match(app,/getWebPostingPolicy\(state\.profile \|\| \{\}, \{ admin:adminCapability \}\)/);
  assert.match(app,/createPost\(state\.mode,state\.user,state\.profile,payload,\{admin:adminCapability\}\)/);
  assert.match(data,/createPost\(mode, user, profile, payload, \{ admin = false \} = \{\}\)/);
});

test('settings admin state is explicitly authorization-driven',()=>{
  assert.match(settings,/adminAuthorized = false/);
  assert.match(settings,/const admin = adminAuthorized === true/);
  assert.doesNotMatch(settings,/profile\.role[^\n]+admin/i);
});

test('Web subscription page does not hard-code price or promotional trial eligibility',()=>{
  assert.doesNotMatch(app,/\$2\.99/);
  assert.doesNotMatch(app,/3-day free trial/i);
  assert.match(app,/Price shown in Google Play/);
  assert.match(app,/Google Play is the authority for current price, taxes, trial or promotional eligibility/);
});

test('legacy trial DOM patch stays deleted and unloaded',async()=>{
  assert.equal(await exists('../../app/js/trial-ui.js'),false);
  assert.doesNotMatch(index,/trial-ui\.js/);
  assert.doesNotMatch(sw,/trial-ui\.js/);
});

test('PWA shell remains versioned after later completion steps',()=>{
  assert.match(sw,/tefsen-web-shell-v\d+/);
});
