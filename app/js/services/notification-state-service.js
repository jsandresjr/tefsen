const MAX_NOTIFICATION_READ_IDS = 600;
const MAX_NOTIFICATION_ID_LENGTH = 240;

function cleanId(value) {
  return String(value || '').trim().slice(0, MAX_NOTIFICATION_ID_LENGTH);
}

export function normalizeNotificationReadIds(values = []) {
  const source = values instanceof Set ? [...values] : (Array.isArray(values) ? values : []);
  const seen = new Set();
  const ordered = [];
  for (const value of source) {
    const id = cleanId(value);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  return ordered.slice(-MAX_NOTIFICATION_READ_IDS);
}

export function mergeNotificationReadIds(...sources) {
  return new Set(normalizeNotificationReadIds(sources.flatMap(source =>
    source instanceof Set ? [...source] : (Array.isArray(source) ? source : [])
  )));
}

export function notificationReadStatePayload(userId, readIds = []) {
  const uid = cleanId(userId);
  if (!uid) throw new Error('Missing user ID.');
  return {
    uid,
    userId:uid,
    documentType:'notification_read_state',
    schemaVersion:1,
    readIds:normalizeNotificationReadIds(readIds)
  };
}

export function mergeActivityNotificationRecords(...groups) {
  const rows = groups.flatMap(group => Array.isArray(group) ? group : []);
  const byId = new Map();
  for (const row of rows) {
    const id = cleanId(row?.id);
    if (!id) continue;
    const existing = byId.get(id);
    const currentTime = Number(row?.sortTime || row?.createdAtMillis || 0);
    const existingTime = Number(existing?.sortTime || existing?.createdAtMillis || 0);
    if (!existing || currentTime >= existingTime) byId.set(id, row);
  }
  return [...byId.values()]
    .sort((a,b) => Number(b?.sortTime || b?.createdAtMillis || 0) - Number(a?.sortTime || a?.createdAtMillis || 0))
    .slice(0, 80);
}

export { MAX_NOTIFICATION_READ_IDS, MAX_NOTIFICATION_ID_LENGTH };
