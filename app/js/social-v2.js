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

function routeParts() {
  return location.hash.replace(/^#\/?/, '').split(/[/?]/).filter(Boolean).map(decodeURIComponent);
}

function routeName() {
  return (routeParts()[0] || 'home').toLowerCase();
}

function routeProfileId() {
  return routeParts()[1] || state.profile?.uid || '';
}

function profileAvatar(profile = {}, extra = '') {
  const name = profile.fullName || profile.displayName || profile.authorName || 'Tefsen User';
  const photo = safeUrl(profile.photoUrl || profile.profileImageUrl || profile.photoURL || profile.authorPhotoUrl || '');
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'T';
  return `<span class="phase1-avatar ${extra}" aria-label="${escapeHTML(name)}">${photo
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

function typeIcon(type) {
  return {
    EDUCATIONAL_POST: 'image',
    NOTE_CAROUSEL: 'bookmark',
    QUESTION: 'comment',
    SPARK: 'eye',
    STUDY_UPDATE: 'check',
    POLL: 'info'
  }[type] || 'compass';
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
  const subjectBonus = activeTopic !== 'All' && topicMatches(post, activeTopic) ? 4 : 0;
  let freshness = 0;
  const created = post.createdAt?.toDate?.() || (post.createdAt ? new Date(post.createdAt) : null);
  if (created && !Number.isNaN(created.getTime())) {
    const ageHours = Math.max(0, (Date.now() - created.getTime()) / 36e5);
    freshness = ageHours <= 24 ? 5 : ageHours <= 72 ? 3 : ageHours <= 168 ? 1 : 0;
  }
  return helpful * 5 + comments * 3 + likes * 2 + freshness + subjectBonus;
}

function homePosts() {
  if (homeMode === 'following') return [];
  return [...state.posts]
    .filter(post => topicMatches(post, activeTopic))
    .sort((a, b) => scoreForYou(b) - scoreForYou(a));
}

function subjectInitial(topic) {
  if (topic === 'ICT/Computer Science') return 'CS';
  if (topic === 'Study Tips') return 'ST';
  return topic.slice(0, 2).toUpperCase();
}

function topicRail() {
  return `<div class="phase1-topic-rail" aria-label="Browse subjects">
    ${TOPICS.map(topic => `
      <button class="${activeTopic === topic ? 'active' : ''}" type="button" data-phase1-topic="${escapeHTML(topic)}">
        <span>${escapeHTML(subjectInitial(topic))}</span>
        <b>${escapeHTML(topic)}</b>
      </button>`).join('')}
  </div>`;
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
  const subject = post.subject || post.topic || 'General';
  const likes = Number(post.likeCount || 0);
  const comments = Number(post.commentCount || post.answerCount || 0);
  const helpful = Number(post.helpfulCount || post.learnedCount || 0);

  return `<article class="phase1-post panel" data-phase1-post="${escapeHTML(id)}">
    <header class="phase1-post-head">
      <button class="phase1-author" type="button" data-route="profile/${encodeURIComponent(post.authorId || '')}">
        ${profileAvatar({ fullName: author, photoUrl: post.authorPhotoUrl })}
        <span class="phase1-author-copy">
          <span class="phase1-author-name">${escapeHTML(author)} ${verified ? '<span class="phase1-verified" aria-label="Verified">✓</span>' : ''}</span>
          <small>${username ? `@${escapeHTML(username)} · ` : ''}${relativeTime(post.createdAt)}</small>
        </span>
      </button>
      <button class="post-menu phase1-more" type="button" data-post-menu="${escapeHTML(id)}" aria-label="Post options">${icon('more', 20)}</button>
    </header>

    <div class="phase1-post-meta">
      <span class="phase1-type">${icon(typeIcon(type), 13)} ${escapeHTML(typeLabel(type))}</span>
      <button type="button" data-phase1-topic="${escapeHTML(subject)}" class="phase1-subject">${escapeHTML(subject)}</button>
    </div>

    <button class="phase1-post-content" type="button" data-route="post/${encodeURIComponent(id)}">
      ${title ? `<h2>${escapeHTML(title)}</h2>` : ''}
      ${body && body !== title ? `<p>${nl2br(body.length > 520 ? `${body.slice(0, 520)}…` : body)}</p>` : ''}
    </button>

    ${mediaMarkup(post)}

    <div class="phase1-engagement-summary">
      <span>${likes ? `${formatCount(likes)} likes` : 'Be first to like'}</span>
      <span>${comments ? `${formatCount(comments)} comments` : ''}${helpful ? `${comments ? ' · ' : ''}${formatCount(helpful)} helpful` : ''}</span>
    </div>

    <footer class="phase1-actions">
      <button class="phase1-action" type="button" data-like="${escapeHTML(id)}" aria-label="Like">${icon('heart', 19)}<span>Like</span></button>
      <button class="phase1-action" type="button" data-route="post/${encodeURIComponent(id)}" aria-label="Comment">${icon('comment', 19)}<span>Comment</span></button>
      <button class="phase1-action phase1-soft-disabled" type="button" data-phase1-unavailable="Helpful" aria-label="Helpful">${icon('check', 19)}<span>Helpful</span></button>
      <button class="phase1-action phase1-soft-disabled" type="button" data-phase1-unavailable="Save" aria-label="Save">${icon('bookmark', 19)}<span>Save</span></button>
      <button class="phase1-action" type="button" data-share="${escapeHTML(id)}" aria-label="Share">${icon('share', 19)}<span>Share</span></button>
    </footer>
  </article>`;
}

function followingState() {
  return `<section class="phase1-empty phase1-following-state panel">
    <div class="phase1-empty-icon">${icon('user', 25)}</div>
    <span class="phase1-eyebrow">FOLLOWING</span>
    <h2>Build your learning circle</h2>
    <p>Follow learners and educators whose posts help you. Their new content will appear here after the secure follow system is enabled.</p>
    <button class="btn btn-primary" type="button" data-route="explore">Discover people</button>
  </section>`;
}

function emptyHomeState() {
  if (homeMode === 'following') return followingState();
  return `<section class="phase1-empty panel">
    <div class="phase1-empty-icon">${icon('compass', 25)}</div>
    <h2>No learning posts in this topic yet</h2>
    <p>Try another subject or start the conversation with a useful question.</p>
    <div class="phase1-empty-actions">
      <button class="btn btn-secondary" type="button" data-phase1-topic="All">View all subjects</button>
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
    <header class="phase1-feed-header">
      <div>
        <span class="phase1-eyebrow">TEFSEN</span>
        <h1>Learning feed</h1>
      </div>
      <button class="phase1-create-hero" type="button" data-phase1-create>${icon('plus', 19)} Create</button>
    </header>

    <div class="phase1-feed-modes" role="tablist" aria-label="Home feed">
      <button class="${homeMode === 'for-you' ? 'active' : ''}" type="button" data-phase1-home-mode="for-you" role="tab" aria-selected="${homeMode === 'for-you'}">For You</button>
      <button class="${homeMode === 'following' ? 'active' : ''}" type="button" data-phase1-home-mode="following" role="tab" aria-selected="${homeMode === 'following'}">Following</button>
    </div>

    ${topicRail()}

    <section class="phase1-composer panel">
      ${profileAvatar(state.profile || {}, 'phase1-avatar-own')}
      <button class="phase1-composer-copy" type="button" data-phase1-create>
        <b>Share what you know</b>
        <span>Explain a concept, ask a question, or share study progress</span>
      </button>
      <button class="phase1-composer-plus" type="button" data-phase1-create aria-label="Create">${icon('plus', 20)}</button>
    </section>

    <div class="phase1-feed">${visible.length ? visible.map(socialPostCard).join('') : emptyHomeState()}</div>
    ${canLoadMore ? `<div class="phase1-load-more"><button class="btn btn-secondary" type="button" data-phase1-more>Show more</button></div>` : ''}
  </div>`;
}

function refreshSocialHome() {
  const wrap = root.querySelector('.content-wrap');
  if (wrap) delete wrap.dataset.phase1Home;
  renderSocialHome();
}

function applyPrimaryNavigation() {
  const route = routeName();
  const unread = Number(state.unreadCount || 0);
  const signature = `${route}:${unread}`;
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
        <button class="nav-item ${route === 'notifications' ? 'active' : ''}" type="button" data-route="notifications"><span class="nav-icon">${icon('bell',20)}</span><span>Activity</span>${unread ? `<span class="badge-dot phase1-inline-badge">${Math.min(99, unread)}</span>` : ''}</button>
        <button class="nav-item ${route === 'profile' ? 'active' : ''}" type="button" data-route="profile"><span class="nav-icon">${icon('user',20)}</span><span>Profile</span></button>`;
    }

    if (lists[1]) lists[1].style.display = 'none';
    const divider = sidebar.querySelector('.nav-divider');
    if (divider) divider.style.display = 'none';
    const cta = sidebar.querySelector('.sidebar-cta');
    if (cta) cta.style.display = 'none';
    const duplicateProfile = sidebar.querySelector('.sidebar-profile');
    if (duplicateProfile) duplicateProfile.style.display = 'none';
  }

  const mobile = root.querySelector('.mobile-bottom');
  if (mobile && mobile.dataset.phase1Signature !== signature) {
    mobile.dataset.phase1Signature = signature;
    mobile.innerHTML = `
      <button class="${route === 'home' ? 'active' : ''}" type="button" data-route="home" aria-label="Home">${icon('home',21)}<span>Home</span></button>
      <button class="${route === 'explore' ? 'active' : ''}" type="button" data-route="explore" aria-label="Explore">${icon('compass',21)}<span>Explore</span></button>
      <button class="phase1-mobile-create" type="button" data-phase1-create aria-label="Create">${icon('plus',24)}<span>Create</span></button>
      <button class="${route === 'notifications' ? 'active' : ''}" type="button" data-route="notifications" aria-label="Activity">${icon('bell',21)}<span>Activity</span></button>
      <button class="${route === 'profile' ? 'active' : ''}" type="button" data-route="profile" aria-label="Profile">${icon('user',21)}<span>Profile</span></button>`;
  }
}

