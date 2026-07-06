import { db, storage } from '../firebase-client.js';
import { SCHEMA, FIELD_ALIASES } from '../config/schema.js';
import { pick, uid, timestampToDate } from '../utils.js';
import { DEMO_USERS, DEMO_POSTS, DEMO_COMMENTS, DEMO_NOTIFICATIONS, DEMO_CONVERSATIONS, DEMO_MESSAGES } from './demo-data.js';
import {
  collection, collectionGroup, doc, addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, limit, serverTimestamp, increment, arrayUnion
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-storage.js';

const C = SCHEMA.collections;
const S = SCHEMA.subcollections;

let demoPosts = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem('tefsen_demo_posts') || 'null');
    return Array.isArray(saved) ? [...saved, ...DEMO_POSTS.filter(p => !saved.some(x => x.id === p.id))] : [...DEMO_POSTS];
  } catch { return [...DEMO_POSTS]; }
})();
let demoComments = structuredClone(DEMO_COMMENTS);
let demoNotifications = structuredClone(DEMO_NOTIFICATIONS);
let demoConversations = structuredClone(DEMO_CONVERSATIONS);
let demoMessages = structuredClone(DEMO_MESSAGES);
const demoSaved = new Set(JSON.parse(localStorage.getItem('tefsen_demo_saved') || '[]'));
const demoLiked = new Set(JSON.parse(localStorage.getItem('tefsen_demo_liked') || '[]'));

function persistDemo() {
  localStorage.setItem('tefsen_demo_posts', JSON.stringify(demoPosts.filter(p => String(p.id).startsWith('local-'))));
  localStorage.setItem('tefsen_demo_saved', JSON.stringify([...demoSaved]));
  localStorage.setItem('tefsen_demo_liked', JSON.stringify([...demoLiked]));
}

export function normalizeUser(raw = {}, id = '') {
  return {
    ...raw,
    id: id || raw.id || raw.uid || '',
    uid: raw.uid || id || raw.id || '',
    fullName: pick(raw, FIELD_ALIASES.userName, 'Tefsen User'),
    photoUrl: pick(raw, FIELD_ALIASES.userPhoto, ''),
    role: pick(raw, FIELD_ALIASES.userRole, 'Student'),
    verified: Boolean(pick(raw, FIELD_ALIASES.userVerified, false)),
    username: raw.username || raw.handle || (raw.email ? String(raw.email).split('@')[0] : ''),
    bio: raw.bio || raw.about || '',
    points: Number(raw.points || raw.score || raw.reputation || 0),
    followersCount: Number(raw.followersCount || raw.followerCount || 0),
    followingCount: Number(raw.followingCount || 0)
  };
}

export function normalizePost(raw = {}, id = '') {
  const likesValue = pick(raw, FIELD_ALIASES.likeCount, 0);
  const commentsValue = pick(raw, FIELD_ALIASES.commentCount, 0);
  return {
    ...raw,
    id: id || raw.id || '',
    title: pick(raw, FIELD_ALIASES.postTitle, ''),
    content: pick(raw, FIELD_ALIASES.postBody, ''),
    imageUrl: pick(raw, FIELD_ALIASES.postImage, ''),
    authorId: pick(raw, FIELD_ALIASES.postAuthorId, ''),
    authorName: pick(raw, FIELD_ALIASES.postAuthorName, 'Tefsen User'),
    authorPhotoUrl: pick(raw, FIELD_ALIASES.postAuthorPhoto, ''),
    createdAt: pick(raw, FIELD_ALIASES.createdAt, null),
    likeCount: Array.isArray(likesValue) ? likesValue.length : Number(likesValue || 0),
    commentCount: Array.isArray(commentsValue) ? commentsValue.length : Number(commentsValue || 0),
    saveCount: Number(pick(raw, FIELD_ALIASES.saveCount, 0) || 0),
    subject: raw.subject || raw.category || raw.topic || 'General',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    role: raw.role || raw.authorRole || 'Student',
    verified: Boolean(raw.verified || raw.authorVerified || false)
  };
}


