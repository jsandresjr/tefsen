import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const data = await readFile(new URL('../../app/js/services/data-service.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../../app/js/app.js', import.meta.url), 'utf8');
const rules = await readFile(new URL('../storage.web-v1.test.rules', import.meta.url), 'utf8');
const firebaseJson = await readFile(new URL('../firebase.json', import.meta.url), 'utf8');
const packageJson = await readFile(new URL('../package.json', import.meta.url), 'utf8');
const config = await readFile(new URL('../../app/js/config/firebase-config.js', import.meta.url), 'utf8');
const readiness = await readFile(new URL('../../app/js/services/app-check-readiness-service.js', import.meta.url), 'utf8');
const sw = await readFile(new URL('../../app/sw.js', import.meta.url), 'utf8');

test('new post images use deterministic owner slots with bound metadata',()=>{
  assert.match(data,/post_images\/\$\{user\.uid\}\/\$\{postRef\.id\}\/\$\{slot\}/);
  assert.match(data,/customMetadata:\{/);
  assert.match(data,/ownerUid:String\(user\.uid\)/);
  assert.match(data,/postId:String\(postRef\.id\)/);
  assert.doesNotMatch(data,/post_images\/\$\{user\.uid\}\/\$\{postRef\.id\}\/\$\{Date\.now\(\)\}/);
});

test('post deletion cleans deterministic slots without listing user folders',()=>{
  const start=data.indexOf('export async function deletePost');
  const end=data.indexOf('export async function getReactionIds',start);
  const block=data.slice(start,end);
  assert.match(block,/\['1','2'\]/);
  assert.match(block,/deleteObject/);
  assert.doesNotMatch(block,/listAll/);
});

test('Storage rules enforce owner paths image MIME size limits and deny-all fallback',()=>{
  assert.match(rules,/match \/profile_images\/\{fileName\}/);
  assert.match(rules,/5 \* 1024 \* 1024/);
  assert.match(rules,/match \/post_images\/\{uid\}\/\{postId\}\/\{slot\}/);
  assert.match(rules,/slot == "1" \|\| slot == "2"/);
  assert.match(rules,/6 \* 1024 \* 1024/);
  assert.match(rules,/image\/\(jpeg\|png\|webp\)/);
  assert.match(rules,/match \/\{allPaths=\*\*\}/);
  assert.match(rules,/allow read, write: if false/);
});

test('Firebase emulator config runs both Firestore and Storage',()=>{
  const cfg=JSON.parse(firebaseJson);
  assert.equal(cfg.storage.rules,'storage.web-v1.test.rules');
  assert.equal(cfg.emulators.storage.port,9198);
  const pkg=JSON.parse(packageJson);
  assert.match(pkg.scripts['test:emulator'],/--only firestore,storage/);
});

test('App Check readiness never equates client initialization with enforcement',()=>{
  assert.match(readiness,/readyForEnforcement:false/);
  assert.match(readiness,/Enforcement must still be verified/);
  assert.doesNotMatch(readiness,/readyForEnforcement:true/);
});

test('Admin consumes actual App Check initialization state',()=>{
  assert.match(app,/initFirebase, appCheck/);
  assert.match(app,/buildAppCheckReadiness/);
  assert.match(app,/initialized:Boolean\(appCheck\)/);
  assert.match(app,/does not prove enforcement is enabled/);
});

test('Firebase config accurately documents reCAPTCHA v3 provider',()=>{
  assert.match(config,/reCAPTCHA v3 site key/);
  assert.match(config,/ReCaptchaV3Provider/);
  assert.doesNotMatch(config,/reCAPTCHA Enterprise or v3/);
});

test('PWA keeps App Check readiness cached after later cache-version bumps',()=>{
  assert.match(sw,/tefsen-web-shell-v\d+/);
  assert.match(sw,/app-check-readiness-service\.js/);
});
