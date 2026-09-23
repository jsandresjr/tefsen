import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { publicProfileCapabilities } from '../../app/js/services/public-profile-service.js';

async function source(path){
  return readFile(new URL(path, import.meta.url),'utf8');
}

test('public profiles do not advertise private messaging',()=>{
  const capabilities=publicProfileCapabilities();
  assert.equal(capabilities.message,false);
});

test('Web shell has no active Messages navigation or message forms',async()=>{
  const app=await source('../../app/js/app.js');
  assert.doesNotMatch(app,/data-route="messages"/);
  assert.doesNotMatch(app,/\['messages',\s*'Messages'/);
  assert.doesNotMatch(app,/data-message-form/);
  assert.doesNotMatch(app,/data-message-user/);
  assert.doesNotMatch(app,/data-conversation/);
  assert.doesNotMatch(app,/data-messages-back/);
  assert.doesNotMatch(app,/renderMessages\s*\(/);
  assert.doesNotMatch(app,/handleStartConversation\s*\(/);
  assert.doesNotMatch(app,/handleMessage\s*\(/);
});

test('legacy messages route resolves to an explicit unavailable page',async()=>{
  const app=await source('../../app/js/app.js');
  assert.match(app,/case 'messages': renderPrivateMessagingUnavailable\(\); break;/);
  assert.match(app,/function renderPrivateMessagingUnavailable\(\)/);
  assert.match(app,/Private messages are not available on Tefsen Web/);
  assert.match(app,/Open Community/);
});

test('data service no longer exports fake conversation APIs',async()=>{
  const data=await source('../../app/js/services/data-service.js');
  assert.doesNotMatch(data,/export async function getConversations/);
  assert.doesNotMatch(data,/export function subscribeMessages/);
  assert.doesNotMatch(data,/export async function sendMessage/);
  assert.doesNotMatch(data,/export async function startConversation/);
});

test('store no longer carries unused conversation or message state',async()=>{
  const store=await source('../../app/js/store.js');
  assert.doesNotMatch(store,/\bconversations\s*:/);
  assert.doesNotMatch(store,/\bselectedConversation\s*:/);
  assert.doesNotMatch(store,/\bmessages\s*:/);
});

test('old chat layout selectors are removed from the Web stylesheet',async()=>{
  const css=await source('../../app/css/app.css');
  assert.doesNotMatch(css,/\.messages-layout\b/);
  assert.doesNotMatch(css,/\.conversation-list\b/);
  assert.doesNotMatch(css,/\.conversation-item\b/);
  assert.doesNotMatch(css,/\.chat-pane\b/);
  assert.doesNotMatch(css,/\.chat-messages\b/);
  assert.doesNotMatch(css,/\.chat-form\b/);
});
