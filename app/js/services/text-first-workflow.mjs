/**
 * Shared, dependency-free helpers for the Tefsen text-first Web UI.
 * These are UI guards and draft utilities, NOT substitutes for trusted
 * Cloud Functions / Firestore rules.
 */
export const FREE_POST_CHARS = 300;
export const PAID_POST_CHARS = 1000;
export const FREE_POSTS_PER_DAY = 20;
export const PAID_POSTS_PER_DAY = 40;
const DRAFT_PREFIX = 'tefsen-web-text-draft-v1:';

export function postLimits({ subscribed = false, admin = false } = {}) {
  return {
    maxChars: subscribed || admin ? PAID_POST_CHARS : FREE_POST_CHARS,
    dailyPosts: admin ? Infinity : subscribed ? PAID_POSTS_PER_DAY : FREE_POSTS_PER_DAY
  };
}

export function validateTextPost(text, limits) {
  const content = String(text || '').trim();
  if (!content) return { valid:false, message:'Write something before posting.', content };
  if ([...content].length > limits.maxChars) {
    return { valid:false, message:'This post is over your ' + limits.maxChars + '-character limit.', content };
  }
  return { valid:true, message:'', content };
}

export function draftStorageKey(userId) {
  const id = String(userId || '').trim();
  if (!id) throw new Error('Drafts require a signed-in account.');
  return DRAFT_PREFIX + encodeURIComponent(id);
}

export function loadDraft(storage, userId) {
  try {
    const record = JSON.parse(storage.getItem(draftStorageKey(userId)) || 'null');
    return record && record.uid === String(userId) && typeof record.text === 'string'
      ? record.text.slice(0, 1000) : '';
  } catch { return ''; }
}

export function saveDraft(storage, userId, text) {
  try {
    const value = String(text || '').slice(0, 1000);
    if (!value) return clearDraft(storage,userId);
    storage.setItem(draftStorageKey(userId),JSON.stringify({
      uid:String(userId), text:value, savedAt:new Date().toISOString()
    }));
    return true;
  } catch { return false; }
}

export function clearDraft(storage,userId) {
  try { storage.removeItem(draftStorageKey(userId)); return true; }
  catch { return false; }
}

export function normalizeSearch(value) {
  return String(value||'').trim().toLocaleLowerCase('en')
    .replace(/^@/,'').replace(/\s+/g,' ');
}

export function chooseSearchMode(query, mode = 'people') {
  return String(query || '').trim().startsWith('@') ? 'people'
    : mode === 'posts' ? 'posts' : 'people';
}

export function rankPeople(rows,query) {
  const term=normalizeSearch(query);
  if (!term) return [];
  const score=user => {
    const handle=normalizeSearch(user.username || user.handle);
    const name=normalizeSearch(user.fullName || user.displayName);
    if (handle===term) return 0;
    if (name===term) return 1;
    if (handle.startsWith(term)) return 2;
    if (name.startsWith(term)) return 3;
    if (handle.includes(term)) return 4;
    if (name.includes(term)) return 5;
    return Infinity;
  };
  return (Array.isArray(rows)?rows:[])
    .map(user=>({user,rank:score(user)}))
    .filter(item=>Number.isFinite(item.rank))
    .sort((a,b)=>a.rank-b.rank || String(a.user.fullName||'').localeCompare(String(b.user.fullName||'')))
    .map(item=>item.user);
}

export function filterPosts(rows, query) {
  const term=normalizeSearch(query);
  if(!term) return [];
  return (Array.isArray(rows)?rows:[])
    .filter(p=>[p.title,p.content,p.authorName].some(v=>normalizeSearch(v).includes(term)));
}
