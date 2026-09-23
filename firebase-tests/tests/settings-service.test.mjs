import test from 'node:test';
import assert from 'node:assert/strict';

import {
  defaultUserSettings,
  normalizeUserSettings,
  settingsCacheKey,
  authProviderLabel,
  buildSettingsModel,
  applyNotificationPreferences
} from '../../app/js/services/settings-service.js';

test('settings defaults are deterministic and privacy-safe', () => {
  const settings = defaultUserSettings({ timeZone:'Asia/Colombo' });
  assert.equal(settings.theme, 'dark');
  assert.equal(settings.language, 'en');
  assert.equal(settings.timeZone, 'Asia/Colombo');
  assert.equal(settings.notificationOpportunityDeadlines, true);
  assert.equal(settings.notificationJourneyReminders, true);
  assert.equal(settings.notificationCommunityActivity, true);
});

test('settings normalization rejects unsupported theme and language values', () => {
  const settings = normalizeUserSettings({
    theme:'light',
    language:'xx',
    region:'  Sri   Lanka  ',
    compactFeed:true,
    reducedMotion:true
  });
  assert.equal(settings.theme, 'dark');
  assert.equal(settings.language, 'en');
  assert.equal(settings.region, 'Sri Lanka');
  assert.equal(settings.compactFeed, true);
  assert.equal(settings.reducedMotion, true);
});

test('cache key is isolated by authenticated uid', () => {
  assert.notEqual(settingsCacheKey('user-a'), settingsCacheKey('user-b'));
  assert.match(settingsCacheKey('user-a'), /user-a/);
});

test('provider labels reflect Firebase provider data', () => {
  assert.equal(authProviderLabel({providerData:[{providerId:'google.com'}]}), 'Google');
  assert.equal(authProviderLabel({providerData:[{providerId:'password'}],email:'a@example.com'}), 'Email and password');
});

test('settings model keeps public profile and private account responsibilities distinct', () => {
  const model = buildSettingsModel({
    profile:{fullName:'Student',subscriptionActive:false},
    user:{email:'student@example.com',providerData:[{providerId:'google.com'}]},
    settings:{}
  });
  assert.equal(model.plan.label, 'Free Student');
  assert.equal(model.identity.provider, 'Google');
  assert.ok(model.privacy.privateItems.some(item => /Student Passport/i.test(item)));
  assert.ok(model.privacy.publicItems.some(item => /Public profile/i.test(item)));
});

test('notification preferences suppress only the matching supported categories', () => {
  const source = {
    items:[
      {id:'d',type:'deadline',category:'attention',source:'derived',read:false},
      {id:'j',type:'journey',category:'planning',source:'derived',read:false},
      {id:'a',type:'reply',category:'activity',source:'activity',read:false}
    ],
    sourceNote:'test'
  };
  const model = applyNotificationPreferences(source,{
    notificationOpportunityDeadlines:false,
    notificationJourneyReminders:true,
    notificationCommunityActivity:false
  });
  assert.deepEqual(model.items.map(item=>item.id),['j']);
  assert.equal(model.counts.planning,1);
  assert.equal(model.counts.activity,0);
  assert.equal(model.unreadCount,1);
});


test('profile role alone cannot grant administrative plan state', () => {
  const model = buildSettingsModel({
    profile:{fullName:'Student',role:'ADMIN',subscriptionActive:false},
    user:{email:'student@example.com'},
    settings:{},
    adminAuthorized:false
  });
  assert.equal(model.plan.admin,false);
  assert.equal(model.plan.label,'Free Student');
});

test('trusted admin capability controls administrative plan state', () => {
  const model = buildSettingsModel({
    profile:{fullName:'Student',role:'student',subscriptionActive:false},
    user:{email:'student@example.com'},
    settings:{},
    adminAuthorized:true
  });
  assert.equal(model.plan.admin,true);
  assert.equal(model.plan.label,'Admin Full Access');
});