export async function getUserById(mode, userId) {
  if (!userId) return null;
  if (mode === 'demo') {
    const user = DEMO_USERS.find(u => u.uid === userId || u.id === userId);
    return user ? normalizeUser(user, userId) : null;
  }
  const snap = await getDoc(doc(db, C.users, userId));
  return snap.exists() ? normalizeUser(snap.data(), snap.id) : null;
}

export async function getProfile(mode, user) {
  if (!user) return null;
  if (mode === 'demo') {
    return normalizeUser(DEMO_USERS.find(u => u.uid === user.uid) || user, user.uid);
  }
  const snap = await getDoc(doc(db, C.users, user.uid));
  const authFallback = {
    uid: user.uid,
    fullName: user.displayName || user.email || 'Tefsen User',
    email: user.email || '',
    profileImageUrl: user.photoURL || ''
  };
  return normalizeUser(snap.exists() ? { ...authFallback, ...snap.data() } : authFallback, user.uid);
}

export function subscribePosts(mode, callback, errorCallback = console.error) {
  if (mode === 'demo') {
    callback(demoPosts.map(p => normalizePost(p, p.id)).sort((a,b) => (timestampToDate(b.createdAt)?.getTime() || 0) - (timestampToDate(a.createdAt)?.getTime() || 0)));
    return () => {};
  }
  let fallbackUnsub = null;
  const q = query(collection(db, C.posts), orderBy('createdAt', 'desc'), limit(50));
  const unsub = onSnapshot(q, snap => callback(snap.docs.map(d => normalizePost(d.data(), d.id))), err => {
    console.warn('Ordered posts listener failed; trying collection fallback.', err);
    try {
      fallbackUnsub = onSnapshot(query(collection(db, C.posts), limit(50)), snap => {
        const rows = snap.docs.map(d => normalizePost(d.data(), d.id));
        rows.sort((a,b) => (timestampToDate(b.createdAt)?.getTime() || 0) - (timestampToDate(a.createdAt)?.getTime() || 0));
        callback(rows);
      }, errorCallback);
    } catch (fallbackError) { errorCallback(fallbackError); }
  });
  return () => { unsub?.(); fallbackUnsub?.(); };
}

