import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAppCheckReadiness, normalizeAppCheckSiteKey } from '../../app/js/services/app-check-readiness-service.js';

test('placeholder and empty App Check keys are not treated as configured',()=>{
  assert.equal(normalizeAppCheckSiteKey(''), '');
  assert.equal(normalizeAppCheckSiteKey('PASTE_SITE_KEY'), '');
});

test('Firebase mode with no key is a launch blocker',()=>{
  const state=buildAppCheckReadiness({mode:'firebase',siteKey:'',initialized:false});
  assert.equal(state.state,'missing-key');
  assert.equal(state.readyForEnforcement,false);
});

test('configured key without initialization remains not ready',()=>{
  const state=buildAppCheckReadiness({mode:'firebase',siteKey:'real-site-key',initialized:false});
  assert.equal(state.state,'initialization-failed');
  assert.equal(state.configured,true);
  assert.equal(state.initialized,false);
});

test('initialized client never claims enforcement is active',()=>{
  const state=buildAppCheckReadiness({mode:'firebase',siteKey:'real-site-key',initialized:true});
  assert.equal(state.state,'client-ready');
  assert.equal(state.initialized,true);
  assert.equal(state.readyForEnforcement,false);
  assert.match(state.detail,/Firebase Console/i);
});