function enhanceTopbar() {
  const search = root.querySelector('.global-search input');
  if (search) {
    search.placeholder = 'Search Tefsen';
    search.setAttribute('aria-label', 'Search creators, subjects and learning');
  }

  const duplicateActivity = root.querySelector('.topbar-actions [data-route="notifications"]');
  if (duplicateActivity) duplicateActivity.style.display = 'none';

  const topAvatar = root.querySelector('.top-avatar');
  if (topAvatar) topAvatar.style.display = matchMedia('(max-width: 760px)').matches ? 'none' : '';

  const messageButton = root.querySelector('.topbar-actions [data-route="messages"]');
  if (messageButton) {
    messageButton.setAttribute('title', 'Messaging is planned after the core social learning loop');
    messageButton.setAttribute('aria-label', 'Messages — planned');
  }
}

function enhanceExplore() {
  if (routeName() !== 'explore') return;
  const wrap = root.querySelector('.content-wrap');
  const head = root.querySelector('.page-head');
  if (!wrap || !head || wrap.dataset.phase1Explore === '1') return;

  wrap.dataset.phase1Explore = '1';

  const title = head.querySelector('h1');
  const text = head.querySelector('p');
  if (title) title.textContent = 'Explore Tefsen';
  if (text) text.textContent = 'Find subjects, creators and learning worth following.';

  const create = head.querySelector('[data-action="compose"]');
  if (create) {
    create.innerHTML = `${icon('plus',17)} Create`;
    create.setAttribute('data-phase1-create', '');
  }

  const subjects = TOPICS.filter(topic => topic !== 'All');
  const exploreDeck = document.createElement('section');
  exploreDeck.className = 'phase1-explore-deck';
  exploreDeck.innerHTML = `
    <div class="phase1-section-heading">
      <div><span class="phase1-eyebrow">DISCOVER</span><h2>Explore by subject</h2></div>
      <button class="phase1-text-button" type="button" data-route="leaderboard">Top Scholars</button>
    </div>
    <div class="phase1-subject-grid">
      ${subjects.slice(0, 8).map(topic => `<button type="button" data-phase1-topic="${escapeHTML(topic)}" data-phase1-topic-route>
        <span>${escapeHTML(subjectInitial(topic))}</span><b>${escapeHTML(topic)}</b><small>Explore learning</small>
      </button>`).join('')}
    </div>`;
  head.insertAdjacentElement('afterend', exploreDeck);
}

