import { auth, db } from './firebase-client.js';
import {
  collection,
  collectionGroup,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

// Compatibility layer for the current Android-app Firebase rules.
// Keeps denormalized counters and follow/profile metadata in sync without
// changing the existing Tefsen Web interaction layer.

let refreshQueued = false;
let lastProfileCountKey = '';
let lastProfileCountAt = 0;

function currentRouteParts() {
  return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(part => {
    try { return decodeURIComponent(part); } catch { return part; }
  });
}

function compactNumber(value) {
  return new Intl.NumberFormat(undefined, {
    notation: Math.abs(Number(value || 0)) >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1
  }).format(Math.max(0, Number(value || 0)));
}

function updateProfileStat(label, count) {
  document.querySelectorAll('.profile-stats span').forEach(span => {
    const text = String(span.textContent || '').toLowerCase();
    if (!text.includes(label.toLowerCase())) return;
    const value = span.querySelector('b');
    if (value) value.textContent = compactNumber(count);
  });
}

async function hydrateProfileFollowCounts({ force = false } = {}) {
  const user = auth?.currentUser;
  const [route, routeUserId = ''] = currentRouteParts();
  if (!user?.uid || route !== 'profile') return;

  const targetUserId = String(routeUserId || user.uid);
  const key = `${user.uid}:${targetUserId}`;
  const now = Date.now();
  if (!force && key === lastProfileCountKey && now - lastProfileCountAt < 8000) return;
  lastProfileCountKey = key;
  lastProfileCountAt = now;

  try {
    const followingRef = collection(db, 'users', targetUserId, 'following');
    const followersQuery = query(
      collectionGroup(db, 'following'),
      where('targetUserId', '==', targetUserId)
    );

    const [followingAgg, followersAgg] = await Promise.all([
      getCountFromServer(followingRef),
      getCountFromServer(followersQuery)
    ]);

    updateProfileStat('following', followingAgg.data().count || 0);
    updateProfileStat('followers', followersAgg.data().count || 0);
  } catch (error) {
    console.warn('Tefsen follow-count sync skipped:', error);
  }
}

function updateVisibleLikeCount(postId, count) {
  document.querySelectorAll(`[data-like="${CSS.escape(String(postId))}"] .action-count`).forEach(el => {
    el.textContent = compactNumber(count);
  });
}

async function syncLikeCounter(postId) {
  const user = auth?.currentUser;
  if (!user?.uid || !postId) return;

  try {
    const likesRef = collection(db, 'posts', String(postId), 'likes');
    const aggregate = await getCountFromServer(likesRef);
    const count = Math.max(0, Number(aggregate.data().count || 0));
    await updateDoc(doc(db, 'posts', String(postId)), {
      likeCount: count,
      updatedAt: serverTimestamp(),
      updatedAtMillis: Date.now()
    });
    updateVisibleLikeCount(postId, count);
  } catch (error) {
    console.warn('Tefsen like-counter sync skipped:', error);
  }
}

async function syncAnswerCounter(postId) {
  const user = auth?.currentUser;
  if (!user?.uid || !postId) return;

  try {
    const answersQuery = query(
      collection(db, 'posts', String(postId), 'answers'),
      where('status', '==', 'published'),
      where('visibility', '==', 'public')
    );
    const aggregate = await getCountFromServer(answersQuery);
    const count = Math.max(0, Number(aggregate.data().count || 0));
    await updateDoc(doc(db, 'posts', String(postId)), {
      answerCount: count,
      updatedAt: serverTimestamp(),
      updatedAtMillis: Date.now()
    });

    document.querySelectorAll('.answers-head h2').forEach(el => {
      el.textContent = `${count} ${count === 1 ? 'Answer' : 'Answers'}`;
    });
  } catch (error) {
    console.warn('Tefsen answer-counter sync skipped:', error);
  }
}

async function syncMyAnswerProfilePhoto() {
  const user = auth?.currentUser;
  if (!user?.uid) return;

  try {
    const profileSnap = await getDoc(doc(db, 'users', user.uid));
    if (!profileSnap.exists()) return;
    const data = profileSnap.data() || {};
    const photoUrl = String(
      data.profileImageUrl || data.profilePhotoUrl || data.photoURL || data.photoUrl || user.photoURL || ''
    ).trim();
    if (!photoUrl) return;

    const answersQuery = query(
      collectionGroup(db, 'answers'),
      where('authorId', '==', user.uid),
      limit(200)
    );
    const answersSnap = await getDocs(answersQuery);
    await Promise.allSettled(answersSnap.docs.map(answer => updateDoc(answer.ref, {
      authorProfilePhotoUrl: photoUrl,
      updatedAt: serverTimestamp()
    })));
  } catch (error) {
    console.warn('Tefsen answer profile-photo sync skipped:', error);
  }
}

function schedule(task, delays) {
  for (const delay of delays) setTimeout(task, delay);
}

function handleClickCapture(event) {
  const follow = event.target.closest?.('[data-follow-user]');
  if (follow) {
    // premium-v2 currently owns the actual follow write. Refresh counts after it.
    schedule(() => hydrateProfileFollowCounts({ force: true }), [700, 2200]);
  }

  const like = event.target.closest?.('[data-like]');
  if (like?.dataset?.like) {
    const postId = like.dataset.like;
    schedule(() => syncLikeCounter(postId), [800, 2200]);
  }
}

function handleSubmitCapture(event) {
  const answerForm = event.target.closest?.('[data-comment-form]');
  if (answerForm?.dataset?.commentForm) {
    const postId = answerForm.dataset.commentForm;
    schedule(() => syncAnswerCounter(postId), [900, 2600]);
  }

  if (event.target.closest?.('[data-profile-form]')) {
    schedule(syncMyAnswerProfilePhoto, [1600, 4200]);
  }
}

function queueRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => {
    refreshQueued = false;
    void hydrateProfileFollowCounts();
  });
}

const observer = new MutationObserver(queueRefresh);
observer.observe(document.documentElement, { childList: true, subtree: true });

document.addEventListener('click', handleClickCapture, true);
document.addEventListener('submit', handleSubmitCapture, true);
window.addEventListener('hashchange', () => hydrateProfileFollowCounts({ force: true }));
document.addEventListener('DOMContentLoaded', () => hydrateProfileFollowCounts({ force: true }), { once: true });
queueRefresh();