export async function createPost(mode, user, profile, payload) {
  if (mode === 'demo') {
    let imageUrl = '';
    if (payload.imageFile) imageUrl = URL.createObjectURL(payload.imageFile);
    const post = normalizePost({
      id: `local-${uid('post')}`,
      authorId: user.uid,
      authorName: profile?.fullName || user.displayName || 'Tefsen User',
      authorPhotoUrl: profile?.photoUrl || user.photoURL || '',
      role: profile?.role || 'Student', verified: profile?.verified || false,
      title: payload.title, content: payload.content, subject: payload.subject,
      tags: payload.tags, imageUrl, createdAt: new Date().toISOString(), likeCount: 0, commentCount: 0, saveCount: 0
    });
    demoPosts.unshift(post); persistDemo(); return post;
  }

  let imageUrl = '';
  if (payload.imageFile) {
    const cleanName = payload.imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectRef = ref(storage, `post_images/${user.uid}/${Date.now()}-${cleanName}`);
    const upload = await uploadBytes(objectRef, payload.imageFile, { contentType: payload.imageFile.type });
    imageUrl = await getDownloadURL(upload.ref);
  }
  const base = {
    title: payload.title,
    questionTitle: payload.title,
    content: payload.content,
    description: payload.content,
    subject: payload.subject || 'General',
    tags: payload.tags || [],
    imageUrl,
    authorId: user.uid,
    userId: user.uid,
    authorName: profile?.fullName || user.displayName || 'Tefsen User',
    authorPhotoUrl: profile?.photoUrl || user.photoURL || '',
    authorRole: profile?.role || 'Student',
    authorVerified: Boolean(profile?.verified),
    type: 'question',
    status: 'published',
    likeCount: 0,
    commentCount: 0,
    answerCount: 0,
    saveCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const added = await addDoc(collection(db, C.posts), base);
  return normalizePost(base, added.id);
}

export async function getPost(mode, postId) {
  if (mode === 'demo') return normalizePost(demoPosts.find(p => p.id === postId) || {}, postId);
  const snap = await getDoc(doc(db, C.posts, postId));
  return snap.exists() ? normalizePost(snap.data(), snap.id) : null;
}

export async function deletePost(mode, userId, postId) {
  if (!userId || !postId) throw new Error('Missing user or post ID.');

  if (mode === 'demo') {
    const index = demoPosts.findIndex(post => post.id === postId);
    if (index < 0) return false;
    const post = normalizePost(demoPosts[index], postId);
    if (post.authorId && String(post.authorId) !== String(userId)) {
      const error = new Error('You can delete only your own posts.');
      error.code = 'permission-denied';
      throw error;
    }
    demoPosts.splice(index, 1);
    delete demoComments[postId];
    demoSaved.delete(postId);
    demoLiked.delete(postId);
    persistDemo();
    return true;
  }

  const postRef = doc(db, C.posts, postId);
  const snap = await getDoc(postRef);
  if (!snap.exists()) return false;

  const raw = snap.data();
  const ownerId = String(pick(raw, FIELD_ALIASES.postAuthorId, '') || '');
  if (!ownerId || ownerId !== String(userId)) {
    const error = new Error('You can delete only your own posts.');
    error.code = 'permission-denied';
    throw error;
  }

  // Delete the parent post. Firestore does not automatically delete nested
  // subcollections; production cleanup for comments/likes is best handled by
  // a trusted backend or Cloud Function.
  await deleteDoc(postRef);
  return true;
}

export async function getReactionIds(mode, userId) {
  if (!userId) return { saved: new Set(), liked: new Set() };
  if (mode === 'demo') return { saved: new Set(demoSaved), liked: new Set(demoLiked) };
  const saved = new Set();
  const liked = new Set();
  try {
    const savedSnap = await getDocs(collection(db, C.users, userId, S.savedPosts));
    savedSnap.forEach(d => saved.add(d.id));
  } catch (e) { console.warn('Saved posts unavailable:', e); }
  try {
    const likedSnap = await getDocs(query(collectionGroup(db, S.likes), where('userId', '==', userId), limit(200)));
    likedSnap.forEach(d => {
      const parentPost = d.ref.parent.parent;
      if (parentPost?.id) liked.add(parentPost.id);
    });
  } catch (e) { console.warn('Liked posts unavailable:', e); }
  return { saved, liked };
}

export async function toggleLike(mode, userId, postId) {
  if (mode === 'demo') {
    const post = demoPosts.find(p => p.id === postId);
    const active = demoLiked.has(postId);
    if (active) demoLiked.delete(postId); else demoLiked.add(postId);
    if (post) post.likeCount = Math.max(0, Number(post.likeCount || 0) + (active ? -1 : 1));
    persistDemo();
    return !active;
  }
  const likeRef = doc(db, C.posts, postId, S.likes, userId);
  const postRef = doc(db, C.posts, postId);
  const snap = await getDoc(likeRef);
  if (snap.exists()) {
    await deleteDoc(likeRef);
    await updateDoc(postRef, { likeCount: increment(-1) }).catch(() => {});
    return false;
  }
  await setDoc(likeRef, { userId, createdAt: serverTimestamp() });
  await updateDoc(postRef, { likeCount: increment(1) }).catch(() => {});
  return true;
}

export async function toggleSave(mode, userId, postId) {
  if (mode === 'demo') {
    const active = demoSaved.has(postId);
    if (active) demoSaved.delete(postId); else demoSaved.add(postId);
    persistDemo(); return !active;
  }
  const saveRef = doc(db, C.users, userId, S.savedPosts, postId);
  const snap = await getDoc(saveRef);
  if (snap.exists()) { await deleteDoc(saveRef); return false; }
  await setDoc(saveRef, { postId, userId, createdAt: serverTimestamp() });
  return true;
}

export function subscribeComments(mode, postId, callback, errorCallback = console.error) {
  if (mode === 'demo') {
    callback((demoComments[postId] || []).map(x => ({...x})));
    return () => {};
  }
  const commentsRef = collection(db, C.posts, postId, S.comments);
  return onSnapshot(query(commentsRef, orderBy('createdAt', 'asc'), limit(100)), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, err => {
    console.warn('Ordered comments listener failed:', err);
    onSnapshot(query(commentsRef, limit(100)), snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))), errorCallback);
  });
}

