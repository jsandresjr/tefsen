import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeNotificationReadIds,
  mergeNotificationReadIds,
  notificationReadStatePayload,
  mergeActivityNotificationRecords,
  MAX_NOTIFICATION_READ_IDS
} from '../../app/js/services/notification-state-service.js';

test('notification read IDs are deduplicated and bounded', () => {
  const values = Array.from({length:MAX_NOTIFICATION_READ_IDS + 5}, (_,index)=>`id-${index}`);
  values.push('id-604');
  const ids = normalizeNotificationReadIds(values);
  assert.equal(ids.length, MAX_NOTIFICATION_READ_IDS);
  assert.equal(ids.at(-1), 'id-604');
  assert.equal(new Set(ids).size, ids.length);
});

test('read-state merge combines local and remote IDs', () => {
  const merged = mergeNotificationReadIds(new Set(['a','b']), ['b','c']);
  assert.deepEqual([...merged], ['a','b','c']);
});

test('read-state payload is owner-bound and versioned', () => {
  const payload = notificationReadStatePayload('user-a', ['activity:1','deadline:2']);
  assert.equal(payload.uid, 'user-a');
  assert.equal(payload.userId, 'user-a');
  assert.equal(payload.documentType, 'notification_read_state');
  assert.equal(payload.schemaVersion, 1);
  assert.deepEqual(payload.readIds, ['activity:1','deadline:2']);
});

test('canonical and legacy activity records merge without duplicates', () => {
  const merged = mergeActivityNotificationRecords(
    [{id:'n1',sortTime:10},{id:'n2',sortTime:20}],
    [{id:'n1',sortTime:30},{id:'n3',sortTime:5}]
  );
  assert.deepEqual(merged.map(row=>row.id), ['n1','n2','n3']);
  assert.equal(merged[0].sortTime, 30);
});

test('activity merge returns the newest 80 records after combining both schemas', () => {
  const a = Array.from({length:60},(_,index)=>({id:`a-${index}`,sortTime:index}));
  const b = Array.from({length:60},(_,index)=>({id:`b-${index}`,sortTime:100+index}));
  const merged = mergeActivityNotificationRecords(a,b);
  assert.equal(merged.length,80);
  assert.equal(merged[0].id,'b-59');
  assert.ok(!merged.some(row=>row.id==='a-0'));
});