function enhanceActivity() {
  if (routeName() !== 'notifications') return;
  const head = root.querySelector('.page-head');
  if (!head) return;

  const title = head.querySelector('h1');
  const text = head.querySelector('p');
  if (title) title.textContent = 'Activity';
  if (text) text.textContent = 'Reactions, answers, follows and learning milestones will collect here.';

  const wrap = root.querySelector('.content-wrap');
  if (!wrap || wrap.dataset.phase1Activity === '1') return;
  wrap.dataset.phase1Activity = '1';

  const hasMeaningfulItems = [...wrap.querySelectorAll('button, article, .notification-row')]
    .some(el => !el.closest('.page-head') && (el.textContent || '').trim().length > 20);

  if (!hasMeaningfulItems) {
    wrap.insertAdjacentHTML('beforeend', `<section class="phase1-activity-empty panel">
      <div class="phase1-activity-mark">${icon('bell',24)}</div>
      <div><h2>Nothing new yet</h2><p>When someone likes, comments, follows, answers, or marks your content Helpful, you’ll see it here.</p></div>
      <button class="btn btn-secondary" type="button" data-route="home">Back to feed</button>
    </section>`);
  }
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
    : `<section class="phase1-empty panel">
        <div class="phase1-empty-icon">${icon(profileTab === 'questions' ? 'comment' : 'compass',24)}</div>
        <h2>No ${label} yet</h2>
        <p>This section will fill as this learner shares more educational content.</p>
      </section>`;
}

