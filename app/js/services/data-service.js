import { auth, db, storage } from '../firebase-client.js';
import { SCHEMA, FIELD_ALIASES } from '../config/schema.js';
import { pick, uid, timestampToDate } from '../utils.js';
import { DEMO_USERS, DEMO_POSTS, DEMO_COMMENTS } from './demo-data.js';
import { isPublicProfileActivity, projectPublicUser, validatePublicProfileDraft } from './public-profile-service.js';
import { buildPublicProfileRecord, normalizePublicProfileRecord } from './public-profile-record-service.js';
import { validateSuccessStoryDraft } from './success-story-service.js';
import { validateJourneyStoryDraft } from './journey-story-service.js';
import { normalizeUserSettings, readSettingsCache, writeSettingsCache } from './settings-service.js';
import { mergeNotificationReadIds, notificationReadStatePayload, mergeActivityNotificationRecords } from './notification-state-service.js';
import {
  collection, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, writeBatch,
  onSnapshot, query, where, limit, serverTimestamp, documentId
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-storage.js';

const C = SCHEMA.collections;
const S = SCHEMA.subcollections;
const ALLOWED_ROLES = new Set(['student', 'HS_STUDENT', 'UNI_STUDENT', 'MENTOR', 'ADMIN']);
const userProfileCache = new Map();
const SEARCH_USER_SCAN_LIMIT = 250;
const SEARCH_POST_SCAN_LIMIT = 300;

function likedCacheKey(userId) {
  return `tefsen_liked_${String(userId || 'guest')}`;
}

function readLikedCache(userId) {
  try {
    return new Set(JSON.parse(localStorage.getItem(likedCacheKey(userId)) || '[]'));
  } catch {
    return new Set();
  }
}

function writeLikedCache(userId, values) {
  try {
    localStorage.setItem(likedCacheKey(userId), JSON.stringify([...values].slice(-500)));
  } catch {
    // localStorage may be unavailable in private contexts.
  }
}

function updateLikedCache(userId, postId, active) {
  const liked = readLikedCache(userId);
  active ? liked.add(String(postId)) : liked.delete(String(postId));
  writeLikedCache(userId, liked);
}

function savedCacheKey(userId) {
  return `tefsen_saved_posts_${String(userId || 'guest')}`;
}

function readSavedCache(userId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(savedCacheKey(userId)) || '{}');
    if (Array.isArray(parsed)) {
      return new Map(parsed.map(id => [String(id), 0]));
    }
    return new Map(Object.entries(parsed || {}).map(([id,millis]) => [
      String(id),
      Math.max(0, Number(millis || 0))
    ]));
  } catch {
    return new Map();
  }
}

function writeSavedCache(userId, values) {
  try {
    const entries = [...values.entries()]
      .filter(([id]) => Boolean(id))
      .slice(-500);
    localStorage.setItem(savedCacheKey(userId), JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // localStorage may be unavailable in private contexts.
  }
}

function updateSavedCache(userId, postId, active, savedAtMillis = Date.now()) {
  const saved = readSavedCache(userId);
  active ? saved.set(String(postId), Math.max(0, Number(savedAtMillis || Date.now()))) : saved.delete(String(postId));
  writeSavedCache(userId, saved);
}

function savedReferenceCollection(userId) {
  return collection(db, C.users, String(userId), S.savedPosts || 'savedPosts');
}

function userSettingsDocument(userId) {
  return doc(db, C.users, String(userId), 'settings', 'preferences');
}

function publicProfileDocument(userId) {
  return doc(db, C.publicProfiles, String(userId));
}

function publicProfileWritePayload(userId, source = {}) {
  return {
    ...buildPublicProfileRecord(userId, source),
    updatedAt:serverTimestamp()
  };
}

async function syncOwnPublicProfile(mode, userId, source = {}) {
  if (!userId || mode === 'demo') return;
  try {
    await setDoc(
      publicProfileDocument(userId),
      publicProfileWritePayload(userId, source),
      { merge:true }
    );
  } catch {
    // The private account remains usable while production public-profile rules
    // are being deployed. Public discovery will not fall back to private users.
  }
}

export async function getUserSettings(mode, userId) {
  const cached = readSettingsCache(userId);
  if (!userId) return cached;
  if (mode === 'demo') return cached;

  try {
    const snap = await getDoc(userSettingsDocument(userId));
    const settings = normalizeUserSettings(snap.exists() ? snap.data() : {});
    writeSettingsCache(userId, settings);
    return settings;
  } catch {
    return cached;
  }
}

export async function saveUserSettings(mode, userId, draft = {}) {
  if (!userId) throw new Error('Sign in to save settings.');
  const settings = normalizeUserSettings(draft);

  if (mode === 'demo') {
    writeSettingsCache(userId, settings);
    return settings;
  }

  await setDoc(userSettingsDocument(userId), {
    ...settings,
    uid:String(userId),
    userId:String(userId),
    documentType:'preferences',
    updatedAt:serverTimestamp()
  });

  writeSettingsCache(userId, settings);
  return settings;
}

async function getSavedPostReferences(mode, userId) {
  const cached = readSavedCache(userId);
  if (!userId) return [];

  if (mode === 'demo') {
    return [...cached.entries()].map(([postId, savedAtMillis]) => ({ postId, savedAtMillis }));
  }

  try {
    const snap = await getDocs(query(savedReferenceCollection(userId), limit(500)));
    const refs = snap.docs.map(row => {
      const raw = row.data() || {};
      const savedAtMillis = Number(raw.savedAtMillis || timestampToDate(raw.savedAt)?.getTime() || timestampToDate(raw.createdAt)?.getTime() || 0);
      return {
        postId:String(raw.postId || row.id),
        savedAtMillis:Math.max(0,savedAtMillis)
      };
    }).filter(row => row.postId);

    const next = new Map(refs.map(row => [row.postId,row.savedAtMillis]));
    writeSavedCache(userId,next);
    return refs;
  } catch {
    return [...cached.entries()].map(([postId, savedAtMillis]) => ({ postId, savedAtMillis }));
  }
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'verified'].includes(value.trim().toLowerCase());
  }
  return false;
}

