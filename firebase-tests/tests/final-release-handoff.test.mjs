import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const handoff = await readFile(new URL('../../docs/WEB_FINAL_RELEASE_HANDOFF.md', import.meta.url),'utf8');
const launch = await readFile(new URL('../../docs/WEB_V1_LAUNCH_CHECKLIST.md', import.meta.url),'utf8');
const audit = await readFile(new URL('../../docs/WEB_V1_ENGINEERING_AUDIT.md', import.meta.url),'utf8');
const plan = await readFile(new URL('../../docs/WEB_COMPLETION_MASTER_PLAN.md', import.meta.url),'utf8');
const readme = await readFile(new URL('../../README.md', import.meta.url),'utf8');
const firebaseReadme = await readFile(new URL('../README.md', import.meta.url),'utf8');

test('final handoff distinguishes source completion from external production gates',()=>{
  assert.match(handoff,/Source status:\*\* Web completion work is complete/i);
  assert.match(handoff,/External production gates still required/);
  assert.match(handoff,/Production Firebase rules deployed/);
  assert.match(handoff,/App Check enforced/);
  assert.match(handoff,/Production launch verified/);
  assert.match(handoff,/Do not claim this until/i);
});

test('final handoff records actual merged Steps 25 through 39',()=>{
  for(const [step,pr] of [
    [25,67],[26,69],[27,70],[28,71],[29,72],[30,73],[31,74],[32,75],
    [33,76],[34,77],[35,78],[36,79],[37,80],[38,81],[39,82]
  ]){
    assert.match(handoff,new RegExp('\\| '+step+' \\|[^\\n]*PR #'+pr));
  }
  assert.match(handoff,/\| 40 \| Final release audit and handoff/);
});

test('launch checklist no longer claims emulator security testing was impossible',()=>{
  assert.match(launch,/Firestore isolated emulator security tests/);
  assert.match(launch,/Cloud Storage isolated emulator security tests/);
  assert.doesNotMatch(launch,/could not be emulator-tested/i);
  assert.doesNotMatch(launch,/Firebase Emulator Suite security-rule test run\s*$/m);
});

test('engineering audit reflects combined emulator coverage and correct external boundary',()=>{
  assert.match(audit,/Firebase Firestore emulator/);
  assert.match(audit,/Firebase Cloud Storage emulator/);
  assert.match(audit,/363\/363 tests, 0 failures/);
  assert.match(audit,/complete authoritative production rule set/i);
  assert.doesNotMatch(audit,/Firebase Emulator Suite security-rule test run\s*$/m);
  assert.doesNotMatch(audit,/Storage-rule regression test\s*$/m);
});

test('master plan no longer ends at Step 25 and records final closeout',()=>{
  assert.match(plan,/Completion closeout — Steps 25–40/);
  assert.match(plan,/Step 39.*PR #82/);
  assert.match(plan,/Step 40.*Final release audit and handoff/);
  assert.doesNotMatch(plan,/\*\*Next: Step 25/);
});

test('README points maintainers to the final release handoff',()=>{
  assert.match(readme,/docs\/WEB_FINAL_RELEASE_HANDOFF\.md/);
  assert.match(readme,/do not claim App Check enforcement/i);
});

test('isolated Firebase README still warns against direct production overwrite',()=>{
  assert.match(firebaseReadme,/intentionally \*\*not\*\* the production Firebase deployment configuration/i);
  assert.match(firebaseReadme,/must not be deployed over Tefsen's full production rules/i);
});

test('final handoff keeps App Check and rule deployment sequencing conservative',()=>{
  assert.match(handoff,/Never deploy the isolated/);
  assert.match(handoff,/Do not enable enforcement blindly/i);
  assert.match(handoff,/real-domain authentication\/data\/device smoke testing/i);
});