function enhanceProfile() {
  if (routeName() !== 'profile') return;
  const wrap = root.querySelector('.content-wrap');
  if (!wrap) return;

  root.querySelectorAll('.profile-stats span').forEach(stat => {
    if (/\bPoints\b/i.test(stat.textContent || '') && stat.lastChild) stat.lastChild.textContent = 'Reputation';
  });

  const info = root.querySelector('.profile-info');
  if (info && !info.querySelector('.phase1-academic-identity')) {
    const pointsText = [...root.querySelectorAll('.profile-stats span')]
      .find(stat => /Reputation/i.test(stat.textContent || ''))?.querySelector('b')?.textContent || '0';

    info.insertAdjacentHTML('beforeend', `<div class="phase1-academic-identity">
      <div><span>Academic identity</span><b>${escapeHTML(state.profile?.role || 'Student')}</b></div>
      <div><span>Reputation</span><b>${escapeHTML(pointsText)}</b></div>
      <div><span>Helpful impact</span><b>Building</b></div>
    </div>`);
  }

  const follow = root.querySelector('[data-follow-user]');
  if (follow) {
    follow.disabled = true;
    follow.title = 'Follow will activate when the secure follow model is enabled';
  }

  const message = root.querySelector('[data-message-user]');
  if (message) {
    message.disabled = true;
    message.title = 'Messaging is planned after the social learning loop';
  }

  const tabs = root.querySelector('.profile-tabs');
  if (!tabs || tabs.dataset.phase1Ready === '1') return;

  tabs.dataset.phase1Ready = '1';
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
        <div><span class="phase1-eyebrow">CREATE</span><h2 id="phase1-create-title">Share learning, not noise</h2><p>Choose the format that fits what you want to teach or ask.</p></div>
        <button class="close-btn" type="button" data-phase1-sheet-dismiss aria-label="Close">${icon('close',19)}</button>
      </header>
      <div class="phase1-create-grid">
        <button type="button" data-phase1-unavailable="Educational Post"><span>${icon('image',21)}</span><b>Post</b><small>Concept, explanation or image</small><em>Phase 2</em></button>
        <button type="button" data-phase1-unavailable="Notes"><span>${icon('bookmark',21)}</span><b>Notes</b><small>Swipeable study slides</small><em>Phase 5</em></button>
        <button class="is-ready" type="button" data-phase1-question><span>${icon('comment',21)}</span><b>Question</b><small>Ask the learning community</small><em>Available</em></button>
        <button type="button" data-phase1-unavailable="Spark"><span>${icon('eye',21)}</span><b>Spark</b><small>Short vertical learning</small><em>Phase 5</em></button>
        <button type="button" data-phase1-unavailable="Study Update"><span>${icon('check',21)}</span><b>Study Update</b><small>Share progress and milestones</small><em>Phase 2</em></button>
      </div>
      <p class="phase1-sheet-note">Only Question is enabled in this build because the other secure write models are not finished yet. Tefsen will not fake successful publishing.</p>
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
    toast(`${unavailable.dataset.phase1Unavailable} is planned but not safely enabled yet.`, 'success');
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

    if (topic.hasAttribute('data-phase1-topic-route') && routeName() === 'explore') {
      location.hash = '#/home';
      setTimeout(refreshSocialHome, 0);
    } else if (routeName() === 'home') {
      refreshSocialHome();
    }
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