export async function addComment(mode, user, profile, postId, text) {
  if (mode === 'demo') {
    const item = { id: uid('comment'), authorId: user.uid, authorName: profile?.fullName || 'Tefsen User', role: profile?.role || 'Student', verified: profile?.verified || false, content: text, createdAt: new Date().toISOString(), likeCount: 0 };
    demoComments[postId] = [...(demoComments[postId] || []), item];
    const post = demoPosts.find(p => p.id === postId); if (post) post.commentCount = Number(post.commentCount || 0) + 1;
    return item;
  }
  const item = {
    authorId: user.uid,
    userId: user.uid,
    authorName: profile?.fullName || user.displayName || 'Tefsen User',
    authorPhotoUrl: profile?.photoUrl || user.photoURL || '',
    authorRole: profile?.role || 'Student',
    authorVerified: Boolean(profile?.verified),
    content: text,
    text,
    likeCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const added = await addDoc(collection(db, C.posts, postId, S.comments), item);
  await updateDoc(doc(db, C.posts, postId), { commentCount: increment(1), answerCount: increment(1) }).catch(() => {});
  return { id: added.id, ...item };
}

export async function getNotifications(mode, userId) {
  if (mode === 'demo') return demoNotifications.filter(n => n.recipientId === userId || userId.startsWith('demo-'));
  try {
    const snap = await getDocs(query(collection(db, C.notifications), where('recipientId', '==', userId), orderBy('createdAt', 'desc'), limit(60)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(query(collection(db, C.notifications), where('recipientId', '==', userId), limit(60)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (timestampToDate(b.createdAt)?.getTime() || 0) - (timestampToDate(a.createdAt)?.getTime() || 0));
  }
}

export async function markNotificationRead(mode, id) {
  if (mode === 'demo') { const n = demoNotifications.find(x => x.id === id); if (n) n.read = true; return; }
  await updateDoc(doc(db, C.notifications, id), { read: true, readAt: serverTimestamp() });
}

export async function getConversations(mode, userId) {
  if (mode === 'demo') return demoConversations.filter(c => c.participants.includes(userId) || userId.startsWith('demo-'));
  try {
    const snap = await getDocs(query(collection(db, C.conversations), where('participants', 'array-contains', userId), orderBy('updatedAt', 'desc'), limit(50)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(query(collection(db, C.conversations), where('participants', 'array-contains', userId), limit(50)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (timestampToDate(b.updatedAt)?.getTime() || 0) - (timestampToDate(a.updatedAt)?.getTime() || 0));
  }
}

export function subscribeMessages(mode, conversationId, callback, errorCallback = console.error) {
  if (mode === 'demo') { callback([...(demoMessages[conversationId] || [])]); return () => {}; }
  return onSnapshot(query(collection(db, C.conversations, conversationId, S.messages), orderBy('createdAt', 'asc'), limit(200)), snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))), errorCallback);
}

export async function sendMessage(mode, userId, conversationId, text) {
  if (mode === 'demo') {
    const item = { id: uid('message'), senderId: userId, text, createdAt: new Date().toISOString() };
    demoMessages[conversationId] = [...(demoMessages[conversationId] || []), item];
    const conv = demoConversations.find(c => c.id === conversationId); if (conv) { conv.lastMessage = text; conv.updatedAt = item.createdAt; }
    return item;
  }
  const message = { senderId: userId, text, createdAt: serverTimestamp() };
  const added = await addDoc(collection(db, C.conversations, conversationId, S.messages), message);
  await updateDoc(doc(db, C.conversations, conversationId), { lastMessage: text, updatedAt: serverTimestamp() }).catch(() => {});
  return { id: added.id, ...message };
}

export async function getLeaderboard(mode) {
  if (mode === 'demo') return [...DEMO_USERS].sort((a,b) => b.points - a.points).map(normalizeUser);
  try {
    const snap = await getDocs(query(collection(db, C.users), orderBy('points', 'desc'), limit(30)));
    return snap.docs.map(d => normalizeUser(d.data(), d.id));
  } catch {
    const snap = await getDocs(query(collection(db, C.users), limit(60)));
    return snap.docs.map(d => normalizeUser(d.data(), d.id)).sort((a,b) => b.points - a.points).slice(0, 30);
  }
}

export async function searchAll(mode, term) {
  const qText = term.trim().toLowerCase();
  if (!qText) return { users: [], posts: [] };
  if (mode === 'demo') {
    return {
      users: DEMO_USERS.map(normalizeUser).filter(u => `${u.fullName} ${u.username} ${u.bio}`.toLowerCase().includes(qText)),
      posts: demoPosts.map(p => normalizePost(p,p.id)).filter(p => `${p.title} ${p.content} ${p.subject} ${(p.tags || []).join(' ')}`.toLowerCase().includes(qText))
    };
  }
  const [usersSnap, postsSnap] = await Promise.all([
    getDocs(query(collection(db, C.users), limit(100))),
    getDocs(query(collection(db, C.posts), limit(100)))
  ]);
  const users = usersSnap.docs.map(d => normalizeUser(d.data(), d.id)).filter(u => `${u.fullName} ${u.username} ${u.bio}`.toLowerCase().includes(qText));
  const posts = postsSnap.docs.map(d => normalizePost(d.data(), d.id)).filter(p => `${p.title} ${p.content} ${p.subject} ${(p.tags || []).join(' ')}`.toLowerCase().includes(qText));
  return { users: users.slice(0, 20), posts: posts.slice(0, 30) };
}

export async function updateUserProfile(mode, userId, data) {
  if (mode === 'demo') {
    const base = DEMO_USERS.find(u => u.uid === userId) || {};
    Object.assign(base, data); return normalizeUser(base, userId);
  }
  const payload = {
    fullName: data.fullName,
    displayName: data.fullName,
    username: data.username,
    bio: data.bio,
    updatedAt: serverTimestamp()
  };
  await setDoc(doc(db, C.users, userId), payload, { merge: true });
  return normalizeUser({ ...data, uid: userId }, userId);
}

export async function reportPost(mode, userId, postId, reason, details = '') {
  if (mode === 'demo') return { id: uid('report') };
  return addDoc(collection(db, C.reports), { reporterId: userId, postId, reason, details, status: 'open', createdAt: serverTimestamp() });
}

export async function startConversation(mode, currentUserId, otherUser) {
  if (mode === 'demo') {
    const existing = demoConversations.find(c => c.participants.includes(currentUserId) && c.participants.includes(otherUser.uid));
    if (existing) return existing;
    const conv = { id: uid('conv'), participants: [currentUserId, otherUser.uid], title: otherUser.fullName, otherUserId: otherUser.uid, lastMessage: '', updatedAt: new Date().toISOString() };
    demoConversations.unshift(conv); demoMessages[conv.id] = []; return conv;
  }
  const existingSnap = await getDocs(query(collection(db, C.conversations), where('participants', 'array-contains', currentUserId), limit(50)));
  const existing = existingSnap.docs.find(d => {
    const parts = d.data().participants || [];
    return parts.includes(otherUser.uid);
  });
  if (existing) return { id: existing.id, ...existing.data() };
  const added = await addDoc(collection(db, C.conversations), {
    participants: [currentUserId, otherUser.uid],
    participantNames: { [currentUserId]: '', [otherUser.uid]: otherUser.fullName },
    lastMessage: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
  return { id: added.id, participants: [currentUserId, otherUser.uid], title: otherUser.fullName, otherUserId: otherUser.uid };
}
