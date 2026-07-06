import { db, storage } from '../firebase-client.js';
import { SCHEMA, FIELD_ALIASES } from '../config/schema.js';
import { pick, uid, timestampToDate } from '../utils.js';
import { DEMO_USERS, DEMO_POSTS, DEMO_COMMENTS, DEMO_NOTIFICATIONS, DEMO_CONVERSATIONS, DEMO_MESSAGES } from './demo-data.js';
import {
  collection, collectionGroup, doc, addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, limit, serverTimestamp, increment, arrayUnion,
  writeBatch, getCountFromServer
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-storage.js';

const C = SCHEMA.collections;
const S = SCHEMA.subcollections;

const userProfileCache = new Map();

function likedCacheKey(userId) { return `tefsen_liked_${String(userId || 'guest')}`; }
function readLikedCache(userId) {
  try { return new Set(JSON.parse(localStorage.getItem(likedCacheKey(userId)) || '[]')); }
  catch { return new Set(); }
}
function writeLikedCache(userId, set) {
  try { localStorage.setItem(likedCacheKey(userId), JSON.stringify([...set].slice(-500))); }
  catch { /* storage can be unavailable in private contexts */ }
}
function updateLikedCache(userId, postId, active) {
  const cached = readLikedCache(userId);
  active ? cached.add(postId) : cached.delete(postId);
  writeLikedCache(userId, cached);
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return ['true', '1', 'yes', 'verified'].includes(value.trim().toLowerCase());
  return false;
}

function isAdminRole(role = '') {
  return String(role || '').trim().toLowerCase() === 'admin';
}

function resolveSubscription(raw = {}) {
  const nested = raw.subscription && typeof raw.subscription === 'object' ? raw.subscription : (raw.premiumSubscription && typeof raw.premiumSubscription === 'object' ? raw.premiumSubscription : {});
  const direct = toBoolean(pick(raw, FIELD_ALIASES.subscriptionActive, false)) || toBoolean(nested.active) || toBoolean(nested.isActive) || toBoolean(nested.subscribed);
  const status = String(pick(raw, FIELD_ALIASES.subscriptionStatus, '') || nested.status || '').trim().toLowerCase();
  const plan = String(pick(raw, FIELD_ALIASES.subscriptionPlan, '') || nested.plan || nested.tier || nested.productId || '').trim();
  const expiresAt = pick(raw, FIELD_ALIASES.subscriptionExpiresAt, null) || nested.expiresAt || nested.expiryDate || nested.endAt || null;
  const expiresDate = timestampToDate(expiresAt);
  const statusActive = ['active', 'trialing', 'trial', 'subscribed', 'premium', 'paid'].includes(status);
  const notExpired = expiresDate ? expiresDate.getTime() > Date.now() : false;
  return {
    active: Boolean(direct || statusActive || notExpired),
    status: status || (direct ? 'active' : ''),
    plan: plan || (direct || statusActive || notExpired ? 'Subscribed Student' : 'Free Student'),
    expiresAt
  };
}

export function getWebPostingPolicy(profile = {}) {
  const admin = isAdminRole(profile?.role);
  if (admin) {
    return {
      subscribed: true,
      admin: true,
      name: 'Admin Full Access',
      maxImagesPerPost: 2,
      maxTotalImageBytes: 6 * 1024 * 1024,
      dailyImagePosts: Infinity,
      dailyTextPosts: Infinity
    };
  }
  const subscribed = Boolean(profile?.subscriptionActive);
  return subscribed ? {
    subscribed: true,
    admin: false,
    name: 'Subscribed Student',
    maxImagesPerPost: 2,
    maxTotalImageBytes: 6 * 1024 * 1024,
    dailyImagePosts: 6,
    dailyTextPosts: Infinity
  } : {
    subscribed: false,
    admin: false,
    name: 'Free Student',
    maxImagesPerPost: 1,
    maxTotalImageBytes: 2 * 1024 * 1024,
    dailyImagePosts: 2,
    dailyTextPosts: 20
  };
}

function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function isWebPostForToday(post, dayKey) {
  const created = timestampToDate(post.createdAt);
  if (!created || utcDayKey(created) !== dayKey) return false;
  return post.webPost === true || String(post.sourcePlatform || '').toLowerCase() === 'web';
}

async function enrichPostAuthor(mode, post) {
  if (!post?.authorId) return post;
  try {
    const user = await getUserById(mode, post.authorId);
    if (!user) return post;
    return {
      ...post,
      authorName: user.fullName || post.authorName,
      authorPhotoUrl: user.photoUrl || post.authorPhotoUrl,
      role: user.role || post.role,
      verified: Boolean(user.verified || post.verified)
    };
  } catch {
    return post;
  }
}

async function enrichPostAuthors(mode, posts = []) {
  return Promise.all(posts.map(post => enrichPostAuthor(mode, post)));
}

async function enrichAuthorRecord(mode, item = {}) {
  const authorId = String(item.authorId || item.userId || item.uid || '');
  if (!authorId) return item;
  try {
    const user = await getUserById(mode, authorId);
    if (!user) return item;
    return {
      ...item,
      authorId,
      authorName: user.fullName || item.authorName || item.userName,
      authorPhotoUrl: user.photoUrl || item.authorPhotoUrl || item.profileImageUrl,
      authorRole: user.role || item.authorRole || item.role,
      role: user.role || item.role || item.authorRole,
      authorVerified: Boolean(user.verified || item.authorVerified || item.verified),
      verified: Boolean(user.verified || item.verified || item.authorVerified)
    };
  } catch {
    return item;
  }
}

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
const demoFollowing = new Set(JSON.parse(localStorage.getItem('tefsen_demo_following') || '[]'));

function persistDemo() {
  localStorage.setItem('tefsen_demo_posts', JSON.stringify(demoPosts.filter(p => String(p.id).startsWith('local-'))));
  localStorage.setItem('tefsen_demo_saved', JSON.stringify([...demoSaved]));
  localStorage.setItem('tefsen_demo_liked', JSON.stringify([...demoLiked]));
  localStorage.setItem('tefsen_demo_following', JSON.stringify([...demoFollowing]));
}

export function normalizeUser(raw = {}, id = '') {
  const subscription = resolveSubscription(raw);
  return {
    ...raw,
    id: id || raw.id || raw.uid || '',
    uid: raw.uid || id || raw.id || '',
    fullName: pick(raw, FIELD_ALIASES.userName, 'Tefsen User'),
    photoUrl: pick(raw, FIELD_ALIASES.userPhoto, ''),
    role: pick(raw, FIELD_ALIASES.userRole, 'Student'),
    verified: toBoolean(pick(raw, FIELD_ALIASES.userVerified, false)),
    subscriptionActive: subscription.active,
    subscriptionStatus: subscription.status,
    subscriptionPlan: subscription.plan,
    subscriptionExpiresAt: subscription.expiresAt,
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
  const primaryImage = pick(raw, FIELD_ALIASES.postImage, '');
  const rawImages = pick(raw, FIELD_ALIASES.postImages, []);
  const imageUrls = Array.isArray(rawImages) ? rawImages.filter(Boolean).slice(0, 2) : [];
  if (!imageUrls.length && primaryImage) imageUrls.push(primaryImage);
  return {
    ...raw,
    id: id || raw.id || '',
    title: pick(raw, FIELD_ALIASES.postTitle, ''),
    content: pick(raw, FIELD_ALIASES.postBody, ''),
    imageUrl: primaryImage || imageUrls[0] || '',
    imageUrls,
    authorId: pick(raw, FIELD_ALIASES.postAuthorId, ''),
    authorName: pick(raw, FIELD_ALIASES.postAuthorName, 'Tefsen User'),
    authorPhotoUrl: pick(raw, FIELD_ALIASES.postAuthorPhoto, ''),
    createdAt: pick(raw, FIELD_ALIASES.createdAt, null),
    likeCount: Array.isArray(likesValue) ? likesValue.length : Number(likesValue || 0),
    commentCount: Array.isArray(commentsValue) ? commentsValue.length : Number(commentsValue || 0),
    saveCount: Number(pick(raw, FIELD_ALIASES.saveCount, 0) || 0),
    subject: raw.subject || raw.category || raw.topic || 'General',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    role: raw.authorRole || raw.role || raw.userRole || 'Student',
    verified: toBoolean(raw.authorVerified) || toBoolean(raw.verified) || toBoolean(raw.isVerified) || toBoolean(raw.hasVerifiedBadge)
  };
}


export async function getUserById(mode, userId) {
  if (!userId) return null;
  const key = `${mode}:${userId}`;
  if (userProfileCache.has(key)) return userProfileCache.get(key);
  if (mode === 'demo') {
    const user = DEMO_USERS.find(u => u.uid === userId || u.id === userId);
    const normalized = user ? normalizeUser(user, userId) : null;
    if (normalized) userProfileCache.set(key, normalized);
    return normalized;
  }
  const snap = await getDoc(doc(db, C.users, userId));
  const normalized = snap.exists() ? normalizeUser(snap.data(), snap.id) : null;
  if (normalized) userProfileCache.set(key, normalized);
  return normalized;
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
    const rows = demoPosts.map(p => normalizePost(p, p.id)).sort((a,b) => (timestampToDate(b.createdAt)?.getTime() || 0) - (timestampToDate(a.createdAt)?.getTime() || 0));
    void enrichPostAuthors(mode, rows).then(callback).catch(() => callback(rows));
    return () => {};
  }
  let fallbackUnsub = null;
  const emit = rows => {
    void enrichPostAuthors(mode, rows).then(callback).catch(error => {
      console.warn('Post author enrichment failed:', error);
      callback(rows);
    });
  };
  const q = query(collection(db, C.posts), orderBy('createdAt', 'desc'), limit(50));
  const unsub = onSnapshot(q, snap => emit(snap.docs.map(d => normalizePost(d.data(), d.id))), err => {
    console.warn('Ordered posts listener failed; trying collection fallback.', err);
    try {
      fallbackUnsub = onSnapshot(query(collection(db, C.posts), limit(50)), snap => {
        const rows = snap.docs.map(d => normalizePost(d.data(), d.id));
        rows.sort((a,b) => (timestampToDate(b.createdAt)?.getTime() || 0) - (timestampToDate(a.createdAt)?.getTime() || 0));
        emit(rows);
      }, errorCallback);
    } catch (fallbackError) { errorCallback(fallbackError); }
  });
  return () => { unsub?.(); fallbackUnsub?.(); };
}

export async function getDailyPostUsage(mode, userId) {
  const dayKey = utcDayKey();
  if (!userId) return { dayKey, textPosts: 0, imagePosts: 0, totalPosts: 0 };

  if (mode === 'demo') {
    const rows = demoPosts.map(p => normalizePost(p, p.id)).filter(p => String(p.authorId) === String(userId) && isWebPostForToday(p, dayKey));
    const imagePosts = rows.filter(p => (p.imageUrls?.length || 0) > 0 || Boolean(p.imageUrl)).length;
    return { dayKey, imagePosts, textPosts: rows.length - imagePosts, totalPosts: rows.length };
  }

  const found = new Map();
  const collect = snap => snap.forEach(d => found.set(d.id, normalizePost(d.data(), d.id)));
  const queries = [
    query(collection(db, C.posts), where('authorId', '==', userId), limit(100)),
    query(collection(db, C.posts), where('userId', '==', userId), limit(100))
  ];
  const results = await Promise.allSettled(queries.map(qry => getDocs(qry)));
  let success = false;
  for (const result of results) {
    if (result.status === 'fulfilled') { success = true; collect(result.value); }
  }
  if (!success) {
    const error = new Error('Could not verify today\'s web posting limits. Please try again.');
    error.code = 'quota-check-failed';
    throw error;
  }
  const rows = [...found.values()].filter(p => isWebPostForToday(p, dayKey));
  const imagePosts = rows.filter(p => (p.imageUrls?.length || 0) > 0 || Boolean(p.imageUrl)).length;
  return { dayKey, imagePosts, textPosts: rows.length - imagePosts, totalPosts: rows.length };
}

export async function createPost(mode, user, profile, payload) {
  const policy = getWebPostingPolicy(profile);
  const imageFiles = (Array.isArray(payload.imageFiles) ? payload.imageFiles : [payload.imageFile]).filter(file => file && file.size);
  const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
  const totalImageBytes = imageFiles.reduce((sum, file) => sum + Number(file.size || 0), 0);

  if (imageFiles.length > policy.maxImagesPerPost) {
    throw new Error(`${policy.name} can add up to ${policy.maxImagesPerPost} image${policy.maxImagesPerPost === 1 ? '' : 's'} per post.`);
  }
  for (const file of imageFiles) {
    if (!allowedTypes.has(file.type)) throw new Error('Only PNG, JPG and WebP images are allowed.');
  }
  if (totalImageBytes > policy.maxTotalImageBytes) {
    throw new Error(`${policy.name} image uploads are limited to ${Math.round(policy.maxTotalImageBytes / 1024 / 1024)} MB total per post.`);
  }

  const usage = await getDailyPostUsage(mode, user.uid);
  const isImagePost = imageFiles.length > 0;
  if (isImagePost && usage.imagePosts >= policy.dailyImagePosts) {
    throw new Error(`Daily image-post limit reached (${policy.dailyImagePosts}). Try again tomorrow.`);
  }
  if (!isImagePost && Number.isFinite(policy.dailyTextPosts) && usage.textPosts >= policy.dailyTextPosts) {
    throw new Error(`Daily text-post limit reached (${policy.dailyTextPosts}). Try again tomorrow.`);
  }

  if (mode === 'demo') {
    const imageUrls = imageFiles.map(file => URL.createObjectURL(file));
    const post = normalizePost({
      id: `local-${uid('post')}`,
      authorId: user.uid,
      userId: user.uid,
      authorName: profile?.fullName || user.displayName || 'Tefsen User',
      authorPhotoUrl: profile?.photoUrl || user.photoURL || '',
      role: profile?.role || 'Student', verified: profile?.verified || false,
      title: payload.title, content: payload.content, subject: payload.subject,
      tags: payload.tags, imageUrl: imageUrls[0] || '', imageUrls,
      createdAt: new Date().toISOString(), likeCount: 0, commentCount: 0, saveCount: 0,
      webPost: true, sourcePlatform: 'web', webPlan: policy.admin ? 'admin' : (policy.subscribed ? 'subscribed' : 'free'),
      imageCount: imageUrls.length, totalImageBytes, quotaDay: usage.dayKey
    });
    demoPosts.unshift(post); persistDemo(); return post;
  }

  const imageUrls = [];
  for (const file of imageFiles) {
    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectRef = ref(storage, `post_images/${user.uid}/${Date.now()}-${uid('img')}-${cleanName}`);
    const upload = await uploadBytes(objectRef, file, { contentType: file.type });
    imageUrls.push(await getDownloadURL(upload.ref));
  }

  const base = {
    title: payload.title,
    questionTitle: payload.title,
    content: payload.content,
    description: payload.content,
    subject: payload.subject || 'General',
    tags: payload.tags || [],
    imageUrl: imageUrls[0] || '',
    imageUrls,
    imageCount: imageUrls.length,
    totalImageBytes,
    authorId: user.uid,
    userId: user.uid,
    authorName: profile?.fullName || user.displayName || 'Tefsen User',
    authorPhotoUrl: profile?.photoUrl || user.photoURL || '',
    authorRole: profile?.role || 'Student',
    authorVerified: Boolean(profile?.verified),
    type: 'question',
    status: 'published',
    sourcePlatform: 'web',
    webPost: true,
    webPlan: policy.admin ? 'admin' : (policy.subscribed ? 'subscribed' : 'free'),
    quotaDay: usage.dayKey,
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
  if (mode === 'demo') return enrichPostAuthor(mode, normalizePost(demoPosts.find(p => p.id === postId) || {}, postId));
  const snap = await getDoc(doc(db, C.posts, postId));
  return snap.exists() ? enrichPostAuthor(mode, normalizePost(snap.data(), snap.id)) : null;
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
  const actorSnap = await getDoc(doc(db, C.users, userId));
  const actorRole = actorSnap.exists() ? pick(actorSnap.data(), FIELD_ALIASES.userRole, '') : '';
  const actorIsAdmin = isAdminRole(actorRole);
  if ((!ownerId || ownerId !== String(userId)) && !actorIsAdmin) {
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


export async function getFollowState(mode, currentUserId, targetUserId) {
  if (!targetUserId) return { following: false, followersCount: 0, followingCount: 0 };
  if (mode === 'demo') {
    const target = normalizeUser(DEMO_USERS.find(u => String(u.uid || u.id) === String(targetUserId)) || {}, targetUserId);
    return {
      following: Boolean(currentUserId && currentUserId !== targetUserId && demoFollowing.has(String(targetUserId))),
      followersCount: Math.max(0, Number(target.followersCount || 0) + (demoFollowing.has(String(targetUserId)) ? 1 : 0)),
      followingCount: Math.max(0, Number(target.followingCount || 0))
    };
  }

  const targetRef = doc(db, C.users, targetUserId);
  const followersRef = collection(targetRef, S.followers);
  const followingRef = collection(targetRef, S.following);
  const ownFollowerRef = currentUserId ? doc(targetRef, S.followers, currentUserId) : null;

  const [followersAgg, followingAgg, ownSnap] = await Promise.all([
    getCountFromServer(followersRef).catch(() => null),
    getCountFromServer(followingRef).catch(() => null),
    ownFollowerRef ? getDoc(ownFollowerRef).catch(() => null) : Promise.resolve(null)
  ]);

  return {
    following: Boolean(ownSnap?.exists?.()),
    followersCount: Number(followersAgg?.data?.().count || 0),
    followingCount: Number(followingAgg?.data?.().count || 0)
  };
}

export async function toggleFollow(mode, currentUserId, targetUserId) {
  if (!currentUserId || !targetUserId) throw new Error('Missing user ID.');
  if (String(currentUserId) === String(targetUserId)) throw new Error('You cannot follow yourself.');

  if (mode === 'demo') {
    const key = String(targetUserId);
    const active = demoFollowing.has(key);
    active ? demoFollowing.delete(key) : demoFollowing.add(key);
    persistDemo();
    return !active;
  }

  const followerRef = doc(db, C.users, targetUserId, S.followers, currentUserId);
  const followingRef = doc(db, C.users, currentUserId, S.following, targetUserId);
  const existing = await getDoc(followerRef);
  const active = existing.exists();
  const batch = writeBatch(db);

  if (active) {
    batch.delete(followerRef);
    batch.delete(followingRef);
  } else {
    const stamp = serverTimestamp();
    batch.set(followerRef, { uid: currentUserId, followerId: currentUserId, createdAt: stamp });
    batch.set(followingRef, { uid: targetUserId, targetUserId, createdAt: stamp });
  }

  await batch.commit();
  return !active;
}

export async function getReactionIds(mode, userId) {
  if (!userId) return { saved: new Set(), liked: new Set() };
  if (mode === 'demo') return { saved: new Set(demoSaved), liked: new Set(demoLiked) };
  const saved = new Set();
  // Seed from local cache so the heart state survives refresh even when a
  // collection-group query is temporarily blocked by rules/indexing.
  const liked = readLikedCache(userId);
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
    writeLikedCache(userId, liked);
  } catch (e) { console.warn('Liked posts unavailable; using local cache:', e); }
  return { saved, liked };
}

export async function hydratePostLikeState(mode, userId, postIds = []) {
  const ids = [...new Set((postIds || []).map(id => String(id || '').trim()).filter(Boolean))].slice(0, 20);
  const liked = readLikedCache(userId);
  const counts = new Map();
  if (!userId || !ids.length) return { liked, counts };

  if (mode === 'demo') {
    for (const postId of ids) {
      if (demoLiked.has(postId)) liked.add(postId); else liked.delete(postId);
      const post = demoPosts.find(row => row.id === postId);
      counts.set(postId, Math.max(0, Number(post?.likeCount || 0)));
    }
    return { liked, counts };
  }

  await Promise.allSettled(ids.map(async postId => {
    const likeRef = doc(db, C.posts, postId, S.likes, userId);
    const likesRef = collection(db, C.posts, postId, S.likes);
    const [mine, aggregate] = await Promise.allSettled([
      getDoc(likeRef),
      getCountFromServer(likesRef)
    ]);

    if (mine.status === 'fulfilled') {
      if (mine.value.exists()) liked.add(postId); else liked.delete(postId);
    }
    if (aggregate.status === 'fulfilled') {
      counts.set(postId, Math.max(0, Number(aggregate.value.data().count || 0)));
    }
  }));

  writeLikedCache(userId, liked);
  return { liked, counts };
}

export async function toggleLike(mode, userId, postId) {
  if (mode === 'demo') {
    const post = demoPosts.find(p => p.id === postId);
    const active = demoLiked.has(postId);
    if (active) demoLiked.delete(postId); else demoLiked.add(postId);
    if (post) post.likeCount = Math.max(0, Number(post.likeCount || 0) + (active ? -1 : 1));
    persistDemo();
    return { liked: !active, count: Math.max(0, Number(post?.likeCount || 0)) };
  }

  const likeRef = doc(db, C.posts, postId, S.likes, userId);
  const likesRef = collection(db, C.posts, postId, S.likes);
  const postRef = doc(db, C.posts, postId);
  const snap = await getDoc(likeRef);
  const liked = !snap.exists();

  // The like document is the source of truth. Keep this write independent
  // from the denormalized post counter so stricter post-update rules do not
  // make a valid like disappear after refresh.
  if (liked) {
    await setDoc(likeRef, { userId, createdAt: serverTimestamp() });
  } else {
    await deleteDoc(likeRef);
  }
  updateLikedCache(userId, postId, liked);

  let exactCount = null;
  try {
    const aggregate = await getCountFromServer(likesRef);
    exactCount = Math.max(0, Number(aggregate.data().count || 0));
    // Best effort only: older Android clients may still read likeCount.
    await updateDoc(postRef, { likeCount: exactCount }).catch(() => {});
  } catch (error) {
    // Fall back to a counter increment, but never roll back the real like doc.
    await updateDoc(postRef, { likeCount: increment(liked ? 1 : -1) }).catch(() => {});
  }

  return { liked, count: exactCount };
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
  const emit = rows => {
    void Promise.all(rows.map(item => enrichAuthorRecord(mode, item))).then(callback).catch(() => callback(rows));
  };
  return onSnapshot(query(commentsRef, orderBy('createdAt', 'asc'), limit(100)), snap => {
    emit(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, err => {
    console.warn('Ordered comments listener failed:', err);
    onSnapshot(query(commentsRef, limit(100)), snap => emit(snap.docs.map(d => ({ id: d.id, ...d.data() }))), errorCallback);
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
  const cleanText = String(text || '').trim().slice(0, 3000);
  if (!cleanText) throw new Error('Message cannot be empty.');
  if (mode === 'demo') {
    const item = { id: uid('message'), senderId: userId, text: cleanText, createdAt: new Date().toISOString() };
    demoMessages[conversationId] = [...(demoMessages[conversationId] || []), item];
    const conv = demoConversations.find(c => c.id === conversationId); if (conv) { conv.lastMessage = cleanText; conv.updatedAt = item.createdAt; }
    return item;
  }
  const message = { senderId: userId, text: cleanText, createdAt: serverTimestamp() };
  const added = await addDoc(collection(db, C.conversations, conversationId, S.messages), message);
  await updateDoc(doc(db, C.conversations, conversationId), { lastMessage: cleanText, updatedAt: serverTimestamp() }).catch(() => {});
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
  const enrichedPosts = await enrichPostAuthors(mode, posts.slice(0, 30));
  return { users: users.slice(0, 20), posts: enrichedPosts };
}

export async function updateUserProfile(mode, userId, data) {
  if (mode === 'demo') {
    const base = DEMO_USERS.find(u => u.uid === userId) || {};
    Object.assign(base, data); return normalizeUser(base, userId);
  }
  const fullName = String(data.fullName || '').trim().slice(0, 80);
  const username = String(data.username || '').trim().replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40);
  const bio = String(data.bio || '').trim().slice(0, 500);
  if (!fullName) throw new Error('Full name is required.');
  const payload = {
    fullName,
    displayName: fullName,
    username,
    bio,
    updatedAt: serverTimestamp()
  };
  await setDoc(doc(db, C.users, userId), payload, { merge: true });
  userProfileCache.delete(`${mode}:${userId}`);
  return normalizeUser({ ...data, ...payload, uid: userId }, userId);
}

export async function reportPost(mode, userId, postId, reason, details = '') {
  const allowedReasons = new Set(['Spam', 'Harassment', 'Harmful or unsafe content', 'Misinformation concern', 'Copyright concern', 'Other']);
  const cleanReason = String(reason || '').trim();
  const cleanDetails = String(details || '').trim().slice(0, 1000);
  if (!allowedReasons.has(cleanReason)) throw new Error('Choose a valid report reason.');
  if (mode === 'demo') return { id: uid('report') };
  return addDoc(collection(db, C.reports), { reporterId: userId, postId, reason: cleanReason, details: cleanDetails, status: 'open', createdAt: serverTimestamp() });
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
