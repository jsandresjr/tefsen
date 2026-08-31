import { state } from './store.js';
import {
  icon, escapeHTML, nl2br, safeUrl, relativeTime, formatCount, toast
} from './utils.js';

const root = document.getElementById('app-root');
const modalRoot = document.getElementById('modal-root');

const TOPICS = [
  'All', 'Mathematics', 'Physics', 'Chemistry', 'Biology',
  'ICT/Computer Science', 'Study Tips', 'Engineering', 'Medicine', 'Technology'
];
const PAGE_SIZE = 8;

let homeMode = 'for-you';
let activeTopic = 'All';
let visibleCount = PAGE_SIZE;
let profileTab = 'posts';
let scheduled = false;
let enhancing = false;
let allowLegacyCompose = false;

function localRouteParts() {
  return location.hash.replace(/^#\/?/, '').split(/[/?]/).filter(Boolean).map(decodeURIComponent);
}

function routeName() {
  return (localRouteParts()[0] || 'home').toLowerCase();
}

function routeProfileId() {
  return localRouteParts()[1] || state.profile?.uid || '';
}

function profileAvatar(profile = {}) {
  const name = profile.fullName || profile.displayName || profile.authorName || 'Tefsen User';
  const photo = safeUrl(profile.photoUrl || profile.profileImageUrl || profile.photoURL || profile.authorPhotoUrl || '');
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'T';
  return `<span class="phase1-avatar" aria-label="${escapeHTML(name)}">${photo
    ? `<img src="${photo}" alt="${escapeHTML(name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
    : `<span aria-hidden="true">${escapeHTML(initials)}</span>`}</span>`;
}

function normalizePostType(post = {}) {
  const raw = String(post.postType || post.type || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (['EDUCATIONAL_POST', 'NOTE_CAROUSEL', 'QUESTION', 'SPARK', 'STUDY_UPDATE', 'POLL'].includes(raw)) return raw;
  if (raw === 'NOTE' || raw === 'NOTES') return 'NOTE_CAROUSEL';
  if (raw === 'POST') return 'EDUCATIONAL_POST';
  if (raw === 'QUESTION_POST' || raw === 'Q&A') return 'QUESTION';
  return 'QUESTION';
}

function typeLabel(type) {
  return {
    EDUCATIONAL_POST: 'Post',
    NOTE_CAROUSEL: 'Notes',
    QUESTION: 'Question',
    SPARK: 'Spark',
    STUDY_UPDATE: 'Study Update',
    POLL: 'Poll'
  }[type] || 'Learning';
}

function topicMatches(post, topic) {
  if (topic === 'All') return true;
  const haystack = `${post.subject || ''} ${post.topic || ''} ${(post.tags || []).join(' ')}`.toLowerCase();
  const aliases = {
    Mathematics: ['math', 'mathematics'],
    Physics: ['physics'],
    Chemistry: ['chemistry', 'chemical'],
    Biology: ['biology', 'bio'],
    'ICT/Computer Science': ['ict', 'computer', 'coding', 'programming', 'software'],
    'Study Tips': ['study', 'revision', 'focus', 'exam', 'learning'],
    Engineering: ['engineering'],
    Medicine: ['medicine', 'medical', 'health'],
    Technology: ['technology', 'tech']
  };
  return (aliases[topic] || [topic.toLowerCase()]).some(term => haystack.includes(term));
}

function scoreForYou(post = {}) {
  const likes = Number(post.likeCount || 0);
  const comments = Number(post.commentCount || post.answerCount || 0);
  const helpful = Number(post.helpfulCount || post.learnedCount || 0);
  let freshness = 0;
  const created = post.createdAt?.toDate?.() || (post.createdAt ? new Date(post.createdAt) : null);
  if (created && !Number.isNaN(created.getTime())) {
    const ageHours = Math.max(0, (Date.now() - created.getTime()) / 36e5);
    freshness = ageHours <= 24 ? 4 : ageHours <= 72 ? 2 : ageHours <= 168 ? 1 : 0;
  }
  return helpful * 5 + comments * 3 + likes * 2 + freshness;
}

function homePosts() {
  if (homeMode === 'following') return [];
  return [...state.posts]
    .filter(post => topicMatches(post, activeTopic))
    .sort((a, b) => scoreForYou(b) - scoreForYou(a));
}

function mediaMarkup(post) {
  const urls = Array.isArray(post.imageUrls) && post.imageUrls.length
    ? post.imageUrls.filter(Boolean).slice(0, 4)
    : (post.imageUrl ? [post.imageUrl] : []);
  if (!urls.length) return '';
  return `<div class="phase1-media phase1-media-${Math.min(urls.length, 4)}">${urls.map((url, index) =>
    `<img src="${safeUrl(url)}" alt="Learning media ${index + 1}" loading="lazy" decoding="async">`
  ).join('')}</div>`;
}

function socialPostCard(post) {
  const type = normalizePostType(post);
  const author = post.authorName || post.userName || 'Tefsen User';
  const username = post.authorUsername || post.username || '';
  const title = post.title || post.questionTitle || '';
  const body = post.content || post.description || '';
  const id = String(post.id || '');
  const verified = Boolean(post.verified || post.authorVerified);

  return `<article class="phase1-post panel" data-phase1-post="${escapeHTML(id)}">
    <header class="phase1-post-head">
      <button class="phase1-author" type="button" data-route="profile/${encodeURIComponent(post.authorId || '')}">
        ${profileAvatar({ fullName: author, photoUrl: post.authorPhotoUrl })}
        <span>
          <b>${escapeHTML(author)} ${verified ? '<span class="phase1-verified" aria-label="Verified">✓</span>' : ''}</b>
          <small>${username ? `@${escapeHTML(username)} · ` : ''}${relativeTime(post.createdAt)}</small>
        </span>
      </button>
      <button class="post-menu" type="button" data-post-menu="${escapeHTML(id)}" aria-label="Post options">${icon('more', 20)}</button>
    </header>

    <div class="phase1-post-meta">
      <span class="phase1-type">${escapeHTML(typeLabel(type))}</span>
      <span class="phase1-subject">${escapeHTML(post.subject || post.topic || 'General')}</span>
    </div>

    <button class="phase1-post-content" type="button" data-route="post/${encodeURIComponent(id)}">
      ${title ? `<h2>${escapeHTML(title)}</h2>` : ''}
      ${body && body !== title ? `<p>${nl2br(body.length > 650 ? `${body.slice(0, 650)}…` : body)}</p>` : ''}
    </button>

    ${mediaMarkup(post)}

    <footer class="phase1-actions">
      <button class="phase1-action" type="button" data-like="${escapeHTML(id)}" aria-label="Like">${icon('heart', 18)} <span>${formatCount(post.likeCount || 0)}</span></button>
      <button class="phase1-action" type="button" data-route="post/${encodeURIComponent(id)}" aria-label="Comment">${icon('comment', 18)} <span>${formatCount(post.commentCount || post.answerCount || 0)}</span></button>
      <button class="phase1-action" type="button" data-phase1-unavailable="Helpful" aria-label="Helpful">${icon('check', 18)} <span>Helpful</span></button>
      <button class="phase1-action" type="button" data-phase1-unavailable="Save" aria-label="Save">${icon('bookmark', 18)} <span>Save</span></button>
      <button class="phase1-action" type="button" data-share="${escapeHTML(id)}" aria-label="Share">${icon('share', 18)} <span>Share</span></button>
    </footer>
  </article>`;
}

function emptyHomeState() {
  if (homeMode === 'following') {
    return `<section class="phase1-empty panel">
      <div class="phase1-empty-icon">${icon('user', 24)}</div>
      <h2>Your Following feed is just getting started</h2>
      <p>Explore learners and educators. Posts from people you follow will appear here when the secure follow system is enabled.</p>
      <button class="btn btn-primary" type="button" data-route="explore">Explore Tefsen</button>
    </section>`;
  }
  return `<section class="phase1-empty panel">
    <div class="phase1-empty-icon">${icon('compass', 24)}</div>
    <h2>Your feed is just getting started</h2>
    <p>Explore subjects, discover useful discussions, or create the first contribution for this topic.</p>
    <div class="phase1-empty-actions">
      <button class="btn btn-secondary" type="button" data-route="explore">Explore subjects</button>
      <button class="btn btn-primary" type="button" data-phase1-create>Create</button>
    </div>
  </section>`;
}

function renderSocialHome() {
  if (routeName() !== 'home') return;
  const wrap = root.querySelector('.content-wrap');
  if (!wrap || wrap.dataset.phase1Home === '1') return;

  const posts = homePosts();
  const visible = posts.slice(0, visibleCount);
  const canLoadMore = posts.length > visible.length;
  wrap.dataset.phase1Home = '1';
  wrap.innerHTML = `<div class="phase1-home">
    <section class="phase1-home-intro">
      <div>
        <span class="phase1-eyebrow">THE SOCIAL EDUCATION NETWORK</span>
        <h1>Learn something worth sharing.</h1>
        <p>Discover educational content, learn from people, react to what helps, and contribute what you know.</p>
      </div>
      <button class="phase1-create-hero" type="button" data-phase1-create>${icon('plus', 19)} Create</button>
    </section>

    <div class="phase1-feed-modes" role="tablist" aria-label="Home feed">
      <button class="${homeMode === 'for-you' ? 'active' : ''}" type="button" data-phase1-home-mode="for-you" role="tab" aria-selected="${homeMode === 'for-you'}">For You</button>
      <button class="${homeMode === 'following' ? 'active' : ''}" type="button" data-phase1-home-mode="following" role="tab" aria-selected="${homeMode === 'following'}">Following</button>
    </div>

    <div class="phase1-topic-rail" aria-label="Filter by subject">
      ${TOPICS.map(topic => `<button class="${activeTopic === topic ? 'active' : ''}" type="button" data-phase1-topic="${escapeHTML(topic)}">${escapeHTML(topic)}</button>`).join('')}
    </div>

    <section class="phase1-composer panel">
      ${profileAvatar(state.profile || {})}
      <button type="button" data-phase1-create><b>Share what you know.</b><span>Post, Notes, Question, Spark or Study Update</span></button>
      <button class="phase1-composer-plus" type="button" data-phase1-create aria-label="Create">${icon('plus', 20)}</button>
    </section>

    <div class="phase1-feed">${visible.length ? visible.map(socialPostCard).join('') : emptyHomeState()}</div>
    ${canLoadMore ? `<div class="phase1-load-more"><button class="btn btn-secondary" type="button" data-phase1-more>Show more learning</button></div>` : ''}
  </div>`;
}

function refreshSocialHome() {
  const wrap = root.querySelector('.content-wrap');
  if (wrap) delete wrap.dataset.phase1Home;
  renderSocialHome();
}

function applyPrimaryNavigation() {
  const route = routeName();
  const signature = `${route}:${Number(state.unreadCount || 0)}`;
  const sidebar = root.querySelector('.sidebar');

  if (sidebar) {
    const lists = sidebar.querySelectorAll('.nav-list');
    const primary = lists[0];
    if (primary && primary.dataset.phase1Signature !== signature) {
      primary.dataset.phase1Signature = signature;
      primary.classList.add('phase1-primary-nav');
      primary.innerHTML = `
        <button class="nav-item ${route === 'home' ? 'active' : ''}" type="button" data-route="home"><span class="nav-icon">${icon('home',20)}</span><span>Home</span></button>
        <button class="nav-item ${route === 'explore' ? 'active' : ''}" type="button" data-route="explore"><span class="nav-icon">${icon('compass',20)}</span><span>Explore</span></button>
        <button class="nav-item phase1-create-nav" type="button" data-phase1-create><span class="nav-icon">${icon('plus',20)}</span><span>Create</span></button>
        <button class="nav-item ${route === 'notifications' ? 'active' : ''}" type="button" data-route="notifications"><span class="nav-icon">${icon('bell',20)}</span><span>Activity</span>${state.unreadCount ? `<span class="badge-dot phase1-inline-badge">${Math.min(99, state.unreadCount)}</span>` : ''}</button>
        <button class="nav-item ${route === 'profile' ? 'active' : ''}" type="button" data-route="profile"><span class="nav-icon">${icon('user',20)}</span><span>Profile</span></button>`;
    }
    if (lists[1]) lists[1].style.display = 'none';
    const cta = sidebar.querySelector('.sidebar-cta');
    if (cta) cta.style.display = 'none';
    const duplicateProfile = sidebar.querySelector('.sidebar-profile');
    if (duplicateProfile) duplicateProfile.style.display = 'none';
  }

  const mobile = root.querySelector('.mobile-bottom');
  if (mobile && mobile.dataset.phase1Signature !== signature) {
    mobile.dataset.phase1Signature = signature;
    mobile.innerHTML = `
      <button class="${route === 'home' ? 'active' : ''}" type="button" data-route="home" aria-label="Home">${icon('home',21)}</button>
      <button class="${route === 'explore' ? 'active' : ''}" type="button" data-route="explore" aria-label="Explore">${icon('compass',21)}</button>
      <button class="phase1-mobile-create" type="button" data-phase1-create aria-label="Create">${icon('plus',24)}</button>
      <button class="${route === 'notifications' ? 'active' : ''}" type="button" data-route="notifications" aria-label="Activity">${icon('bell',21)}</button>
      <button class="${route === 'profile' ? 'active' : ''}" type="button" data-route="profile" aria-label="Profile">${icon('user',21)}</button>`;
  }
}

function enhanceTopbar() {
  const search = root.querySelector('.global-search input');
  if (search) {
    search.placeholder = 'Search creators, subjects and learning…';
    search.setAttribute('aria-label', 'Search Tefsen');
  }

  const duplicateActivity = root.querySelector('.topbar-actions [data-route="notifications"]');
  if (duplicateActivity) duplicateActivity.style.display = 'none';

  const avatar = root.querySelector('.top-avatar');
  if (avatar) avatar.style.display = matchMedia('(max-width: 760px)').matches ? 'none' : '';
}

function enhanceExplore() {
  if (routeName() !== 'explore') return;
  const head = root.querySelector('.page-head');
  if (!head) return;
  const title = head.querySelector('h1');
  const text = head.querySelector('p');
  if (title) title.textContent = 'Explore';
  if (text) text.textContent = 'Discover trending learning, subjects, creators and useful questions.';
  const create = head.querySelector('[data-action="compose"]');
  if (create) create.innerHTML = `${icon('plus',17)} Create`;
  if (!head.querySelector('[data-route="leaderboard"]')) {
    head.insertAdjacentHTML('beforeend', `<button class="btn btn-secondary" type="button" data-route="leaderboard">${icon('trophy',17)} Top Scholars</button>`);
  }
}

function enhanceActivity() {
  if (routeName() !== 'notifications') return;
  const head = root.querySelector('.page-head');
  if (!head) return;
  const title = head.querySelector('h1');
  const text = head.querySelector('p');
  if (title) title.textContent = 'Activity';
  if (text) text.textContent = 'Your learning interactions and community updates appear here.';
}

function profilePostsForTab(tab) {
  const targetId = String(routeProfileId() || '');
  const posts = state.posts.filter(post => {
    const ids = [post.authorId, post.userId, post.uid, post.ownerId, post.authorUid]
      .map(value => String(value || '')).filter(Boolean);
    return !targetId || ids.includes(targetId);
  });
  if (tab === 'notes') return posts.filter(post => normalizePostType(post) === 'NOTE_CAROUSEL');
  if (tab === 'questions') return posts.filter(post => normalizePostType(post) === 'QUESTION');
  if (tab === 'sparks') return posts.filter(post => normalizePostType(post) === 'SPARK');
  return posts;
}

function renderProfileTabContent() {
  const feed = root.querySelector('.profile-tabs + .feed-list');
  if (!feed) return;
  const posts = profilePostsForTab(profileTab);
  const label = { posts: 'posts', notes: 'notes', questions: 'questions', sparks: 'Sparks' }[profileTab] || 'posts';
  feed.innerHTML = posts.length
    ? posts.map(socialPostCard).join('')
    : `<section class="phase1-empty panel"><div class="phase1-empty-icon">${icon('compass',24)}</div><h2>No ${label} yet</h2><p>This section will fill as this learner shares more educational content.</p></section>`;
}

function enhanceProfile() {
  if (routeName() !== 'profile') return;
  root.querySelectorAll('.profile-stats span').forEach(stat => {
    if (/\bPoints\b/i.test(stat.textContent || '') && stat.lastChild) stat.lastChild.textContent = 'Reputation';
  });

  const follow = root.querySelector('[data-follow-user]');
  if (follow) {
    follow.disabled = true;
    follow.title = 'Follow will be enabled with the secure relationship model';
  }
  const message = root.querySelector('[data-message-user]');
  if (message) {
    message.disabled = true;
    message.title = 'Messaging is not enabled in this web build yet';
  }

  const tabs = root.querySelector('.profile-tabs');
  if (!tabs || tabs.dataset.phase1Ready === '1') return;
  tabs.dataset.phase1Ready = '1';
  tabs.style.display = 'flex';
  tabs.style.gap = '6px';
  tabs.style.overflowX = 'auto';
  tabs.innerHTML = `
    <button class="feed-tab ${profileTab === 'posts' ? 'active' : ''}" type="button" data-phase1-profile-tab="posts">Posts</button>
    <button class="feed-tab ${profileTab === 'notes' ? 'active' : ''}" type="button" data-phase1-profile-tab="notes">Notes</button>
    <button class="feed-tab ${profileTab === 'questions' ? 'active' : ''}" type="button" data-phase1-profile-tab="questions">Questions</button>
    <button class="feed-tab ${profileTab === 'sparks' ? 'active' : ''}" type="button" data-phase1-profile-tab="sparks">Sparks</button>`;
  renderProfileTabContent();
}

function showCreateSheet() {
  modalRoot.innerHTML = `<div class="modal-backdrop phase1-sheet-backdrop" data-phase1-sheet-dismiss>
    <section class="phase1-create-sheet" role="dialog" aria-modal="true" aria-labelledby="phase1-create-title">
      <div class="phase1-sheet-handle" aria-hidden="true"></div>
      <header>
        <div><span class="phase1-eyebrow">CREATE ON TEFSEN</span><h2 id="phase1-create-title">What are you sharing?</h2></div>
        <button class="close-btn" type="button" data-phase1-sheet-dismiss aria-label="Close">${icon('close',19)}</button>
      </header>
      <div class="phase1-create-grid">
        <button type="button" data-phase1-unavailable="Post"><span>${icon('image',21)}</span><b>Post</b><small>Concept + images</small></button>
        <button type="button" data-phase1-unavailable="Notes"><span>${icon('bookmark',21)}</span><b>Notes</b><small>Swipeable study slides</small></button>
        <button class="is-ready" type="button" data-phase1-question><span>${icon('comment',21)}</span><b>Question</b><small>Ask the community</small></button>
        <button type="button" data-phase1-unavailable="Spark"><span>${icon('eye',21)}</span><b>Spark</b><small>Short vertical learning</small></button>
        <button type="button" data-phase1-unavailable="Study Update"><span>${icon('check',21)}</span><b>Study Update</b><small>Share your progress</small></button>
      </div>
      <p class="phase1-sheet-note">Question publishing is available now. Other formats will activate as their secure data flows are completed.</p>
    </section>
  </div>`;
}

function openQuestionComposer() {
  const legacy = root.querySelector('[data-action="compose"]');
  if (!legacy) {
    toast('Question composer is not available on this screen.', 'error');
    return;
  }
  allowLegacyCompose = true;
  try {
    legacy.click();
  } finally {
    allowLegacyCompose = false;
  }
}

function enhance() {
  if (enhancing || !root.querySelector('.app-shell')) return;
  enhancing = true;
  try {
    applyPrimaryNavigation();
    enhanceTopbar();
    enhanceExplore();
    enhanceActivity();
    enhanceProfile();
    renderSocialHome();
  } finally {
    enhancing = false;
  }
}

function scheduleEnhance() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    enhance();
  });
}

new MutationObserver(scheduleEnhance).observe(root, { childList: true });
window.addEventListener('hashchange', () => {
  visibleCount = PAGE_SIZE;
  profileTab = 'posts';
  scheduleEnhance();
});
window.addEventListener('resize', scheduleEnhance);

document.addEventListener('click', event => {
  const create = event.target.closest?.('[data-phase1-create], [data-action="compose"]');
  if (create && !allowLegacyCompose) {
    event.preventDefault();
    event.stopImmediatePropagation();
    showCreateSheet();
    return;
  }

  const question = event.target.closest?.('[data-phase1-question]');
  if (question) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openQuestionComposer();
    return;
  }

  const unavailable = event.target.closest?.('[data-phase1-unavailable]');
  if (unavailable) {
    event.preventDefault();
    event.stopImmediatePropagation();
    toast(`${unavailable.dataset.phase1Unavailable} is not available in this web build yet.`, 'success');
    return;
  }

  const dismiss = event.target.closest?.('[data-phase1-sheet-dismiss]');
  if (dismiss && (dismiss === event.target || dismiss.matches('button'))) {
    event.preventDefault();
    event.stopImmediatePropagation();
    modalRoot.innerHTML = '';
    return;
  }

  const mode = event.target.closest?.('[data-phase1-home-mode]');
  if (mode) {
    event.preventDefault();
    event.stopImmediatePropagation();
    homeMode = mode.dataset.phase1HomeMode || 'for-you';
    visibleCount = PAGE_SIZE;
    refreshSocialHome();
    return;
  }

  const topic = event.target.closest?.('[data-phase1-topic]');
  if (topic) {
    event.preventDefault();
    event.stopImmediatePropagation();
    activeTopic = topic.dataset.phase1Topic || 'All';
    visibleCount = PAGE_SIZE;
    refreshSocialHome();
    return;
  }

  const more = event.target.closest?.('[data-phase1-more]');
  if (more) {
    event.preventDefault();
    event.stopImmediatePropagation();
    visibleCount += PAGE_SIZE;
    refreshSocialHome();
    return;
  }

  const tab = event.target.closest?.('[data-phase1-profile-tab]');
  if (tab) {
    event.preventDefault();
    event.stopImmediatePropagation();
    profileTab = tab.dataset.phase1ProfileTab || 'posts';
    root.querySelectorAll('[data-phase1-profile-tab]').forEach(button => {
      button.classList.toggle('active', button.dataset.phase1ProfileTab === profileTab);
    });
    renderProfileTabContent();
  }
}, true);

scheduleEnhance();