function normalizeRoleValue(role, email = '') {
  const raw = String(role || '').trim();
  if (ALLOWED_ROLES.has(raw)) return raw;
  if (raw.toLowerCase() === 'admin') return 'ADMIN';
  if (raw.toLowerCase() === 'hs_student') return 'HS_STUDENT';
  if (raw.toLowerCase() === 'uni_student') return 'UNI_STUDENT';
  if (raw.toLowerCase() === 'mentor') return 'MENTOR';
  if (String(email || '').trim().toLowerCase() === 'jsandresjr@gmail.com') return 'ADMIN';
  return 'student';
}

function isAdminRole(role = '') {
  return String(role || '').trim().toLowerCase() === 'admin';
}

function resolveSubscription(raw = {}) {
  const nested = raw.subscription && typeof raw.subscription === 'object'
    ? raw.subscription
    : (raw.premiumSubscription && typeof raw.premiumSubscription === 'object' ? raw.premiumSubscription : {});
  const direct = toBoolean(pick(raw, FIELD_ALIASES.subscriptionActive, false))
    || toBoolean(nested.active)
    || toBoolean(nested.isActive)
    || toBoolean(nested.subscribed);
  const status = String(pick(raw, FIELD_ALIASES.subscriptionStatus, '') || nested.status || '').trim().toLowerCase();
  const plan = String(pick(raw, FIELD_ALIASES.subscriptionPlan, '') || nested.plan || nested.tier || nested.productId || '').trim();
  const expiresAt = pick(raw, FIELD_ALIASES.subscriptionExpiresAt, null)
    || nested.expiresAt
    || nested.expiryDate
    || nested.endAt
    || null;
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
  if (subscribed) {
    return {
      subscribed: true,
      admin: false,
      name: 'Subscribed Student',
      maxImagesPerPost: 2,
      maxTotalImageBytes: 6 * 1024 * 1024,
      dailyImagePosts: 6,
      dailyTextPosts: Infinity
    };
  }

  return {
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

export function normalizeUser(raw = {}, id = '') {
  const subscription = resolveSubscription(raw);
  const email = raw.email || '';
  return {
    ...raw,
    id: id || raw.id || raw.uid || '',
    uid: raw.uid || id || raw.id || '',
    fullName: pick(raw, FIELD_ALIASES.userName, 'Tefsen User'),
    photoUrl: pick(raw, FIELD_ALIASES.userPhoto, ''),
    role: normalizeRoleValue(pick(raw, FIELD_ALIASES.userRole, 'student'), email),
    verified: toBoolean(pick(raw, FIELD_ALIASES.userVerified, false)),
    subscriptionActive: subscription.active,
    subscriptionStatus: subscription.status,
    subscriptionPlan: subscription.plan,
    subscriptionExpiresAt: subscription.expiresAt,
    username: raw.username || raw.handle || '',
    bio: raw.bio || raw.about || ''
  };
}

function cleanPublicText(value, max = 180) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function isSaveablePublicPost(mode, post) {
  if (!post) return false;
  if (mode === 'demo') return isPublicProfileActivity(post);
  return String(post.status || '').toLowerCase() === 'published'
    && String(post.visibility || '').toLowerCase() === 'public';
}

function normalizePublicPostMetadata(raw = {}) {
  const allowedTypes = new Set(['discussion', 'success_story', 'journey_story']);
  const postType = allowedTypes.has(raw.postType) ? raw.postType : 'discussion';
  const successRaw = raw.successData && typeof raw.successData === 'object' ? raw.successData : {};
  const successData = postType === 'success_story' ? {
    university: cleanPublicText(successRaw.university, 180),
    opportunityName: cleanPublicText(successRaw.opportunityName, 180),
    country: cleanPublicText(successRaw.country, 120),
    subject: cleanPublicText(successRaw.subject, 120),
    studyLevel: cleanPublicText(successRaw.studyLevel, 100),
    intake: cleanPublicText(successRaw.intake, 80),
    fundingType: cleanPublicText(successRaw.fundingType, 100)
  } : {};

  const milestoneSource = Array.isArray(raw.publicMilestones) ? raw.publicMilestones : [];
  const publicMilestones = postType === 'journey_story'
    ? milestoneSource.slice(0, 8).map(item => ({
        stage: cleanPublicText(item?.stage, 80),
        month: cleanPublicText(item?.month, 20),
        note: cleanPublicText(item?.note, 300)
      })).filter(item => item.stage || item.note)
    : [];

  const communityUniversity = cleanPublicText(
    raw.communityUniversity || successData.university,
    180
  );
  const communityIntake = cleanPublicText(
    raw.communityIntake || successData.intake,
    80
  );
  const communitySubject = cleanPublicText(
    raw.communitySubject || successData.subject || raw.subject,
    120
  );

  return { postType, successData, publicMilestones, communityUniversity, communityIntake, communitySubject };
}

export function normalizePost(raw = {}, id = '') {
  const likesValue = pick(raw, FIELD_ALIASES.likeCount, 0);
  const commentsValue = pick(raw, FIELD_ALIASES.commentCount, 0);
  const primaryImage = pick(raw, FIELD_ALIASES.postImage, '');
  const rawImages = pick(raw, FIELD_ALIASES.postImages, []);
  const imageUrls = Array.isArray(rawImages) ? rawImages.filter(Boolean).slice(0, 2) : [];
  if (!imageUrls.length && primaryImage) imageUrls.push(primaryImage);
  const publicMetadata = normalizePublicPostMetadata(raw);

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
    ...publicMetadata,
    role: normalizeRoleValue(raw.authorRole || raw.role || raw.userRole || 'student'),
    verified: toBoolean(raw.authorVerified)
      || toBoolean(raw.verified)
      || toBoolean(raw.isVerified)
      || toBoolean(raw.hasVerifiedBadge)
  };
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

let demoPosts = [...DEMO_POSTS];
let demoComments = structuredClone(DEMO_COMMENTS);

export async function getUserById(mode, userId) {
  if (!userId) return null;
  const key = `${mode}:${userId}`;
  if (userProfileCache.has(key)) return userProfileCache.get(key);

  if (mode === 'demo') {
    const user = DEMO_USERS.find(row => row.uid === userId || row.id === userId);
    const normalized = user ? projectPublicUser(normalizeUser(user, userId), userId) : null;
    if (normalized) userProfileCache.set(key, normalized);
    return normalized;
  }

  const snap = await getDoc(publicProfileDocument(userId));
  const normalized = snap.exists()
    ? projectPublicUser(normalizePublicProfileRecord(snap.data(), snap.id), snap.id)
    : null;
  if (normalized) userProfileCache.set(key, normalized);
  return normalized;
}

export async function getProfile(mode, user) {
  if (!user) return null;
  if (mode === 'demo') {
    return normalizeUser(DEMO_USERS.find(row => row.uid === user.uid) || user, user.uid);
  }

  const snap = await getDoc(doc(db, C.users, user.uid));
  const fallback = {
    uid: user.uid,
    fullName: user.displayName || 'Tefsen User',
    email: user.email || '',
    profileImageUrl: user.photoURL || '',
    role: normalizeRoleValue('', user.email || '')
  };
  const profile=normalizeUser(snap.exists() ? { ...fallback, ...snap.data() } : fallback, user.uid);
  await syncOwnPublicProfile(mode,user.uid,profile);
  return profile;
}

export function subscribePosts(mode, callback, errorCallback = console.error) {
  if (mode === 'demo') {
    const rows = demoPosts
      .map(post => normalizePost(post, post.id))
      .filter(post => post.status !== 'hidden')
      .sort((a, b) => (timestampToDate(b.createdAt)?.getTime() || 0) - (timestampToDate(a.createdAt)?.getTime() || 0));
    void enrichPostAuthors(mode, rows).then(callback).catch(() => callback(rows));
    return () => {};
  }

  const q = query(
    collection(db, C.posts),
    where('status', '==', 'published'),
    where('visibility', '==', 'public'),
    limit(50)
  );

  return onSnapshot(q, snap => {
    const rows = snap.docs
      .map(row => normalizePost(row.data(), row.id))
      .sort((a, b) => (timestampToDate(b.createdAt)?.getTime() || 0) - (timestampToDate(a.createdAt)?.getTime() || 0));
    void enrichPostAuthors(mode, rows).then(callback).catch(() => callback(rows));
  }, errorCallback);
}

export async function getDailyPostUsage(mode, userId) {
  const dayKey = utcDayKey();
  if (!userId) return { dayKey, textPosts: 0, imagePosts: 0, totalPosts: 0 };

  if (mode === 'demo') {
    const rows = demoPosts
      .map(post => normalizePost(post, post.id))
      .filter(post => String(post.authorId) === String(userId) && isWebPostForToday(post, dayKey));
    const imagePosts = rows.filter(post => (post.imageUrls?.length || 0) > 0 || Boolean(post.imageUrl)).length;
    return { dayKey, imagePosts, textPosts: rows.length - imagePosts, totalPosts: rows.length };
  }

  const q = query(
    collection(db, C.posts),
    where('authorId', '==', userId),
    where('status', '==', 'published'),
    where('visibility', '==', 'public'),
    limit(100)
  );
  const snap = await getDocs(q);
  const rows = snap.docs
    .map(row => normalizePost(row.data(), row.id))
    .filter(post => isWebPostForToday(post, dayKey));
  const imagePosts = rows.filter(post => (post.imageUrls?.length || 0) > 0 || Boolean(post.imageUrl)).length;
  return { dayKey, imagePosts, textPosts: rows.length - imagePosts, totalPosts: rows.length };
}

export async function createPost(mode, user, profile, payload) {
  const policy = getWebPostingPolicy(profile);

  if (String(payload?.postType || '') === 'success_story') {
    const draft = validateSuccessStoryDraft({
      title:payload.title,
      content:payload.content,
      ...(payload.successData || {})
    });
    if (!draft.valid) {
      throw new Error(draft.errors[0]?.message || 'Check the success story before publishing.');
    }
    payload = {
      ...payload,
      title:draft.value.title,
      content:draft.value.content,
      subject:draft.value.subject || 'Student Success',
      successData:{
        university:draft.value.university,
        opportunityName:draft.value.opportunityName,
        country:draft.value.country,
        subject:draft.value.subject,
        studyLevel:draft.value.studyLevel,
        intake:draft.value.intake,
        fundingType:draft.value.fundingType
      },
      communityUniversity:draft.value.university,
      communityIntake:draft.value.intake,
      communitySubject:draft.value.subject
    };
  }

  if (String(payload?.postType || '') === 'journey_story') {
    const draft = validateJourneyStoryDraft({
      title:payload.title,
      content:payload.content,
      subject:payload.communitySubject || payload.subject,
      university:payload.communityUniversity,
      intake:payload.communityIntake,
      publicMilestones:payload.publicMilestones
    });
    if (!draft.valid) {
      throw new Error(draft.errors[0]?.message || 'Check the Journey story before publishing.');
    }
    payload = {
      ...payload,
      title:draft.value.title,
      content:draft.value.content,
      subject:draft.value.subject || 'Student Journey',
      publicMilestones:draft.value.publicMilestones,
      communitySubject:draft.value.subject,
      communityUniversity:draft.value.university,
      communityIntake:draft.value.intake
    };
  }

  const publicMetadata = normalizePublicPostMetadata(payload);
  const imageFiles = (Array.isArray(payload.imageFiles) ? payload.imageFiles : [payload.imageFile])
    .filter(file => file && file.size);
  const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
  const totalImageBytes = imageFiles.reduce((sum, file) => sum + Number(file.size || 0), 0);

  if (imageFiles.length > policy.maxImagesPerPost) {
    throw new Error(`${policy.name} can add up to ${policy.maxImagesPerPost} image${policy.maxImagesPerPost === 1 ? '' : 's'} per post.`);
  }
  for (const file of imageFiles) {
    if (!allowedTypes.has(file.type)) throw new Error('Only PNG, JPG and WebP images are allowed.');
    if (file.size >= 10 * 1024 * 1024) throw new Error('Each image must be smaller than 10 MB.');
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
    const local = normalizePost({
      id: `local-${uid('post')}`,
      authorId: user.uid,
      userId: user.uid,
      authorName: profile?.fullName || user.displayName || 'Tefsen User',
      authorPhotoUrl: profile?.photoUrl || user.photoURL || '',
      authorRole: profile?.role || 'student',
        title: payload.title,
      content: payload.content,
      subject: payload.subject || 'General',
      tags: payload.tags || [],
      ...publicMetadata,
      imageUrl: imageUrls[0] || '',
      imageUrls,
      status: 'published',
      visibility: 'public',
      sourcePlatform: 'web',
      webPost: true,
      createdAt: new Date().toISOString(),
      likeCount: 0,
      commentCount: 0
    });
    demoPosts.unshift(local);
    return local;
  }

  const postRef = doc(collection(db, C.posts));
  const imageUrls = [];
  for (const file of imageFiles) {
    const cleanName = String(file.name || 'image').replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectRef = ref(
      storage,
      `post_images/${user.uid}/${postRef.id}/${Date.now()}-${uid('img')}-${cleanName}`
    );
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
    ...publicMetadata,
    imageUrl: imageUrls[0] || '',
    imageUrls,
    imageCount: imageUrls.length,
    totalImageBytes,
    authorId: user.uid,
    firebaseUid: user.uid,
    userId: user.uid,
    authorName: profile?.fullName || user.displayName || 'Tefsen User',
    authorPhotoUrl: profile?.photoUrl || user.photoURL || '',
    type: 'question',
    status: 'published',
    visibility: 'public',
    sourcePlatform: 'web',
    webPost: true,
    likeCount: 0,
    commentCount: 0,
    answerCount: 0,
    saveCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(postRef, base);
  return normalizePost(base, postRef.id);
}

export async function getPost(mode, postId) {
  if (mode === 'demo') {
    const post = demoPosts.find(row => String(row.id) === String(postId));
    return post ? enrichPostAuthor(mode, normalizePost(post, postId)) : null;
  }
  const snap = await getDoc(doc(db, C.posts, postId));
  return snap.exists() ? enrichPostAuthor(mode, normalizePost(snap.data(), snap.id)) : null;
}

async function getPublicPostById(mode, postId) {
  const canonicalPostId=String(postId || '');
  if(!canonicalPostId) return null;

  if(mode === 'demo'){
    const post=demoPosts.find(row=>String(row.id)===canonicalPostId);
    if(!post) return null;
    const normalized=normalizePost(post,canonicalPostId);
    return isSaveablePublicPost(mode,normalized)
      ? enrichPostAuthor(mode,normalized)
      : null;
  }

  const snap=await getDocs(query(
    collection(db,C.posts),
    where(documentId(),'==',canonicalPostId),
    where('status','==','published'),
    where('visibility','==','public'),
    limit(1)
  ));
  if(snap.empty) return null;
  const row=snap.docs[0];
  return enrichPostAuthor(mode,normalizePost(row.data(),row.id));
}

export async function deletePost(mode, userId, postId) {
  if (!userId || !postId) throw new Error('Missing user or post ID.');
  if (mode === 'demo') {
    demoPosts = demoPosts.filter(post => String(post.id) !== String(postId));
    delete demoComments[postId];
    return true;
  }
  await deleteDoc(doc(db, C.posts, String(postId)));
  return true;
}

export async function getReactionIds(mode, userId) {
  if (!userId) return { saved: new Set(), liked: new Set() };
  const refs = await getSavedPostReferences(mode,userId);
  return {
    saved:new Set(refs.map(row=>row.postId)),
    liked:readLikedCache(userId)
  };
}

export async function getSavedCommunityPosts(mode, userId, knownPosts = []) {
  if (!userId) return { posts:[], savedIds:[], referenceCount:0, staleCount:0 };

  const refs = await getSavedPostReferences(mode,userId);
  const known = new Map(
    (Array.isArray(knownPosts)?knownPosts:[])
      .filter(post=>post?.id)
      .map(post=>[String(post.id),post])
  );

  const rows = await Promise.all(refs.slice(0,100).map(async refRow => {
    const postId=String(refRow.postId||'');
    if(!postId) return null;

    let post=known.get(postId)||null;
    if(!post){
      post=await getPublicPostById(mode,postId).catch(()=>null);
    }
    if(!post || !isSaveablePublicPost(mode,post)) return null;

    return {
      ...post,
      _savedAtMillis:Math.max(0,Number(refRow.savedAtMillis||0))
    };
  }));

  const posts=rows.filter(Boolean);
  return {
    posts,
    savedIds:refs.map(row=>row.postId),
    referenceCount:refs.length,
    staleCount:Math.max(0,refs.length-posts.length)
  };
}

export async function hydratePostLikeState(mode, userId, postIds = []) {
  const ids = [...new Set((postIds || []).map(value => String(value || '').trim()).filter(Boolean))].slice(0, 20);
  const liked = readLikedCache(userId);
  const counts = new Map();
  if (!userId || !ids.length || mode === 'demo') return { liked, counts };

  await Promise.allSettled(ids.map(async postId => {
    const likeRef = doc(db, C.posts, postId, S.likes, userId);
    const mine = await getDoc(likeRef);
    mine.exists() ? liked.add(postId) : liked.delete(postId);
  }));

  writeLikedCache(userId, liked);
  return { liked, counts };
}

export async function toggleLike(mode, userId, postId) {
  if (!userId || !postId) throw new Error('Missing user or post ID.');
  if (mode === 'demo') {
    const liked = readLikedCache(userId);
    const active = liked.has(postId);
    active ? liked.delete(postId) : liked.add(postId);
    writeLikedCache(userId, liked);
    return !active;
  }

  const likeRef = doc(db, C.posts, String(postId), S.likes, String(userId));
  const snap = await getDoc(likeRef);
  const active = snap.exists();

  if (active) {
    await deleteDoc(likeRef);
  } else {
    await setDoc(likeRef, {
      uid: String(userId),
      userId: String(userId),
      postId: String(postId),
      createdAt: serverTimestamp()
    });
  }

  updateLikedCache(userId, postId, !active);
  return !active;
}

export async function toggleSave(mode, userId, postId) {
  if (!userId || !postId) throw new Error('Missing user or post ID.');
  const canonicalPostId=String(postId);

  if (mode === 'demo') {
    const post=demoPosts.find(row=>String(row.id)===canonicalPostId);
    if(!post || !isSaveablePublicPost(mode,post)) throw new Error('Only public Community posts can be saved.');
    const saved=readSavedCache(userId);
    const active=saved.has(canonicalPostId);
    updateSavedCache(userId,canonicalPostId,!active,Date.now());
    return !active;
  }

  const saveRef=doc(db,C.users,String(userId),S.savedPosts || 'savedPosts',canonicalPostId);
  const snap=await getDoc(saveRef);
  const active=snap.exists();

  if(active){
    await deleteDoc(saveRef);
    updateSavedCache(userId,canonicalPostId,false);
    return false;
  }

  const post=await getPublicPostById(mode,canonicalPostId).catch(()=>null);
  if(!post || !isSaveablePublicPost(mode,post)) throw new Error('Only public Community posts can be saved.');

  const savedAtMillis=Date.now();
  await setDoc(saveRef,{
    uid:String(userId),
    userId:String(userId),
    postId:canonicalPostId,
    savedAt:serverTimestamp(),
    savedAtMillis
  });
  updateSavedCache(userId,canonicalPostId,true,savedAtMillis);
  return true;
}

export function subscribeComments(mode, postId, callback, errorCallback = console.error) {
  if (mode === 'demo') {
    callback((demoComments[postId] || []).map(item => ({ ...item })));
    return () => {};
  }

  const answersRef = collection(db, C.posts, String(postId), S.answers || 'answers');
  const q = query(
    answersRef,
    where('status', '==', 'published'),
    where('visibility', '==', 'public'),
    limit(100)
  );

  return onSnapshot(q, snap => {
    const rows = snap.docs
      .map(row => ({ id: row.id, ...row.data() }))
      .sort((a, b) => {
        const at = timestampToDate(a.createdAt)?.getTime() || Number(a.createdAtMillis || 0) || 0;
        const bt = timestampToDate(b.createdAt)?.getTime() || Number(b.createdAtMillis || 0) || 0;
        return at - bt;
      });
    void Promise.all(rows.map(item => enrichAuthorRecord(mode, item)))
      .then(callback)
      .catch(() => callback(rows));
  }, errorCallback);
}

export async function addComment(mode, user, profile, postId, text) {
  const cleanText = String(text || '').trim();
  if (!cleanText) throw new Error('Answer cannot be empty.');
  if (cleanText.length > 5000) throw new Error('Answer is too long.');

  if (mode === 'demo') {
    const item = {
      id: uid('answer'),
      authorId: user.uid,
      userId: user.uid,
      authorName: profile?.fullName || 'Tefsen User',
      authorPhotoUrl: profile?.photoUrl || user.photoURL || '',
      authorRole: profile?.role || 'student',
      authorVerified: Boolean(profile?.verified),
      content: cleanText,
      text: cleanText,
      status: 'published',
      visibility: 'public',
      createdAt: new Date().toISOString(),
      likeCount: 0
    };
    demoComments[postId] = [...(demoComments[postId] || []), item];
    return item;
  }

  const canonicalPostId = String(postId);
  const answerRef = doc(collection(db, C.posts, canonicalPostId, S.answers || 'answers'));
  const nowMillis = Date.now();
  const item = {
    id: answerRef.id,
    postId: canonicalPostId,
    questionId: canonicalPostId,
    parentPostId: canonicalPostId,
    authorId: String(user.uid),
    firebaseUid: String(user.uid),
    userId: String(user.uid),
    uid: String(user.uid),
    authorName: profile?.fullName || user.displayName || 'Tefsen User',
    authorPhotoUrl: profile?.photoUrl || user.photoURL || '',
    profileImageUrl: profile?.photoUrl || user.photoURL || '',
    authorVerified: Boolean(profile?.verified),
    content: cleanText,
    text: cleanText,
    answer: cleanText,
    reply: cleanText,
    type: 'answer',
    status: 'published',
    visibility: 'public',
    sourcePlatform: 'web',
    likeCount: 0,
    createdAtMillis: nowMillis,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(answerRef, item);
  return { ...item, createdAt: new Date(nowMillis).toISOString() };
}

function notificationReadKey(userId) {
  return `tefsen_notification_reads_${String(userId || 'guest')}`;
}

function writeNotificationReadIds(userId, values) {
  const ids = mergeNotificationReadIds(values);
  if (!userId) return ids;
  try {
    localStorage.setItem(notificationReadKey(userId), JSON.stringify([...ids]));
  } catch {
    // localStorage may be unavailable in private contexts.
  }
  return ids;
}

export function getNotificationReadIds(userId) {
  try {
    return mergeNotificationReadIds(JSON.parse(localStorage.getItem(notificationReadKey(userId)) || '[]'));
  } catch {
    return new Set();
  }
}

function notificationReadStateDocument(userId) {
  return doc(db, C.users, String(userId), 'notificationState', 'read');
}

export async function getSyncedNotificationReadIds(mode, userId) {
  const local = getNotificationReadIds(userId);
  if (!userId || mode === 'demo') return local;

  try {
    const snap = await getDoc(notificationReadStateDocument(userId));
    const remote = snap.exists() && Array.isArray(snap.data()?.readIds)
      ? snap.data().readIds
      : [];
    return writeNotificationReadIds(userId, mergeNotificationReadIds(local, remote));
  } catch {
    return local;
  }
}

async function persistNotificationReadState(mode, userId, values) {
  const ids = writeNotificationReadIds(userId, values);
  if (!userId || mode === 'demo') return ids;

  try {
    const payload = notificationReadStatePayload(userId, ids);
    await setDoc(notificationReadStateDocument(userId), {
      ...payload,
      updatedAt:serverTimestamp()
    }, { merge:true });
  } catch {
    // Local per-user read state remains authoritative until the private
    // notification-state rules are deployed.
  }
  return ids;
}

function normalizeNotificationRecord(raw = {}, id = '') {
  const createdAt = raw.createdAt || raw.timestamp || raw.updatedAt || null;
  const createdAtMillis = Number(
    raw.createdAtMillis ||
    timestampToDate(createdAt)?.getTime() ||
    0
  );
  return {
    ...raw,
    id:String(id || raw.id || ''),
    type:String(raw.type || raw.notificationType || 'update'),
    actorName:String(raw.actorName || raw.fromUserName || raw.senderName || ''),
    text:String(raw.text || raw.message || raw.body || ''),
    postId:String(raw.postId || raw.questionId || raw.parentPostId || ''),
    opportunityId:String(raw.opportunityId || ''),
    actorId:String(raw.actorId || raw.fromUserId || raw.senderId || ''),
    read:Boolean(raw.read || raw.isRead),
    createdAt,
    createdAtMillis,
    sortTime:createdAtMillis,
    source:'activity'
  };
}

async function notificationQueryByField(userId, fieldName) {
  try {
    const snap = await getDocs(query(
      collection(db, C.notifications),
      where(fieldName, '==', String(userId)),
      limit(80)
    ));
    return snap.docs.map(row => normalizeNotificationRecord(row.data(), row.id));
  } catch {
    return [];
  }
}

export async function getNotifications(mode, userId) {
  if (!userId || mode === 'demo') return [];

  // Production history can contain both canonical userId records and older
  // recipientId records for the same account. Query both shapes, then merge
  // and deduplicate by notification document ID.
  const [canonical, legacy] = await Promise.all([
    notificationQueryByField(userId, 'userId'),
    notificationQueryByField(userId, 'recipientId')
  ]);
  return mergeActivityNotificationRecords(canonical, legacy);
}

async function markActivityNotificationRead(notification = {}) {
  const id = String(notification?.id || '');
  const serverId = id.startsWith('activity:') ? id.slice('activity:'.length) : id;
  if (!serverId) return;

  try {
    await updateDoc(doc(db, C.notifications, serverId), {
      read:true,
      isRead:true,
      readAt:serverTimestamp(),
      updatedAt:serverTimestamp()
    });
  } catch {
    // Private account read-state still records the acknowledgement when a
    // legacy notification document is immutable under current production rules.
  }
}

export async function markNotificationsRead(mode, userId, notifications = []) {
  if (!userId) return false;
  const rows = (Array.isArray(notifications) ? notifications : [])
    .filter(row => row?.id);
  if (!rows.length) return true;

  const ids = mergeNotificationReadIds(
    getNotificationReadIds(userId),
    rows.map(row => String(row.id))
  );
  await persistNotificationReadState(mode, userId, ids);

  if (mode !== 'demo') {
    await Promise.all(rows
      .filter(row => row?.source === 'activity')
      .map(row => markActivityNotificationRead(row)));
  }
  return true;
}

export async function markNotificationRead(mode, userId, notification = {}) {
  if (!notification?.id) return false;
  return markNotificationsRead(mode, userId, [notification]);
}


export async function searchAll(mode, term) {
  const qText = String(term || '').trim().toLowerCase();
  if (!qText) {
    return {
      users: [],
      posts: [],
      coverage: {
        people:{ scanned:0, limit:SEARCH_USER_SCAN_LIMIT, complete:true },
        community:{ scanned:0, limit:SEARCH_POST_SCAN_LIMIT, complete:true }
      }
    };
  }

  if (mode === 'demo') {
    const users = DEMO_USERS
      .map(row => projectPublicUser(normalizeUser(row, row.uid || row.id), row.uid || row.id));
    const posts = demoPosts
      .map(post => normalizePost(post, post.id))
      .filter(isPublicProfileActivity);
    return {
      users,
      posts,
      coverage: {
        people:{ scanned:DEMO_USERS.length, limit:SEARCH_USER_SCAN_LIMIT, complete:true },
        community:{ scanned:demoPosts.filter(isPublicProfileActivity).length, limit:SEARCH_POST_SCAN_LIMIT, complete:true }
      }
    };
  }

  const [usersSnap, postsSnap] = await Promise.all([
    getDocs(query(collection(db, C.publicProfiles), limit(SEARCH_USER_SCAN_LIMIT + 1))),
    getDocs(query(
      collection(db, C.posts),
      where('status', '==', 'published'),
      where('visibility', '==', 'public'),
      limit(SEARCH_POST_SCAN_LIMIT + 1)
    ))
  ]);

  const userDocs = usersSnap.docs.slice(0, SEARCH_USER_SCAN_LIMIT);
  const postDocs = postsSnap.docs.slice(0, SEARCH_POST_SCAN_LIMIT);

  const users = userDocs
    .map(row => projectPublicUser(normalizePublicProfileRecord(row.data(), row.id), row.id));

  const posts = postDocs
    .map(row => normalizePost(row.data(), row.id))
    .filter(isPublicProfileActivity);

  return {
    users,
    posts: await enrichPostAuthors(mode, posts),
    coverage: {
      people:{
        scanned:userDocs.length,
        limit:SEARCH_USER_SCAN_LIMIT,
        complete:usersSnap.docs.length <= SEARCH_USER_SCAN_LIMIT
      },
      community:{
        scanned:postDocs.length,
        limit:SEARCH_POST_SCAN_LIMIT,
        complete:postsSnap.docs.length <= SEARCH_POST_SCAN_LIMIT
      }
    }
  };
}

export async function updateUserProfile(mode, userId, data) {
  const validation = validatePublicProfileDraft({
    fullName:data.fullName,
    username:data.username,
    bio:data.bio
  });
  if (!validation.valid) throw new Error(validation.errors[0]?.message || 'Check the public profile fields.');
  const { fullName, username, bio } = validation.value;

  if (mode === 'demo') {
    const existing = DEMO_USERS.find(row => row.uid === userId || row.id === userId) || {};
    const { profileImageFile } = data;
    Object.assign(existing, { fullName, displayName:fullName, username, bio });
    if (profileImageFile instanceof File && profileImageFile.size) {
      existing.profileImageUrl = URL.createObjectURL(profileImageFile);
      existing.photoURL = existing.profileImageUrl;
    }
    return normalizeUser(existing, userId);
  }

  const userRef = doc(db, C.users, userId);
  const snap = await getDoc(userRef);
  const current = snap.exists() ? snap.data() : {};
  const currentAuthUser = auth?.currentUser;
  const email = String(current.email || currentAuthUser?.email || '').trim();
  const role = normalizeRoleValue(current.role, email);
  let profileImageUrl = pick(current, FIELD_ALIASES.userPhoto, currentAuthUser?.photoURL || '');

  const photoFile = data.profileImageFile instanceof File && data.profileImageFile.size
    ? data.profileImageFile
    : null;
  if (photoFile) {
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowedTypes.has(String(photoFile.type || '').toLowerCase())) {
      throw new Error('Profile photo must be JPG, PNG or WebP.');
    }
    if (photoFile.size > 5 * 1024 * 1024) {
      throw new Error('Profile photo must be 5 MB or smaller.');
    }
    const objectRef = ref(storage, `profile_images/${userId}.jpg`);
    const upload = await uploadBytes(objectRef, photoFile, { contentType: photoFile.type });
    profileImageUrl = await getDownloadURL(upload.ref);
  }

  const payload = {
    uid: userId,
    email,
    fullName,
    displayName: fullName,
    username,
    bio,
    role,
    profileImageUrl,
    photoURL: profileImageUrl,
    updatedAt: serverTimestamp()
  };

  if (!snap.exists()) {
    payload.verified = false;
    payload.createdAt = serverTimestamp();
  }

  const batch=writeBatch(db);
  batch.set(userRef,payload,{ merge:true });
  batch.set(
    publicProfileDocument(userId),
    publicProfileWritePayload(userId,{ ...current, ...payload }),
    { merge:true }
  );
  await batch.commit();
  userProfileCache.delete(`${mode}:${userId}`);
  return normalizeUser({ ...current, ...payload }, userId);
}

export async function removeProfilePhoto(mode, userId) {
  if (!userId) throw new Error('Missing user ID.');

  if (mode === 'demo') {
    const existing = DEMO_USERS.find(row => row.uid === userId || row.id === userId);
    if (existing) {
      existing.profileImageUrl = '';
      existing.photoURL = '';
      existing.photoUrl = '';
    }
    return existing ? normalizeUser(existing, userId) : null;
  }

  const objectRef = ref(storage, `profile_images/${userId}.jpg`);
  try {
    await deleteObject(objectRef);
  } catch (error) {
    if (error?.code !== 'storage/object-not-found') throw error;
  }

  const userRef = doc(db, C.users, userId);
  const currentSnap=await getDoc(userRef);
  const current=currentSnap.exists() ? currentSnap.data() : {};
  const batch=writeBatch(db);
  batch.set(userRef,{
    profileImageUrl:'',
    photoURL:'',
    updatedAt:serverTimestamp()
  },{ merge:true });
  batch.set(
    publicProfileDocument(userId),
    publicProfileWritePayload(userId,{ ...current, profileImageUrl:'', photoURL:'', photoUrl:'' }),
    { merge:true }
  );
  await batch.commit();

  userProfileCache.delete(`${mode}:${userId}`);
  return normalizeUser({ ...current, profileImageUrl:'', photoURL:'' }, userId);
}


