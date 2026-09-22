import { initFirebase } from './firebase-client.js';
import { state, setState } from './store.js';
import { observeAuth, signIn, register, signInGoogle, resetPassword, logout } from './services/auth-service.js';
import {
  getProfile, subscribePosts, createPost, deletePost, getPost, getReactionIds, toggleLike, toggleSave,
  subscribeComments, addComment, getNotifications, markNotificationRead, getConversations,
  subscribeMessages, sendMessage, getLeaderboard, searchAll, updateUserProfile, removeProfilePhoto, reportPost,
  startConversation, normalizeUser, getUserById, getWebPostingPolicy, getDailyPostUsage,
  getFollowState, toggleFollow, hydratePostLikeState
} from './services/data-service.js';
import { getOpportunities, getOpportunityById } from './services/opportunity-service.js';
import { getStudentPassport, saveStudentPassport, studentPassportCompleteness, emptyStudentPassport } from './services/student-passport-service.js';
import { evaluateEligibility, scoreOpportunityMatch } from './services/eligibility-engine.js';
import {
  listJourneyStates, getJourneyState, setOpportunitySaved, startJourney,
  updateJourneyStage, updateJourneyPlanning, toggleJourneyTask,
  addCustomJourneyTask, deleteCustomJourneyTask, journeyProgress,
  allowedJourneyTransitions, JOURNEY_LABELS, JOURNEY_STATUSES
} from './services/journey-service.js';
import { deadlineInfo } from './services/deadline-engine.js';
import {
  buildSubjectCommunities, buildUniversityCommunities,
  subjectCommunityData, universityCommunityData, intakeCommunityData
} from './services/community-service.js';
import {
  getAdminCapability, opportunityFreshness, parseOpportunityImport,
  markImportDuplicates, listAdminOpportunities, reviewOpportunity,
  importOpportunityRecords
} from './services/opportunity-admin-service.js';
import {
  icon, escapeHTML, nl2br, initials, safeUrl, relativeTime, formatCount, debounce,
  routeParts, go, toast, copyText, roleClass, normalizeRole
} from './utils.js';

const root = document.getElementById('app-root');
const modalRoot = document.getElementById('modal-root');
let stopAuth = null;
let stopPosts = null;
let stopComments = null;
let stopMessages = null;
let reactionState = { saved: new Set(), liked: new Set() };
let currentComments = [];
let currentSearch = { users: [], posts: [] };
const likeRequests = new Set();
let currentProfileView = null;
let currentStudentPassport = null;
let currentJourneyStates = new Map();
let adminCapability = false;
let currentAdminOpportunities = [];
let adminPreviewRows = [];
let adminImportSource = '';
let adminTab = 'review';
let settingsTab = 'profile';
const GOOGLE_PLAY_APP_URL = 'https://play.google.com/store/apps/details?id=com.tefsen.app';
const GOOGLE_PLAY_SUBSCRIPTIONS_URL = 'https://play.google.com/store/account/subscriptions';
let appStarted = false;
let likeHydrationKey = '';
let likeHydrationAt = 0;
let likeHydrationRun = 0;

const navItems = [
  ['home', 'Home', 'home'],
  ['opportunities', 'Opportunities', 'compass'],
  ['passport', 'Student Passport', 'user'],
  ['journeys', 'Journey', 'check'],
  ['explore', 'Community', 'compass'],
  ['notifications', 'Notifications', 'bell'],
  ['messages', 'Messages', 'message'],
  ['leaderboard', 'Leaderboard', 'trophy'],
  ['saved', 'Saved', 'bookmark'],
  ['subscription', 'Subscription', 'info'],
  ['profile', 'Profile', 'user'],
  ['settings', 'Settings', 'settings']
];

function avatar(user, size = '', extra = '') {
  const name = user?.fullName || user?.displayName || user?.authorName || 'Tefsen User';
  const photo = user?.photoUrl || user?.profileImageUrl || user?.photoURL || user?.authorPhotoUrl || '';
  const safePhoto = safeUrl(photo);
  const cls = `avatar ${size} ${extra} ${safePhoto ? 'has-photo' : ''}`.trim();
  const fallback = `<span class="avatar-fallback" aria-hidden="true">${escapeHTML(initials(name))}</span>`;
  return `<div class="${cls}" aria-label="${escapeHTML(name)}">${fallback}${safePhoto ? `<img class="protected-avatar-image" src="${safePhoto}" alt="${escapeHTML(name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" draggable="false">` : ''}</div>`;
}

function rolePill(role = 'Student') {
  return `<span class="role-pill ${roleClass(role)}">${escapeHTML(normalizeRole(role))}</span>`;
}

function verifiedMark(value, role = 'Student') {
  const active = value === true || value === 1 || ['true', '1', 'yes', 'verified'].includes(String(value || '').trim().toLowerCase());
  if (!active) return '';
  const normalized = normalizeRole(role || 'Student');
  const lower = normalized.toLowerCase();
  const isUniversity = lower.includes('university') || /(^|\s)uni(\s|$)/.test(lower) || lower.includes('campus student');
  const tone = lower.includes('admin') ? 'admin' : isUniversity ? 'university' : 'student';
  const label = lower.includes('admin') ? 'Admin verified' : isUniversity ? 'University student verified' : 'Student verified';
  return `<span class="verified-badge verified-${tone}" title="${label}" aria-label="${label}"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path class="verified-badge-fill" d="M12 2.3l2.2 1.5 2.7-.2 1.1 2.5 2.4 1.3-.5 2.7 1.5 2.2-1.5 2.2.5 2.7-2.4 1.3-1.1 2.5-2.7-.2L12 21.7l-2.2-1.5-2.7.2L6 17.9l-2.4-1.3.5-2.7L2.6 12l1.5-2.2-.5-2.7L6 5.8l1.1-2.5 2.7.2L12 2.3Z"/><path class="verified-badge-check" d="m8.1 12.2 2.4 2.4 5.4-5.5"/></svg></span>`;
}

function currentRoute() { return routeParts()[0] || 'home'; }

function humanError(error) {
  const code = error?.code || '';
  const map = {
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/invalid-login-credentials': 'Email or password is incorrect.',
    'auth/email-already-in-use': 'An account already exists with this email.',
    'auth/weak-password': 'Use a stronger password with at least 6 characters.',
    'auth/popup-closed-by-user': 'Google sign-in was closed before completion.',
    'auth/unauthorized-domain': 'Add this website domain to Firebase Authentication authorized domains.',
    'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
    'permission-denied': 'You do not have permission to do that.',
    'firestore/permission-denied': 'You do not have permission to do that.'
  };
  return map[code] || error?.message?.replace(/^Firebase:\s*/i, '') || 'Something went wrong. Please try again.';
}

async function boot() {
  if (appStarted) return;
  appStarted = true;
  root.innerHTML = loadingScreen();
  try {
    const env = await initFirebase();
    setState({ mode: env.mode, initialized: true });
    stopAuth = observeAuth(env.mode, handleAuthChange);
  } catch (error) {
    console.error(error);
    setState({ mode: 'demo', initialized: true });
    toast('Firebase could not initialize. Opening preview mode.', 'error');
    stopAuth = observeAuth('demo', handleAuthChange);
  }
}

async function handleAuthChange(user) {
  stopPosts?.(); stopPosts = null;
  stopComments?.(); stopComments = null;
  stopMessages?.(); stopMessages = null;
  reactionState = { saved: new Set(), liked: new Set() };
  adminCapability = false;
  currentAdminOpportunities = [];
  adminPreviewRows = [];
  adminImportSource = '';
  setState({ user, profile: null, posts: [], notifications: [], conversations: [], messages: [], unreadCount: 0 });

  if (!user) {
    renderAuth('login');
    return;
  }

  root.innerHTML = loadingScreen('Loading your Tefsen space…');
  try {
    const [profile, reactions, notifications, conversations] = await Promise.all([
      getProfile(state.mode, user).catch(() => normalizeUser({ uid: user.uid, fullName: user.displayName || user.email || 'Tefsen User', email: user.email || '' }, user.uid)),
      getReactionIds(state.mode, user.uid).catch(() => ({ saved: new Set(), liked: new Set() })),
      getNotifications(state.mode, user.uid).catch(() => []),
      getConversations(state.mode, user.uid).catch(() => [])
    ]);
    reactionState = reactions;
    setState({
      profile,
      notifications,
      conversations,
      unreadCount: notifications.filter(n => !n.read).length
    });
    adminCapability = await getAdminCapability(state.mode, user, profile).catch(() => false);
    stopPosts = subscribePosts(state.mode, posts => {
      setState({ posts });
      renderRoute();

      // Reconcile the current user's exact like documents and server counts.
      // This avoids stale hearts/counts after refresh when collection-group
      // queries or post counter writes are blocked by Firestore rules.
      const visibleIds = posts.slice(0, 20).map(post => post.id).filter(Boolean);
      const hydrationKey = `${state.user?.uid || ''}:${visibleIds.join('|')}`;
      const now = Date.now();
      if (visibleIds.length && (hydrationKey !== likeHydrationKey || now - likeHydrationAt > 30000)) {
        likeHydrationKey = hydrationKey;
        likeHydrationAt = now;
        const run = ++likeHydrationRun;
        void hydratePostLikeState(state.mode, state.user.uid, visibleIds).then(result => {
          if (run !== likeHydrationRun) return;
          reactionState.liked = result.liked;
          let changed = false;
          for (const post of posts) {
            if (!result.counts.has(post.id)) continue;
            const next = result.counts.get(post.id);
            if (Number(post.likeCount || 0) !== next) { post.likeCount = next; changed = true; }
          }
          if (changed) setState({ posts: [...posts] });
          renderRoute();
        }).catch(error => console.warn('Like-state reconciliation failed:', error));
      }
    }, error => {
      console.error(error);
      toast('Could not load posts. Check Firestore rules and collection mapping.', 'error');
      renderRoute();
    });
    if (!location.hash || location.hash === '#/') go('home'); else renderRoute();
  } catch (error) {
    console.error(error);
    toast(humanError(error), 'error');
    renderRoute();
  }
}

function loadingScreen(text = 'Opening Tefsen Web…') {
  return `<div style="min-height:100vh;display:grid;place-items:center;padding:24px"><div style="text-align:center;color:#9fb1c6"><img src="assets/tefsen-logo.png" alt="Tefsen" style="width:86px;height:86px;object-fit:contain;border-radius:24px;margin-bottom:16px"><div>${escapeHTML(text)}</div></div></div>`;
}

function renderAuth(mode = 'login') {
  const isRegister = mode === 'register';
  root.innerHTML = `
    <main class="auth-page">
      <section class="auth-art">
        <a class="auth-brand" href="../"><img src="assets/tefsen-logo.png" alt=""><span>Tefsen</span></a>
        <div class="auth-message">
          <h1>Find your path.<br><span>Build your future.</span></h1>
          <p>Discover student opportunities, understand requirements, prepare your application journey, and learn from students moving toward similar goals.</p>
        </div>
        <div class="auth-proof"><span>✓ Student focused</span><span>✓ Opportunity driven</span><span>✓ Private journey tools</span></div>
      </section>
      <section class="auth-panel">
        <div class="auth-card">
          ${state.mode === 'demo' ? `<div class="demo-banner"><span><b>Preview mode:</b> Firebase is not connected yet.</span><a href="#" data-demo-info>Setup</a></div>` : ''}
          <h2>${isRegister ? 'Create your account' : 'Welcome back'}</h2>
          <p>${isRegister ? 'Build your Student Passport and start finding opportunities that fit your goals.' : 'Sign in to continue to Tefsen Web.'}</p>
          <form class="form-grid" data-auth-form="${isRegister ? 'register' : 'login'}">
            ${isRegister ? `<div class="field"><label for="fullName">Full name</label><input class="input" id="fullName" name="fullName" autocomplete="name" required maxlength="80"></div>` : ''}
            <div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" autocomplete="email" required></div>
            <div class="field"><label for="password">Password</label><input class="input" id="password" name="password" type="password" autocomplete="${isRegister ? 'new-password' : 'current-password'}" minlength="6" required></div>
            <div class="form-error" data-auth-error></div>
            <button class="btn btn-primary btn-block" type="submit">${isRegister ? 'Create account' : 'Sign in'}</button>
          </form>
          ${!isRegister ? `<button class="btn" style="background:none;color:#74d9f5;padding:8px 0;margin-top:4px" type="button" data-forgot>Forgot password?</button>` : ''}
          <div class="divider">or</div>
          <button class="btn btn-secondary btn-block" type="button" data-google><span class="google-mark"></span> Continue with Google</button>
          ${state.mode === 'demo' ? `<button class="btn btn-ghost btn-block" style="margin-top:10px" type="button" data-demo-login>${icon('eye',18)} Open complete demo</button>` : ''}
          <div class="auth-switch">${isRegister ? 'Already have an account?' : 'New to Tefsen?'} <button type="button" data-auth-switch="${isRegister ? 'login' : 'register'}">${isRegister ? 'Sign in' : 'Create account'}</button></div>
        </div>
      </section>
    </main>`;
}

function demoBanner() {
  if (state.mode !== 'demo') return '';
  return `<div class="demo-banner"><span><b>Interface preview mode.</b> Add your Firebase Web config to sync real Tefsen accounts and data.</span><a href="#" data-demo-info>View setup</a></div>`;
}

function renderShell(content, options = {}) {
  const route = currentRoute();
  const p = state.profile || {};
  const rightContent = options.right === false ? '' : renderRightbar();
  root.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <a class="topbar-brand" href="../"><img src="assets/tefsen-logo.png" alt=""><span>Tefsen</span></a>
        <div class="topbar-center">
          <form class="global-search" data-global-search-form>
            <span class="mobile-top-brand"><img src="assets/tefsen-logo.png" alt=""><span>Tefsen</span></span>
            <span class="search-icon">${icon('search',18)}</span>
            <input name="q" value="${escapeHTML(state.searchQuery)}" placeholder="Search students, stories and community…" aria-label="Search Tefsen">
            <span class="search-kbd">Ctrl K</span>
          </form>
        </div>
        <div class="topbar-actions">
          <button class="icon-button desktop-only" type="button" data-route="messages" aria-label="Messages">${icon('message',19)}</button>
          <button class="icon-button hide-small" type="button" data-route="notifications" aria-label="Notifications">${icon('bell',19)}${state.unreadCount ? `<span class="badge-dot">${Math.min(state.unreadCount, 99)}</span>` : ''}</button>
          <button class="top-avatar" type="button" data-profile-menu aria-label="Open account menu" aria-haspopup="menu" aria-expanded="${state.ui.profileMenu ? 'true' : 'false'}"><span class="top-avatar-fallback">${escapeHTML(initials(p.fullName || 'TU'))}</span>${safeUrl(p.photoUrl || '') ? `<img src="${safeUrl(p.photoUrl)}" alt="${escapeHTML(p.fullName || 'Profile')}" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}</button>
        </div>
      </header>

      <aside class="sidebar">
        <nav class="nav-list" aria-label="Tefsen navigation">
          ${navItems.filter(([id]) => ['home','opportunities','passport','journeys','explore'].includes(id)).map(([id,label,ic]) => navButton(id,label,ic,route)).join('')}
        </nav>
        <div class="nav-divider"></div>
        <div class="sidebar-cta"><button class="btn btn-primary btn-block" data-route="opportunities">${icon('compass',18)} Find opportunities</button></div>
        <nav class="nav-list">
          ${navItems.filter(([id]) => ['notifications','messages','profile','settings'].includes(id)).map(([id,label,ic]) => navButton(id,label,ic,route)).join('')}${adminCapability ? navButton('admin','Admin review','settings',route) : ''}
        </nav>
        <button class="sidebar-profile" type="button" data-route="profile">
          ${avatar(p,'sm')}
          <span style="min-width:0;text-align:left"><b>${escapeHTML(p.fullName || 'Tefsen User')}</b><small>${escapeHTML(normalizeRole(p.role || 'Student'))}</small></span>
        </button>
      </aside>

      ${rightContent ? `<aside class="rightbar">${rightContent}</aside>` : ''}

      <main class="main-area"><div class="content-wrap ${options.wide ? 'wide' : ''}">${content}</div></main>

      <nav class="mobile-bottom" aria-label="Mobile navigation">
        ${mobileNavButton('home','home',route,'Home')}
        ${mobileNavButton('opportunities','compass',route,'Opportunities')}
        ${mobileNavButton('passport','user',route,'Student Passport')}
        ${mobileNavButton('journeys','check',route,'Journey')}
        ${mobileNavButton('explore','compass',route,'Community')}
      </nav>
    </div>
    ${state.ui.profileMenu ? renderProfileDropdown() : ''}`;
}

function navButton(id, label, ic, route) {
  const active = id === route || (id === 'saved' && state.activeFeedTab === 'saved' && route === 'home');
  return `<button class="nav-item ${active ? 'active' : ''}" type="button" data-route="${id}"><span class="nav-icon">${icon(ic,20)}</span><span>${escapeHTML(label)}</span>${id === 'notifications' && state.unreadCount ? `<span class="badge-dot" style="position:static;margin-left:auto;border:0">${Math.min(99,state.unreadCount)}</span>` : ''}</button>`;
}

function mobileNavButton(id, ic, route, label) {
  return `<button class="${route === id ? 'active' : ''}" type="button" data-route="${id}" aria-label="${label}">${icon(ic,21)}</button>`;
}

function renderProfileDropdown() {
  const p = state.profile || {};
  const role = normalizeRole(p.role || 'Student');
  const isAdmin = String(p.role || '').trim().toLowerCase() === 'admin';
  const plan = isAdmin ? 'Admin Full Access' : (p.subscriptionActive ? 'Student Plus' : 'Free Student');
  return `<div class="profile-menu-backdrop" data-profile-menu-dismiss aria-hidden="true"></div>
    <section class="dropdown profile-dropdown" data-dropdown role="menu" aria-label="Tefsen account menu">
      <div class="dropdown-user dropdown-user-premium">
        ${avatar(p,'sm')}
        <div><b>${escapeHTML(p.fullName || 'Tefsen User')}</b><small>${escapeHTML(role)} · ${escapeHTML(plan)}</small></div>
      </div>
      <div class="dropdown-plan-chip">${isAdmin ? icon('check',15) : icon('info',15)} <span>${escapeHTML(plan)}</span></div>
      <div class="dropdown-separator"></div>
      <button type="button" data-route="profile" role="menuitem">${icon('user',17)} <span>View profile</span><small>Public profile and posts</small></button>
      <button type="button" data-route="subscription" role="menuitem">${icon('info',17)} <span>Subscription</span><small>Plan, limits and billing</small></button>
      <button type="button" data-route="explore" role="menuitem">${icon('compass',17)} <span>Community</span><small>Subjects, universities and outcomes</small></button>
      <button type="button" data-route="saved" role="menuitem">${icon('bookmark',17)} <span>Saved community posts</span><small>Discussions and student stories you saved</small></button>
      <button type="button" data-route="journeys" role="menuitem">${icon('check',17)} <span>Application journey</span><small>Saved opportunities, tasks and progress</small></button>
      <button type="button" data-route="notifications" role="menuitem">${icon('bell',17)} <span>Notifications</span><small>Replies and account activity</small></button>
      <button type="button" data-route="settings" role="menuitem">${icon('settings',17)} <span>Settings</span><small>Profile and preferences</small></button>
      ${adminCapability ? `<button type="button" data-route="admin" role="menuitem">${icon('check',17)} <span>Admin review</span><small>Verify and manage opportunities</small></button>` : ''}
      <div class="dropdown-separator"></div>
      <button type="button" class="dropdown-danger" data-logout role="menuitem">${icon('logout',17)} <span>Sign out</span></button>
    </section>`;
}

function syncProfileMenu() {
  document.querySelectorAll('.profile-menu-backdrop, .profile-dropdown').forEach(el => el.remove());
  const trigger = document.querySelector('[data-profile-menu]');
  if (!state.ui.profileMenu) {
    trigger?.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('profile-menu-open');
    return;
  }
  root.insertAdjacentHTML('afterend', renderProfileDropdown());
  trigger?.setAttribute('aria-expanded', 'true');
  document.documentElement.classList.add('profile-menu-open');
}

function renderRightbar() {
  const successCount = state.posts.filter(post => post.postType === 'success_story').length;
  return `
    <section class="widget">
      <h3>Your path</h3>
      <button class="widget-link" style="width:100%;background:none;color:inherit;text-align:left;cursor:pointer" type="button" data-route="passport"><span class="notification-icon">${icon('user',17)}</span><div><b>Student Passport</b><small>Keep your opportunity profile current</small></div></button>
      <button class="widget-link" style="width:100%;background:none;color:inherit;text-align:left;cursor:pointer" type="button" data-route="journeys"><span class="notification-icon">${icon('check',17)}</span><div><b>Application Journey</b><small>Tasks, deadlines and progress</small></div></button>
      <button class="widget-link" style="width:100%;background:none;color:inherit;text-align:left;cursor:pointer" type="button" data-route="opportunities"><span class="notification-icon">${icon('compass',17)}</span><div><b>Opportunities</b><small>Find verified paths worth pursuing</small></div></button>
    </section>
    <section class="widget">
      <h3>Community outcomes</h3>
      <div class="widget-link"><span class="notification-icon">${icon('check',17)}</span><div><b>${successCount} success stor${successCount===1?'y':'ies'}</b><small>Shared voluntarily by students</small></div></div>
      <button class="widget-link" style="width:100%;background:none;color:inherit;text-align:left;cursor:pointer" type="button" data-route="explore"><span class="notification-icon">${icon('compass',17)}</span><div><b>Open Community</b><small>Subjects, universities and intakes</small></div></button>
    </section>
    <div class="footer-mini"><a href="../privacy.html">Privacy</a> · <a href="../terms.html">Terms</a> · <a href="../delete-account/">Delete account</a><br>© ${new Date().getFullYear()} Tefsen</div>`;
}

function scorePost(p) { return Number(p.trendingScore || 0) || Number(p.likeCount || 0) * 2 + Number(p.commentCount || 0) * 3; }

function postBelongsToUser(post, userId) {
  const target = String(userId || '').trim();
  if (!target) return false;
  const ids = [
    post?.authorId, post?.userId, post?.uid, post?.ownerId,
    post?.createdBy, post?.authorUid, post?.user?.uid, post?.author?.uid
  ].map(value => String(value || '').trim()).filter(Boolean);
  return ids.includes(target);
}

function getFilteredPosts(tab = state.activeFeedTab) {
  const posts = [...state.posts];
  if (tab === 'trending') return posts.sort((a,b) => scorePost(b) - scorePost(a));
  if (tab === 'saved') return posts.filter(p => reactionState.saved.has(p.id));
  if (tab === 'liked') return posts.filter(p => reactionState.liked.has(p.id));
  return posts;
}

function postTypeBadgeMarkup(post) {
  if (post.postType === 'success_story') return '<span class="story-type success">✓ Success story</span>';
  if (post.postType === 'journey_story') return '<span class="story-type journey">Journey story</span>';
  return '';
}

function structuredPostMarkup(post) {
  if (post.postType === 'success_story') {
    const s = post.successData || {};
    const facts = [
      ['University', s.university],
      ['Opportunity', s.opportunityName],
      ['Country', s.country],
      ['Subject', s.subject],
      ['Study level', s.studyLevel],
      ['Intake', s.intake],
      ['Funding', s.fundingType]
    ].filter(([,value]) => value);
    return `
      <div style="margin:0 0 10px">${postTypeBadgeMarkup(post)}</div>
      ${facts.length ? `<div class="success-facts">${facts.map(([label,value]) => `<div class="success-fact"><small>${escapeHTML(label)}</small><b>${escapeHTML(value)}</b></div>`).join('')}</div>` : ''}
      <div class="community-banner">This is a student's shared experience, not an official statement of current scholarship or admission requirements.</div>`;
  }
  if (post.postType === 'journey_story') {
    const milestones = post.publicMilestones || [];
    return `
      <div style="margin:0 0 10px">${postTypeBadgeMarkup(post)}</div>
      ${milestones.length ? `<div class="public-milestones">${milestones.map(item => `<div class="public-milestone"><span class="public-milestone-dot"></span><div><b>${escapeHTML(item.stage || 'Milestone')}${item.month ? ` · ${escapeHTML(item.month)}` : ''}</b>${item.note ? `<p>${escapeHTML(item.note)}</p>` : ''}</div></div>`).join('')}</div>` : ''}
      <div class="community-banner">Only milestones this student explicitly chose to publish are shown. Private Tefsen Journey data is not displayed here automatically.</div>`;
  }
  return '';
}

function postCard(post) {
  const liked = reactionState.liked.has(post.id);
  const saved = reactionState.saved.has(post.id);
  const displayTitle = post.title || (post.content ? post.content.slice(0,110) : 'Untitled discussion');
  return `<article class="panel post-card" data-post-id="${escapeHTML(post.id)}">
    <header class="post-head">
      <button style="border:0;background:none;padding:0;cursor:pointer" data-route="profile/${encodeURIComponent(post.authorId || '')}">${avatar({ fullName: post.authorName, photoUrl: post.authorPhotoUrl }, '', '')}</button>
      <div class="post-head-main"><button class="user-name-link" type="button" data-route="profile/${encodeURIComponent(post.authorId || '')}"><b>${escapeHTML(post.authorName || 'Tefsen User')} ${verifiedMark(post.verified, post.role)}</b></button><small>${rolePill(post.role)} &nbsp; ${relativeTime(post.createdAt)}</small></div>
      <button class="post-menu" type="button" data-post-menu="${escapeHTML(post.id)}" aria-label="Post options">${icon('more',20)}</button>
    </header>
    <div class="post-body" data-route="post/${encodeURIComponent(post.id)}">
      ${structuredPostMarkup(post)}
      <span class="post-subject">${escapeHTML(post.subject || 'General')}</span>
      <h3>${escapeHTML(displayTitle)}</h3>
      ${post.content && post.content !== post.title ? `<p>${nl2br(post.content.length > 460 ? post.content.slice(0,460) + '…' : post.content)}</p>` : ''}
      ${post.imageUrls?.length ? `<div class="post-image-grid ${post.imageUrls.length > 1 ? 'two' : 'one'}">${post.imageUrls.slice(0,2).map((url,i)=>`<img class="post-image" src="${safeUrl(url)}" alt="Post image ${i+1}" loading="lazy" decoding="async">`).join('')}</div>` : (post.imageUrl ? `<img class="post-image" src="${safeUrl(post.imageUrl)}" alt="Post image" loading="lazy" decoding="async">` : '')}
      ${post.tags?.length ? `<div class="tag-row">${post.tags.slice(0,6).map(t => `<span class="tag">#${escapeHTML(t)}</span>`).join('')}</div>` : ''}
    </div>
    <footer class="post-actions">
      <button class="action-btn like ${liked ? 'active' : ''}" data-like="${escapeHTML(post.id)}" aria-label="Like post" aria-pressed="${liked}"><span class="action-icon">${icon('heart',17)}</span><span class="action-count">${formatCount(post.likeCount)}</span></button>
      <button class="action-btn" data-route="post/${encodeURIComponent(post.id)}" aria-label="Open comments"><span class="action-icon">${icon('comment',17)}</span><span class="action-count">${formatCount(post.commentCount)}</span></button>
      <button class="action-btn ${saved ? 'active' : ''}" data-save="${escapeHTML(post.id)}"><span>${icon('bookmark',17)}</span>${saved ? 'Saved' : 'Save'}</button>
      <button class="action-btn" data-share="${escapeHTML(post.id)}"><span>${icon('share',17)}</span>Share</button>
    </footer>
  </article>`;
}

async function renderHome() {
  renderShell(`<div class="v2-home"><section class="v2-dashboard-hero"><div><span class="opportunity-kicker">YOUR STUDENT JOURNEY</span><h1>Building your next step…</h1><p>Loading your Student Passport, opportunities and application progress.</p></div></section></div>`, { wide:true, right:false });

  try {
    const [passport, opportunities, journeys] = await Promise.all([
      getStudentPassport(state.mode, state.user.uid).catch(() => emptyStudentPassport(state.user.uid)),
      getOpportunities(state.mode).catch(() => []),
      listJourneyStates(state.mode, state.user.uid).catch(() => [])
    ]);

    currentStudentPassport = passport;
    currentJourneyStates = new Map(journeys.map(row => [row.opportunityId, row]));

    const completeness = studentPassportCompleteness(passport);
    const ranked = opportunities
      .map(item => ({ item, match: scoreOpportunityMatch(passport, item) }))
      .sort((a,b) => b.match.score - a.match.score);

    const visibleJourneys = journeys.filter(row => row.saved || row.started);
    const activeJourneys = visibleJourneys.filter(row => row.started && !['accepted','rejected','withdrawn'].includes(row.status));
    const savedCount = visibleJourneys.filter(row => row.saved).length;
    const opportunityMap = new Map(opportunities.map(item => [item.id, item]));

    const dated = visibleJourneys
      .map(row => ({ row, opportunity: opportunityMap.get(row.opportunityId), info: deadlineInfo(opportunityMap.get(row.opportunityId)?.deadline || '') }))
      .filter(entry => entry.info.valid && entry.info.daysRemaining >= 0)
      .sort((a,b) => a.info.daysRemaining - b.info.daysRemaining);
    const nearest = dated[0] || null;

    let nextAction = {
      title: 'Complete your Student Passport',
      detail: 'Add your education direction so Tefsen can make opportunity matching more useful.',
      route: 'passport',
      button: 'Open Passport'
    };
    if (completeness >= 70 && nearest && nearest.info.daysRemaining <= 14) {
      nextAction = {
        title: nearest.info.daysRemaining === 0 ? 'A deadline is today' : `Deadline in ${nearest.info.daysRemaining} days`,
        detail: nearest.opportunity?.title || 'Continue preparing your saved opportunity.',
        route: `journey/${encodeURIComponent(nearest.row.opportunityId)}`,
        button: 'Continue Journey'
      };
    } else if (completeness >= 70 && activeJourneys.length) {
      const row = activeJourneys[0], opportunity = opportunityMap.get(row.opportunityId);
      const progress = journeyProgress(row);
      nextAction = {
        title: `Continue: ${JOURNEY_LABELS[row.status] || row.status}`,
        detail: opportunity ? `${opportunity.title} · ${progress.completed}/${progress.total} tasks complete` : 'Continue your active application journey.',
        route: `journey/${encodeURIComponent(row.opportunityId)}`,
        button: 'Open Journey'
      };
    } else if (completeness >= 70 && ranked[0]) {
      nextAction = {
        title: 'Review your strongest current match',
        detail: `${ranked[0].item.title} · ${ranked[0].match.score}% structured match`,
        route: `opportunity/${encodeURIComponent(ranked[0].item.id)}`,
        button: 'Review Match'
      };
    }

    const goal = passport.studyGoal || (passport.mainField ? `${passport.targetEducationLevel || 'Study'} opportunity in ${passport.mainField}` : 'Set your education goal');
    const firstName = String(state.profile?.fullName || 'Student').trim().split(/\s+/)[0] || 'Student';
    const successes = state.posts.filter(post => post.postType === 'success_story').slice(0,2);

    const matchCard = ({item,match}) => `<button class="v2-opportunity-card" type="button" data-route="opportunity/${encodeURIComponent(item.id)}">
      <div class="v2-opportunity-meta"><span class="opportunity-chip">${escapeHTML(item.fundingType)}</span><span class="opportunity-chip">${escapeHTML(item.country)}</span></div>
      <h3>${escapeHTML(item.title)}</h3>
      <p>${escapeHTML(item.provider)}${item.university ? ` · ${escapeHTML(item.university)}` : ''}</p>
      <div class="v2-opportunity-foot"><span class="v2-match">${match.score}% match</span><span style="color:var(--v2-muted);font-size:.8rem">${escapeHTML(opportunityDateLabel(item.deadline))}</span></div>
    </button>`;

    const content = `${demoBanner()}<div class="v2-home">
      <section class="v2-dashboard-hero">
        <div>
          <span class="opportunity-kicker">YOUR STUDENT JOURNEY</span>
          <h1>Welcome, ${escapeHTML(firstName)}.<br>Make the next step clear.</h1>
          <p>Tefsen brings your education goal, matched opportunities, deadlines and application progress into one place.</p>
          <div class="v2-dashboard-actions">
            <button class="btn btn-primary" type="button" data-route="opportunities">Explore opportunities</button>
            <button class="btn btn-secondary" type="button" data-route="journeys">View your journey</button>
          </div>
        </div>
        <div class="v2-goal-card">
          <small>Current goal</small>
          <strong>${escapeHTML(goal)}</strong>
          <div class="v2-progress-track"><i style="width:${completeness}%"></i></div>
          <small>Student Passport · ${completeness}% complete</small>
          <button class="btn btn-ghost" type="button" data-route="passport">Update Passport</button>
        </div>
      </section>

      <section class="v2-next-action">
        <div class="v2-next-icon">${icon('check',20)}</div>
        <div><b>${escapeHTML(nextAction.title)}</b><small>${escapeHTML(nextAction.detail)}</small></div>
        <button class="btn btn-primary" type="button" data-route="${escapeHTML(nextAction.route)}">${escapeHTML(nextAction.button)}</button>
      </section>

      <section class="v2-kpi-grid" aria-label="Journey summary">
        <article class="v2-kpi"><span>Student Passport</span><strong>${completeness}%</strong><small>Profile readiness</small></article>
        <article class="v2-kpi"><span>Saved opportunities</span><strong>${savedCount}</strong><small>Worth tracking</small></article>
        <article class="v2-kpi"><span>Active journeys</span><strong>${activeJourneys.length}</strong><small>Applications in progress</small></article>
        <article class="v2-kpi"><span>Nearest deadline</span><strong>${nearest ? nearest.info.daysRemaining : '—'}</strong><small>${nearest ? (nearest.info.daysRemaining === 0 ? 'Today' : 'days remaining') : 'No dated deadline'}</small></article>
      </section>

      <section class="v2-section">
        <div class="v2-section-head"><div><h2>Matched for you</h2><p>Structured matches based on your Student Passport — not admission guarantees.</p></div><button class="btn btn-ghost" type="button" data-route="opportunities">View all</button></div>
        <div class="v2-opportunity-row">${ranked.length ? ranked.slice(0,3).map(matchCard).join('') : '<div class="panel opportunity-empty">Complete your Student Passport and add opportunities to start personalized matching.</div>'}</div>
      </section>

      <section class="v2-section">
        <div class="v2-section-head"><div><h2>Deadlines & progress</h2><p>Your official deadlines stay separate from personal preparation targets.</p></div><button class="btn btn-ghost" type="button" data-route="journeys">Open Journey</button></div>
        ${nearest ? `<div class="v2-next-action"><div class="v2-next-icon">${icon('check',20)}</div><div><b>${escapeHTML(nearest.opportunity?.title || 'Saved opportunity')}</b><small>${escapeHTML(nearest.info.label)} · ${escapeHTML(JOURNEY_LABELS[nearest.row.status] || nearest.row.status)}</small></div><button class="btn btn-secondary" type="button" data-route="journey/${encodeURIComponent(nearest.row.opportunityId)}">Prepare</button></div>` : '<div class="panel opportunity-empty">Save an opportunity to start tracking deadlines and preparation.</div>'}
      </section>

      <section class="v2-section">
        <div class="v2-section-head"><div><h2>Student outcomes</h2><p>Real student experiences support your decisions; official sources still verify requirements.</p></div><button class="btn btn-ghost" type="button" data-route="explore">Community</button></div>
        <div class="v2-outcome-grid">${successes.length ? successes.map(post => `<button class="v2-outcome-card" type="button" style="text-align:left;color:inherit;cursor:pointer" data-route="post/${encodeURIComponent(post.id)}"><span class="story-type success">✓ Success story</span><h3>${escapeHTML(post.title || 'Student success')}</h3><p>${escapeHTML((post.content || '').slice(0,180))}</p></button>`).join('') : '<div class="panel opportunity-empty">Student success stories will appear here as the community shares outcomes.</div>'}</div>
      </section>
    </div>`;

    renderShell(content, { wide:true, right:false });
  } catch (error) {
    console.error(error);
    renderShell(`${demoBanner()}${emptyState('info','Dashboard unavailable','Please try again.')}`, { wide:true, right:false });
  }
}

function renderSavedCommunity() {
  const posts = getFilteredPosts('saved');
  const content = `${demoBanner()}<header class="page-head"><div><h1>Saved community posts</h1><p>Your saved discussions and student stories.</p></div><button class="btn btn-secondary" type="button" data-route="explore">Community</button></header><div class="feed-list">${posts.length ? posts.map(postCard).join('') : emptyState('bookmark','No saved community posts','Save useful discussions or student stories and they will appear here.')}</div>`;
  renderShell(content);
}

async function renderExplore() {
  renderShell(`<header class="page-head"><div><h1>Community</h1><p>Loading student communities and shared experiences…</p></div></header><div class="loading-card"></div>`, { wide:true });
  try {
    const opportunities = await getOpportunities(state.mode).catch(() => []);
    const subjects = buildSubjectCommunities(state.posts, opportunities).filter(row => row.name !== 'General').slice(0, 12);
    const universities = buildUniversityCommunities(state.posts, opportunities).slice(0, 12);
    const successes = state.posts.filter(post => post.postType === 'success_story');
    const journeys = state.posts.filter(post => post.postType === 'journey_story');

    const content = `${demoBanner()}
      <div class="community-hub">
        <section class="community-hero">
          <span class="opportunity-kicker">OUTCOME-FOCUSED COMMUNITY</span>
          <h1>Learn from students who are moving forward.</h1>
          <p>Explore subject communities, university and intake spaces, scholarship success stories, and public journey experiences. Community experiences never replace official provider information.</p>
          <div class="community-action-row">
            <button class="btn btn-primary" type="button" data-share-success>Share a success</button>
            <button class="btn btn-secondary" type="button" data-share-journey-story>Share a journey story</button>
            <button class="btn btn-ghost" type="button" data-action="compose">${icon('plus',16)} General discussion</button>
          </div>
        </section>

        <section>
          <header class="page-head"><div><h2 style="margin:0">Subject communities</h2><p>Opportunities and student conversations grouped by field.</p></div></header>
          <div class="community-grid">${subjects.length ? subjects.map(row => `<button class="community-card" type="button" data-route="subject/${encodeURIComponent(row.name)}"><h3>${escapeHTML(row.name)}</h3><p>${row.opportunityCount} opportunities · ${row.postCount} community posts</p><div class="community-card-meta">${row.successCount ? `<span class="story-type success">${row.successCount} success stor${row.successCount===1?'y':'ies'}</span>` : ''}</div></button>`).join('') : '<div class="panel opportunity-empty">Subject communities will appear as opportunities and posts are added.</div>'}</div>
        </section>

        <section>
          <header class="page-head"><div><h2 style="margin:0">University communities</h2><p>Find opportunities, success stories and intake conversations around a university.</p></div></header>
          <div class="community-grid">${universities.length ? universities.map(row => `<button class="community-card" type="button" data-route="university/${encodeURIComponent(row.name)}"><h3>${escapeHTML(row.name)}</h3><p>${row.countries.length ? escapeHTML(row.countries.join(', ')) : 'Community university'}</p><div class="community-card-meta"><span class="opportunity-chip">${row.opportunityCount} opportunities</span><span class="opportunity-chip">${row.postCount} posts</span>${row.intakes.slice(0,2).map(intake => `<span class="opportunity-chip">${escapeHTML(intake)}</span>`).join('')}</div></button>`).join('') : '<div class="panel opportunity-empty">University communities will appear as verified opportunity and student data grows.</div>'}</div>
        </section>

        <section>
          <header class="page-head"><div><h2 style="margin:0">Student outcomes</h2><p>Shared voluntarily by students.</p></div><span class="opportunity-chip">${successes.length} success · ${journeys.length} journey</span></header>
          <div class="feed-list">${[...successes,...journeys].sort((x,y)=>scorePost(y)-scorePost(x)).slice(0,12).map(postCard).join('') || emptyState('compass','No outcome stories yet','Students can choose to share a success or selected public journey milestones.')}</div>
        </section>
      </div>`;
    renderShell(content, { wide:true });
  } catch (error) {
    console.error(error);
    renderShell(`${demoBanner()}${emptyState('info','Community unavailable','Please try again.')}`, { wide:true });
  }
}

function communityOpportunityList(items = []) {
  return items.length ? `<div class="community-compact-list">${items.slice(0,8).map(item => `<button class="community-compact-item" style="text-align:left;color:inherit;cursor:pointer" type="button" data-route="opportunity/${encodeURIComponent(item.id)}"><h4>${escapeHTML(item.title)}</h4><p>${escapeHTML(item.fundingType)} · ${escapeHTML(item.country)}${item.intake ? ` · ${escapeHTML(item.intake)}` : ''}</p></button>`).join('')}</div>` : '<p style="color:var(--muted)">No linked opportunities yet.</p>';
}

async function renderSubjectCommunity(subjectName) {
  const subject = String(subjectName || '').trim();
  renderShell(`<header class="page-head"><div><h1>${escapeHTML(subject || 'Subject')}</h1><p>Loading subject community…</p></div></header><div class="loading-card"></div>`, { wide:true });
  const opportunities = await getOpportunities(state.mode).catch(() => []);
  const data = subjectCommunityData(subject, state.posts, opportunities);
  const content = `${demoBanner()}<button class="btn btn-ghost" data-route="explore">${icon('back',17)} Community</button>
    <div class="community-detail-layout" style="margin-top:14px">
      <main>
        <section class="community-hero"><span class="opportunity-kicker">SUBJECT COMMUNITY</span><h1>${escapeHTML(data.name)}</h1><p>${data.opportunities.length} linked opportunities and ${data.posts.length} public community posts.</p><div class="community-action-row"><button class="btn btn-primary" data-community-discussion data-community-subject="${escapeHTML(data.name)}">Ask / share in this subject</button><button class="btn btn-secondary" data-share-success data-prefill-subject="${escapeHTML(data.name)}">Share a success</button></div></section>
        <header class="page-head"><div><h2 style="margin:0">Community posts</h2></div></header>
        <div class="feed-list">${data.posts.length ? data.posts.map(postCard).join('') : emptyState('compass','No posts yet','Start a useful discussion for this subject.')}</div>
      </main>
      <aside class="community-side"><section class="journey-panel"><h2>Opportunities</h2>${communityOpportunityList(data.opportunities)}</section><div class="community-banner">Community posts reflect student experiences and discussion. Verify scholarship and university requirements on official sources.</div></aside>
    </div>`;
  renderShell(content, { wide:true });
}

async function renderUniversityCommunity(universityName) {
  const university = String(universityName || '').trim();
  renderShell(`<header class="page-head"><div><h1>${escapeHTML(university || 'University')}</h1><p>Loading university community…</p></div></header><div class="loading-card"></div>`, { wide:true });
  const opportunities = await getOpportunities(state.mode).catch(() => []);
  const data = universityCommunityData(university, state.posts, opportunities);
  const content = `${demoBanner()}<button class="btn btn-ghost" data-route="explore">${icon('back',17)} Community</button>
    <div class="community-detail-layout" style="margin-top:14px">
      <main>
        <section class="community-hero"><span class="opportunity-kicker">UNIVERSITY COMMUNITY</span><h1>${escapeHTML(data.name)}</h1><p>${data.countries.length ? escapeHTML(data.countries.join(', ')) : 'Student community'} · ${data.opportunities.length} linked opportunities · ${data.posts.length} public posts.</p><div class="community-action-row"><button class="btn btn-primary" data-community-discussion data-community-university="${escapeHTML(data.name)}">Ask this community</button><button class="btn btn-secondary" data-share-success data-prefill-university="${escapeHTML(data.name)}">Share a success</button></div></section>
        <header class="page-head"><div><h2 style="margin:0">Student posts</h2></div></header>
        <div class="feed-list">${data.posts.length ? data.posts.map(postCard).join('') : emptyState('compass','No university posts yet','Start a useful university discussion or share an outcome.')}</div>
      </main>
      <aside class="community-side">
        <section class="journey-panel"><h2>Linked opportunities</h2>${communityOpportunityList(data.opportunities)}</section>
        <section class="journey-panel"><h2>Intakes</h2><div class="community-compact-list">${data.intakes.length ? data.intakes.map(intake => `<button class="community-compact-item" type="button" style="text-align:left;color:inherit;cursor:pointer" data-route="intake/${encodeURIComponent(data.name)}/${encodeURIComponent(intake)}"><h4>${escapeHTML(intake)}</h4><p>Open intake community</p></button>`).join('') : '<p style="color:var(--muted)">No intake groups yet.</p>'}</div></section>
        <div class="community-banner">Official university/provider pages remain authoritative for admissions, fees, visas and scholarship requirements.</div>
      </aside>
    </div>`;
  renderShell(content, { wide:true });
}

async function renderIntakeCommunity(universityName, intakeName) {
  const university=String(universityName||'').trim(), intake=String(intakeName||'').trim();
  renderShell(`<header class="page-head"><div><h1>${escapeHTML(university)}</h1><p>Loading ${escapeHTML(intake)} intake community…</p></div></header><div class="loading-card"></div>`, { wide:true });
  const opportunities = await getOpportunities(state.mode).catch(() => []);
  const data = intakeCommunityData(university,intake,state.posts,opportunities);
  const content = `${demoBanner()}<button class="btn btn-ghost" data-route="university/${encodeURIComponent(university)}">${icon('back',17)} ${escapeHTML(university)}</button>
    <div class="community-detail-layout" style="margin-top:14px"><main><section class="community-hero"><span class="opportunity-kicker">INTAKE COMMUNITY</span><h1>${escapeHTML(intake)}</h1><p>${escapeHTML(university)} · connect around preparation, orientation and student questions without exposing private application or travel data.</p><div class="community-action-row"><button class="btn btn-primary" data-community-discussion data-community-university="${escapeHTML(university)}" data-community-intake="${escapeHTML(intake)}">Ask / share in this intake</button></div></section><header class="page-head"><div><h2 style="margin:0">Intake posts</h2></div></header><div class="feed-list">${data.posts.length ? data.posts.map(postCard).join('') : emptyState('compass','No intake posts yet','Start the first useful discussion for this intake.')}</div></main><aside class="community-side"><section class="journey-panel"><h2>Relevant opportunities</h2>${communityOpportunityList(data.opportunities)}</section><div class="community-banner">Do not post passport numbers, application IDs, booking references, exact addresses or other sensitive personal information.</div></aside></div>`;
  renderShell(content,{wide:true});
}




function opportunityDateLabel(value) {
  if (!value) return 'Deadline not listed';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `Deadline ${date.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' })}`;
}

function opportunityCard(item, match = null, journey = null) {
  const preview = item.verificationStatus === 'preview';
  const chips = [
    item.opportunityType,
    item.fundingType,
    item.country
  ].filter(Boolean).slice(0, 3);
  return `<article class="opportunity-card">
    <div class="opportunity-card-top">
      <div>
        <div class="opportunity-meta">${chips.map(value => `<span class="opportunity-chip">${escapeHTML(value)}</span>`).join('')}</div>
        <h3 style="margin-top:12px">${escapeHTML(item.title)}</h3>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
        ${match && match.score > 0 ? `<span class="opportunity-chip match-badge">${match.score}% match</span>` : ''}
        <span class="opportunity-chip ${preview ? 'preview' : ''}">${preview ? 'Preview' : escapeHTML(item.verificationStatus || 'Unverified')}</span>
      </div>
    </div>
    <p>${escapeHTML(item.summary || 'Open this opportunity to review the available details and requirements.')}</p>
    <div class="opportunity-meta">
      ${(item.subjects || []).slice(0, 3).map(value => `<span class="opportunity-chip">${escapeHTML(value)}</span>`).join('')}
    </div>
    <div class="opportunity-card-footer">
      <span class="opportunity-deadline">${escapeHTML(opportunityDateLabel(item.deadline))}</span>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
        <button class="btn btn-ghost" type="button" data-opportunity-save="${escapeHTML(item.id)}" data-opportunity-saved="${journey?.saved ? 'true' : 'false'}">${journey?.saved ? 'Saved' : 'Save'}</button>
        <button class="btn btn-secondary" type="button" data-route="opportunity/${encodeURIComponent(item.id)}">View details</button>
      </div>
    </div>
  </article>`;
}

async function renderOpportunities() {
  renderShell(`<header class="page-head"><div><h1>Opportunities</h1><p>Finding opportunities that fit your education journey…</p></div></header><div class="loading-card"></div>`, { wide:true });
  try {
    const [rawItems, passport, journeyRows] = await Promise.all([
      getOpportunities(state.mode),
      getStudentPassport(state.mode, state.user.uid).catch(() => emptyStudentPassport(state.user.uid)),
      listJourneyStates(state.mode, state.user.uid).catch(() => [])
    ]);
    currentStudentPassport = passport;
    currentJourneyStates = new Map(journeyRows.map(row => [row.opportunityId, row]));
    const completeness = studentPassportCompleteness(passport);
    const items = rawItems
      .map(item => ({ item, match: scoreOpportunityMatch(passport, item), journey: currentJourneyStates.get(item.id) || null }))
      .sort((a, b) => b.match.score - a.match.score);
    const fundedCount = rawItems.filter(item => /funded/i.test(item.fundingType || '')).length;
    const content = `${demoBanner()}
      <section class="opportunity-hero">
        <div class="opportunity-hero-card">
          <span class="opportunity-kicker">YOUR PATH TO OPPORTUNITY</span>
          <h1>Find the next step in your education journey.</h1>
          <p>Discover scholarships, research programs, exchanges and other student opportunities. Tefsen will keep official-source verification separate from community information.</p>
        </div>
        <div class="opportunity-stat-card">
          <span>Available now</span>
          <strong>${rawItems.length}</strong>
          <span>${fundedCount} funded opportunities in this view</span>
        </div>
      </section>
      <header class="page-head"><div><h2 style="margin:0">Discover opportunities</h2><p>Open a listing to review funding, subjects, requirements and source status.</p></div></header>
      <div class="passport-private-note" style="margin-bottom:16px">
        <span>${icon('user',18)}</span>
        <div><b>${completeness ? `Personalized using your Student Passport · ${completeness}% complete` : 'Complete your Student Passport for personalized matching'}</b><br><span>${completeness ? 'Matches are rule-based and explainable; they are not admission guarantees.' : 'Add your study level, field, nationality and funding preference to improve opportunity ranking.'}</span> <button class="btn btn-ghost" style="margin-left:8px;min-height:34px" type="button" data-route="passport">Open Passport</button></div>
      </div>
      <div class="opportunity-grid">${items.length ? items.map(({item,match,journey}) => opportunityCard(item, match, journey)).join('') : '<div class="opportunity-empty panel">No published opportunities are available yet. Tefsen will show verified listings here as they are added.</div>'}</div>`;
    renderShell(content, { wide:true });
  } catch (error) {
    console.error(error);
    renderShell(`${demoBanner()}<header class="page-head"><div><h1>Opportunities</h1><p>We could not load the opportunity catalogue.</p></div></header>${emptyState('info','Opportunities unavailable','Please try again after the opportunity collection and Firestore access are configured.')}`, { wide:true });
  }
}


function passportSelectOptions(values, current = '', placeholder = 'Choose one') {
  return `<option value="">${escapeHTML(placeholder)}</option>${values.map(value => `<option value="${escapeHTML(value)}" ${String(value) === String(current) ? 'selected' : ''}>${escapeHTML(value)}</option>`).join('')}`;
}

function checked(value) { return value ? 'checked' : ''; }

async function renderStudentPassport() {
  renderShell(`<header class="page-head"><div><h1>Student Passport</h1><p>Preparing your private opportunity profile…</p></div></header><div class="loading-card"></div>`, { wide:true });
  try {
    const passport = await getStudentPassport(state.mode, state.user.uid);
    currentStudentPassport = passport;
    const completeness = studentPassportCompleteness(passport);
    const levels = ['Secondary school','Diploma','Undergraduate','Master','Doctorate','Other'];
    const funding = ['Fully funded only','Fully or partially funded','Any funding','Undecided'];
    const english = ['Not started','Planning a test','Test booked','Test completed','Waiver / other evidence','Not sure'];
    const docs = passport.documentsReady || {};

    const content = `${demoBanner()}
      <div class="passport-page">
        <section class="passport-hero">
          <div>
            <span class="opportunity-kicker">PRIVATE OPPORTUNITY PROFILE</span>
            <h1>Build your Student Passport.</h1>
            <p>Tefsen uses this information to compare structured scholarship and program requirements. It is separate from your public community profile and is private by design.</p>
          </div>
          <div class="passport-progress"><div><strong>${completeness}%</strong><br><span>profile complete</span></div></div>
        </section>

        <div class="passport-private-note">
          <span>${icon('info',18)}</span>
          <div><b>Private by default.</b><br>Your nationality, GPA, preparation status and goals should not appear on your public Tefsen profile unless you explicitly choose to share something in a future feature.</div>
        </div>

        <form class="panel passport-form-section" data-student-passport-form>
          <h2>Academic direction</h2>
          <p>Use the information you know now. You can update it later.</p>
          <div class="passport-form-grid">
            <div class="field"><label>Current country</label><input class="input" name="currentCountry" value="${escapeHTML(passport.currentCountry)}" maxlength="120" placeholder="e.g. Sri Lanka"></div>
            <div class="field"><label>Nationality</label><input class="input" name="nationality" value="${escapeHTML(passport.nationality)}" maxlength="120" placeholder="e.g. Sri Lankan"></div>
            <div class="field"><label>Current education level</label><select class="select" name="currentEducationLevel">${passportSelectOptions(levels, passport.currentEducationLevel)}</select></div>
            <div class="field"><label>Target education level</label><select class="select" name="targetEducationLevel">${passportSelectOptions(levels, passport.targetEducationLevel)}</select></div>
            <div class="field"><label>Main field / subject</label><input class="input" name="mainField" value="${escapeHTML(passport.mainField)}" maxlength="120" placeholder="e.g. Computer Science"></div>
            <div class="field"><label>Current institution</label><input class="input" name="institution" value="${escapeHTML(passport.institution)}" maxlength="160" placeholder="University or school"></div>
            <div class="field"><label>GPA (optional)</label><input class="input" name="gpa" type="number" min="0" max="5" step="0.01" value="${passport.gpa ?? ''}" placeholder="e.g. 3.67"></div>
            <div class="field"><label>GPA scale</label><select class="select" name="gpaScale"><option value="4" ${Number(passport.gpaScale) === 4 ? 'selected' : ''}>4.0</option><option value="5" ${Number(passport.gpaScale) === 5 ? 'selected' : ''}>5.0</option></select></div>
            <div class="field passport-field-wide"><label>Preferred study countries</label><input class="input" name="preferredCountries" value="${escapeHTML((passport.preferredCountries || []).join(', '))}" maxlength="500" placeholder="Germany, Japan, USA"></div>
            <div class="field"><label>Funding preference</label><select class="select" name="fundingPreference">${passportSelectOptions(funding, passport.fundingPreference)}</select></div>
            <div class="field"><label>English-test status</label><select class="select" name="englishTestStatus">${passportSelectOptions(english, passport.englishTestStatus)}</select></div>
            <div class="field passport-field-wide"><label>Languages</label><input class="input" name="languages" value="${escapeHTML((passport.languages || []).join(', '))}" maxlength="500" placeholder="Sinhala, English"></div>
            <div class="field passport-field-wide"><label>Skills</label><input class="input" name="skills" value="${escapeHTML((passport.skills || []).join(', '))}" maxlength="600" placeholder="Python, UI design, research"></div>
            <div class="field passport-field-wide"><label>Study / career goal</label><textarea class="textarea" name="studyGoal" maxlength="300" placeholder="What opportunity are you trying to reach?">${escapeHTML(passport.studyGoal)}</textarea></div>
          </div>

          <div class="opportunity-section">
            <h2>Document readiness</h2>
            <p style="color:var(--muted)">Tefsen stores readiness status only here. Do not upload sensitive documents in this milestone.</p>
            <div class="passport-doc-grid">
              <label class="passport-doc"><input type="checkbox" name="docPassport" ${checked(docs.passport)}> Passport ready</label>
              <label class="passport-doc"><input type="checkbox" name="docTranscript" ${checked(docs.transcript)}> Academic transcript ready</label>
              <label class="passport-doc"><input type="checkbox" name="docEnglish" ${checked(docs.englishCertificate)}> English certificate ready</label>
              <label class="passport-doc"><input type="checkbox" name="docRecommendation" ${checked(docs.recommendationLetter)}> Recommendation letter ready</label>
              <label class="passport-doc"><input type="checkbox" name="docCv" ${checked(docs.cv)}> CV / resume ready</label>
              <label class="passport-doc"><input type="checkbox" name="docStatement" ${checked(docs.personalStatement)}> Personal statement ready</label>
            </div>
          </div>

          <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:20px">
            <button class="btn btn-secondary" type="button" data-route="opportunities">View opportunities</button>
            <button class="btn btn-primary" type="submit">Save Student Passport</button>
          </div>
        </form>
      </div>`;
    renderShell(content, { wide:true });
  } catch (error) {
    console.error(error);
    renderShell(`${demoBanner()}${emptyState('info','Student Passport unavailable','Secure Student Passport access is not configured yet. Review Firestore rules before production use.')}`, { wide:true });
  }
}

function eligibilityCheckMarkup(result) {
  const marks = { met:'✓', action:'!', not_met:'×', unknown:'?' };
  const score = result.compatibility === null ? '—' : `${result.compatibility}%`;
  return `<section class="opportunity-section">
    <h2>Can I Apply?</h2>
    <div class="eligibility-summary">
      <div class="eligibility-score"><div><strong>${score}</strong><br><span style="color:var(--muted)">known criteria matched</span></div></div>
      <div>
        <h3 style="margin-top:0">${escapeHTML(result.summary)}</h3>
        <p style="color:var(--muted);line-height:1.6">${escapeHTML(result.disclaimer)}</p>
        <button class="btn btn-secondary" type="button" data-route="passport">Update Student Passport</button>
      </div>
    </div>
    <div class="eligibility-checks">
      ${result.checks.map(item => `<div class="eligibility-check ${item.status}"><span class="eligibility-mark">${marks[item.status] || '?'}</span><div><b>${escapeHTML(item.label)}</b><p>${escapeHTML(item.message)}</p></div></div>`).join('')}
    </div>
  </section>`;
}

async function renderOpportunityDetail(opportunityId) {
  renderShell(`<button class="btn btn-ghost" data-route="opportunities">${icon('back',17)} Back to opportunities</button><div class="loading-card" style="margin-top:14px"></div>`, { wide:true });
  try {
    const [item, passport, journey] = await Promise.all([
      getOpportunityById(state.mode, opportunityId),
      getStudentPassport(state.mode, state.user.uid).catch(() => emptyStudentPassport(state.user.uid)),
      getJourneyState(state.mode, state.user.uid, opportunityId).catch(() => null)
    ]);
    currentStudentPassport = passport;
    if (journey) currentJourneyStates.set(opportunityId, journey);
    if (!item) {
      renderShell(`<button class="btn btn-ghost" data-route="opportunities">${icon('back',17)} Back</button>${emptyState('info','Opportunity not found','This listing may be unavailable, private, expired, or not yet published.')}`, { wide:true });
      return;
    }

    const source = safeUrl(item.officialSourceUrl || '');
    const preview = item.verificationStatus === 'preview';
    const eligibility = evaluateEligibility(passport, item);
    const list = (values, fallback) => values?.length
      ? `<ul class="opportunity-list">${values.map(value => `<li>${escapeHTML(value)}</li>`).join('')}</ul>`
      : `<p style="color:var(--muted)">${escapeHTML(fallback)}</p>`;

    const content = `${demoBanner()}
      <button class="btn btn-ghost" data-route="opportunities">${icon('back',17)} Back to opportunities</button>
      <div class="opportunity-detail-layout" style="margin-top:14px">
        <article class="opportunity-detail-card">
          <span class="opportunity-kicker">${escapeHTML(item.opportunityType)} · ${escapeHTML(item.country)}</span>
          <h1>${escapeHTML(item.title)}</h1>
          <p style="color:var(--muted);line-height:1.65">${escapeHTML(item.summary || 'Opportunity details')}</p>
          <div class="opportunity-meta">
            <span class="opportunity-chip">${escapeHTML(item.fundingType)}</span>
            ${(item.studyLevels || []).map(value => `<span class="opportunity-chip">${escapeHTML(value)}</span>`).join('')}
            <span class="opportunity-chip ${preview ? 'preview' : ''}">${preview ? 'Preview data' : escapeHTML(item.verificationStatus)}</span>
          </div>

          <section class="opportunity-section">
            <h2>Fields of study</h2>
            ${list(item.subjects, 'Subject information has not been added yet.')}
          </section>
          <section class="opportunity-section">
            <h2>What it may cover</h2>
            ${list(item.benefits, 'Funding-benefit details have not been added yet.')}
          </section>
          <section class="opportunity-section">
            <h2>Eligibility & requirements</h2>
            ${list(item.requirements, 'Structured eligibility requirements have not been added yet.')}
          </section>
          <section class="opportunity-section">
            <h2>Required documents</h2>
            ${list(item.requiredDocuments, 'Required-document information has not been added yet.')}
          </section>
          ${eligibilityCheckMarkup(eligibility)}
        </article>

        <aside class="opportunity-detail-card">
          <div class="opportunity-section" style="margin-top:0;padding-top:0;border-top:0">
            <h2>Provider</h2>
            <p><b>${escapeHTML(item.provider)}</b>${item.university ? `<br><span style="color:var(--muted)">${escapeHTML(item.university)}</span>` : ''}</p>
          </div>
          <div class="opportunity-section">
            <h2>Deadline</h2>
            <p>${escapeHTML(opportunityDateLabel(item.deadline))}</p>
          </div>
          <div class="opportunity-section">
            <h2>Source status</h2>
            <div class="opportunity-source-note">${preview
              ? 'This is clearly marked preview data for development. It is not a real scholarship listing.'
              : 'Tefsen summarizes opportunity data for discovery. Always confirm final requirements on the official provider source before applying.'}</div>
            ${source ? `<a class="btn btn-primary btn-block" style="margin-top:12px" href="${source}" target="_blank" rel="noopener noreferrer">Open official source</a>` : ''}
          </div>
          <div class="opportunity-section">
            <h2>Your application journey</h2>
            ${journey?.started ? `<p style="color:var(--muted)">Current stage: <b style="color:var(--text)">${escapeHTML(JOURNEY_LABELS[journey.status] || journey.status)}</b></p>` : (journey?.saved ? '<p style="color:var(--muted)">Saved. Start a private journey when you are ready to prepare and track progress.</p>' : '<p style="color:var(--muted)">Save this opportunity or start a private journey to track preparation and progress.</p>')}
            <div class="journey-actions">
              <button class="btn btn-secondary" type="button" data-opportunity-save="${escapeHTML(item.id)}" data-opportunity-saved="${journey?.saved ? 'true' : 'false'}">${journey?.saved ? 'Saved' : 'Save opportunity'}</button>
              <button class="btn btn-primary" type="button" data-start-journey="${escapeHTML(item.id)}">${journey?.started ? 'Open journey' : 'Start journey'}</button>
            </div>
          </div>
        </aside>
      </div>`;
    renderShell(content, { wide:true });
  } catch (error) {
    console.error(error);
    renderShell(`<button class="btn btn-ghost" data-route="opportunities">${icon('back',17)} Back</button>${emptyState('info','Could not load opportunity','Please try again.')}`, { wide:true });
  }
}


function deadlineUrgencyClass(info) {
  if (!info?.valid) return '';
  if (info.state === 'expired') return 'expired';
  if (['today','1_6_days','7_14_days'].includes(info.state)) return 'urgent';
  return '';
}

function journeyStageLine(journey) {
  const linear = ['interested','preparing','ready_to_apply','applied','interview','accepted'];
  const current = journey?.status || 'interested';
  const currentIndex = linear.indexOf(current);
  return `<div class="journey-stage-line">${linear.map((status,index) => {
    const cls = status === current ? 'current' : (currentIndex >= 0 && index < currentIndex ? 'done' : '');
    return `<span class="journey-stage-pill ${cls}">${escapeHTML(JOURNEY_LABELS[status])}</span>`;
  }).join('')}${['rejected','withdrawn'].includes(current) ? `<span class="journey-stage-pill current">${escapeHTML(JOURNEY_LABELS[current])}</span>` : ''}</div>`;
}

function formatHistoryTime(value) {
  const date = new Date(Number(value || 0));
  if (Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleString(undefined, { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

function journeyCardMarkup(journey, opportunity) {
  const progress = journeyProgress(journey);
  const official = deadlineInfo(opportunity?.deadline || '');
  const title = opportunity?.title || 'Opportunity unavailable';
  const provider = opportunity?.provider || 'The original opportunity is not currently public.';
  return `<article class="journey-card">
    <div>
      <h3>${escapeHTML(title)}</h3>
      <p>${escapeHTML(provider)}</p>
      <div class="journey-card-meta">
        <span class="opportunity-chip">${escapeHTML(JOURNEY_LABELS[journey.status] || journey.status)}</span>
        <span class="opportunity-chip">${progress.completed}/${progress.total} tasks</span>
        ${journey.saved ? '<span class="opportunity-chip">Saved</span>' : ''}
      </div>
      <div style="margin-top:10px">
        <span class="journey-deadline ${deadlineUrgencyClass(official)}">${escapeHTML(official.label)}</span>
        ${journey.personalTargetDate ? `<span style="color:var(--muted)"> · Personal target ${escapeHTML(journey.personalTargetDate)}</span>` : ''}
      </div>
    </div>
    ${journey.started
      ? `<button class="btn btn-primary" type="button" data-route="journey/${encodeURIComponent(journey.opportunityId)}">Open journey</button>`
      : `<button class="btn btn-primary" type="button" data-start-journey="${escapeHTML(journey.opportunityId)}">Start journey</button>`}
  </article>`;
}

async function renderJourneys() {
  renderShell(`<header class="page-head"><div><h1>Your Journey</h1><p>Loading saved opportunities and application progress…</p></div></header><div class="loading-card"></div>`, { wide:true });
  try {
    const [journeys, opportunities] = await Promise.all([
      listJourneyStates(state.mode, state.user.uid),
      getOpportunities(state.mode).catch(() => [])
    ]);
    currentJourneyStates = new Map(journeys.map(row => [row.opportunityId, row]));
    const opportunityMap = new Map(opportunities.map(item => [item.id, item]));
    const visibleJourneys = journeys.filter(row => row.saved || row.started);
    visibleJourneys.sort((a, b) => {
      const aInfo = deadlineInfo(opportunityMap.get(a.opportunityId)?.deadline || '');
      const bInfo = deadlineInfo(opportunityMap.get(b.opportunityId)?.deadline || '');
      const aDays = aInfo.valid && aInfo.daysRemaining >= 0 ? aInfo.daysRemaining : Number.POSITIVE_INFINITY;
      const bDays = bInfo.valid && bInfo.daysRemaining >= 0 ? bInfo.daysRemaining : Number.POSITIVE_INFINITY;
      return aDays - bDays;
    });
    const active = visibleJourneys.filter(row => row.started && !['accepted','rejected','withdrawn'].includes(row.status));
    const saved = visibleJourneys.filter(row => row.saved).length;
    const withDeadline = visibleJourneys
      .map(row => ({ row, info: deadlineInfo(opportunityMap.get(row.opportunityId)?.deadline || '') }))
      .filter(entry => entry.info.valid && entry.info.daysRemaining >= 0)
      .sort((a,b) => a.info.daysRemaining - b.info.daysRemaining);
    const nearest = withDeadline[0]?.info;

    const content = `${demoBanner()}
      <div class="journey-page">
        <section class="journey-overview">
          <article>
            <span class="opportunity-kicker">PRIVATE APPLICATION WORKSPACE</span>
            <h1>Keep your next step visible.</h1>
            <p>Save opportunities, prepare required documents, set a personal target, and update your journey manually as your real application progresses.</p>
          </article>
          <article class="journey-stat"><strong>${active.length}</strong><span>active journeys</span></article>
          <article class="journey-stat"><strong>${nearest ? nearest.daysRemaining : '—'}</strong><span>${nearest ? 'days to nearest official deadline' : 'no dated deadline yet'} · ${saved} saved</span></article>
        </section>
        <div class="passport-private-note"><span>${icon('info',18)}</span><div><b>Private by default.</b><br>Application stage, notes, targets and checklist status are not published to your Tefsen community profile.</div></div>
        <header class="page-head"><div><h2 style="margin:0">Saved & active opportunities</h2><p>Official deadlines remain separate from your personal preparation target.</p></div><button class="btn btn-secondary" data-route="opportunities">Find opportunities</button></header>
        <div class="journey-list">${visibleJourneys.length ? visibleJourneys.map(row => journeyCardMarkup(row, opportunityMap.get(row.opportunityId))).join('') : emptyState('bookmark','No journeys yet','Save an opportunity or start a journey from an opportunity page.')}</div>
      </div>`;
    renderShell(content, { wide:true });
  } catch (error) {
    console.error(error);
    renderShell(`${demoBanner()}${emptyState('info','Journey unavailable','Secure journey access is not configured yet. Review Firestore rules before production use.')}`, { wide:true });
  }
}

async function renderJourneyDetail(opportunityId) {
  renderShell(`<button class="btn btn-ghost" data-route="journeys">${icon('back',17)} Back to Journey</button><div class="loading-card" style="margin-top:14px"></div>`, { wide:true });
  try {
    const [journey, opportunity] = await Promise.all([
      getJourneyState(state.mode, state.user.uid, opportunityId),
      getOpportunityById(state.mode, opportunityId).catch(() => null)
    ]);

    if (!journey) {
      renderShell(`<button class="btn btn-ghost" data-route="journeys">${icon('back',17)} Back</button>${emptyState('info','Journey not started','Open the opportunity and choose Start journey first.')}`, { wide:true });
      return;
    }

    const progress = journeyProgress(journey);
    const official = deadlineInfo(opportunity?.deadline || '');
    const personal = deadlineInfo(journey.personalTargetDate || '');
    const targetAfterOfficial = Boolean(personal.valid && official.valid && personal.date?.getTime() > official.date?.getTime());
    const nextStatuses = allowedJourneyTransitions(journey.status);
    const history = [...(journey.history || [])].reverse();
    const checklist = journey.checklist || [];

    const content = `${demoBanner()}
      <button class="btn btn-ghost" data-route="journeys">${icon('back',17)} Back to Journey</button>
      <div class="journey-layout" style="margin-top:14px">
        <main style="display:grid;gap:16px">
          <section class="journey-panel">
            <span class="opportunity-kicker">APPLICATION JOURNEY</span>
            <h1>${escapeHTML(opportunity?.title || 'Saved opportunity')}</h1>
            <p style="color:var(--muted)">${escapeHTML(opportunity?.provider || 'Opportunity details are not currently public.')}</p>
            ${journeyStageLine(journey)}
            <div class="opportunity-section">
              <h2>Current stage</h2>
              <p><b>${escapeHTML(JOURNEY_LABELS[journey.status] || journey.status)}</b></p>
              ${nextStatuses.length ? `<form class="journey-actions" data-journey-stage-form="${escapeHTML(opportunityId)}"><select class="select" name="status" required><option value="">Choose next stage</option>${nextStatuses.map(status => `<option value="${escapeHTML(status)}">${escapeHTML(JOURNEY_LABELS[status])}</option>`).join('')}</select><button class="btn btn-primary" type="submit">Update stage</button></form>` : '<p style="color:var(--muted)">This journey is currently in a final stage.</p>'}
            </div>
          </section>

          <section class="journey-panel">
            <div class="panel-title"><div><h2>Preparation checklist</h2><small>${progress.completed} of ${progress.total} complete</small></div><strong>${progress.percent}%</strong></div>
            <div class="journey-progress-bar"><i style="width:${progress.percent}%"></i></div>
            <div style="margin-top:14px">
              ${checklist.length ? checklist.map(task => `<div class="journey-task ${task.completed ? 'done' : ''}">
                <button class="btn btn-ghost" type="button" data-journey-task-toggle="${escapeHTML(task.id)}" data-opportunity-id="${escapeHTML(opportunityId)}" aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}">${task.completed ? '✓' : '○'}</button>
                <span>${escapeHTML(task.label)}<br><small>${task.source === 'system' ? 'From opportunity requirements' : 'Your custom task'}</small></span>
                ${task.source === 'custom' ? `<button class="btn btn-ghost" type="button" data-journey-task-delete="${escapeHTML(task.id)}" data-opportunity-id="${escapeHTML(opportunityId)}">Remove</button>` : ''}
              </div>`).join('') : '<p style="color:var(--muted)">No structured required-document tasks were available. Add your own preparation task below.</p>'}
            </div>
            <form class="journey-actions" style="margin-top:14px" data-journey-task-form="${escapeHTML(opportunityId)}"><input class="input" name="label" maxlength="240" required placeholder="Add a personal preparation task"><button class="btn btn-secondary" type="submit">Add task</button></form>
          </section>
        </main>

        <aside style="display:grid;gap:16px;align-content:start">
          <section class="journey-panel">
            <h2>Deadlines</h2>
            <p><b>Official deadline</b><br><span class="journey-deadline ${deadlineUrgencyClass(official)}">${escapeHTML(official.label)}</span></p>
            <p><b>Personal target</b><br><span class="journey-deadline ${deadlineUrgencyClass(personal)}">${personal.valid ? escapeHTML(personal.label) : 'Not set'}</span></p>
            <p style="color:var(--muted);font-size:.86rem">Your personal target never changes the official provider deadline.</p>
            ${targetAfterOfficial ? '<div class="opportunity-source-note">Your personal target is after the official deadline. Move your preparation target earlier.</div>' : ''}
          </section>

          <section class="journey-panel">
            <h2>Planning</h2>
            <form class="form-grid" data-journey-planning-form="${escapeHTML(opportunityId)}">
              <div class="field"><label>Personal preparation target</label><input class="input" type="date" name="personalTargetDate" value="${escapeHTML(journey.personalTargetDate || '')}"></div>
              <div class="field"><label>Private notes</label><textarea class="textarea" name="notes" maxlength="3000" placeholder="Questions, reminders, preparation notes…">${escapeHTML(journey.notes || '')}</textarea></div>
              <button class="btn btn-primary" type="submit">Save planning</button>
            </form>
          </section>

          <section class="journey-panel">
            <h2>History</h2>
            <div class="journey-history">${history.length ? history.map(item => `<div class="journey-history-item"><span class="journey-history-dot"></span><div><b>${escapeHTML(JOURNEY_LABELS[item.status] || item.status)}</b><br><small>${escapeHTML(formatHistoryTime(item.atMillis))}</small></div></div>`).join('') : '<p style="color:var(--muted)">No history recorded yet.</p>'}</div>
          </section>

          ${opportunity ? `<button class="btn btn-secondary" type="button" data-route="opportunity/${encodeURIComponent(opportunityId)}">View opportunity details</button>` : ''}
        </aside>
      </div>`;
    renderShell(content, { wide:true });
  } catch (error) {
    console.error(error);
    renderShell(`<button class="btn btn-ghost" data-route="journeys">${icon('back',17)} Back</button>${emptyState('info','Could not load journey','Please try again.')}`, { wide:true });
  }
}

function emptyState(ic, title, text) {
  return `<div class="panel empty-state"><div class="empty-icon">${icon(ic,26)}</div><h3>${escapeHTML(title)}</h3><p>${escapeHTML(text)}</p></div>`;
}

async function renderPostDetail(postId) {
  stopComments?.(); stopComments = null;
  let post = state.posts.find(p => p.id === postId);
  if (!post) {
    renderShell(`<div class="loading-card"></div>`);
    post = await getPost(state.mode, postId).catch(() => null);
  }
  if (!post) { renderShell(emptyState('info','Post not found','It may have been removed or you may not have permission to view it.')); return; }
  currentComments = [];
  const draw = () => {
    const liked = reactionState.liked.has(post.id), saved = reactionState.saved.has(post.id);
    const content = `<button class="btn btn-ghost" style="margin-bottom:14px" data-back>${icon('back',17)} Back</button>
      <article class="panel detail-card">
        <header class="post-head"><button class="avatar-route-button" type="button" data-route="profile/${encodeURIComponent(post.authorId || '')}">${avatar({fullName:post.authorName,photoUrl:post.authorPhotoUrl})}</button><div class="post-head-main"><button class="user-name-link" type="button" data-route="profile/${encodeURIComponent(post.authorId || '')}"><b>${escapeHTML(post.authorName)} ${verifiedMark(post.verified, post.role)}</b></button><small>${rolePill(post.role)} &nbsp; ${relativeTime(post.createdAt)}</small></div><button class="post-menu" data-post-menu="${escapeHTML(post.id)}">${icon('more',20)}</button></header>
        <div class="post-body">${structuredPostMarkup(post)}<span class="post-subject">${escapeHTML(post.subject || 'General')}</span><h1>${escapeHTML(post.title || 'Discussion')}</h1><p>${nl2br(post.content || '')}</p>${post.imageUrls?.length ? `<div class="post-image-grid ${post.imageUrls.length > 1 ? 'two' : 'one'}">${post.imageUrls.slice(0,2).map((url,i)=>`<img class="post-image" src="${safeUrl(url)}" alt="Post image ${i+1}">`).join('')}</div>` : (post.imageUrl ? `<img class="post-image" src="${safeUrl(post.imageUrl)}" alt="Post image">` : '')}${post.tags?.length ? `<div class="tag-row">${post.tags.map(t=>`<span class="tag">#${escapeHTML(t)}</span>`).join('')}</div>`:''}</div>
        <footer class="post-actions"><button class="action-btn like ${liked?'active':''}" data-like="${escapeHTML(post.id)}" aria-label="Like post" aria-pressed="${liked}"><span class="action-icon">${icon('heart',17)}</span><span class="action-count">${formatCount(post.likeCount)}</span></button><button class="action-btn" aria-label="Comments"><span class="action-icon">${icon('comment',17)}</span><span class="action-count">${formatCount(currentComments.length || post.commentCount)}</span></button><button class="action-btn ${saved?'active':''}" data-save="${escapeHTML(post.id)}"><span>${icon('bookmark',17)}</span>${saved?'Saved':'Save'}</button><button class="action-btn" data-share="${escapeHTML(post.id)}"><span>${icon('share',17)}</span>Share</button></footer>
      </article>
      <section class="panel answer-form"><div class="panel-title"><h3>Add an answer</h3><small>Be clear and respectful</small></div><form data-comment-form="${escapeHTML(post.id)}"><textarea class="textarea" name="content" placeholder="Write a useful answer…" required maxlength="5000"></textarea><div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="btn btn-primary" type="submit">Publish answer</button></div></form></section>
      <div class="answers-head"><h2 style="margin:0">${currentComments.length} ${currentComments.length===1?'Answer':'Answers'}</h2></div>
      <div>${currentComments.length ? currentComments.map(answerCard).join('') : emptyState('comment','No answers yet','Be the first to help with a thoughtful answer.')}</div>`;
    renderShell(content);
  };
  draw();
  stopComments = subscribeComments(state.mode, postId, comments => { currentComments = comments; draw(); }, e => toast(humanError(e),'error'));
}

function answerCard(answer) {
  const user = { fullName: answer.authorName || answer.userName || 'Tefsen User', photoUrl: answer.authorPhotoUrl || answer.profileImageUrl || '' };
  const authorId = answer.authorId || answer.userId || answer.uid || '';
  const avatarHtml = authorId ? `<button class="avatar-route-button" type="button" data-route="profile/${encodeURIComponent(authorId)}">${avatar(user,'sm')}</button>` : avatar(user,'sm');
  const nameHtml = authorId ? `<button class="user-name-link" type="button" data-route="profile/${encodeURIComponent(authorId)}"><b>${escapeHTML(user.fullName)} ${verifiedMark(answer.verified || answer.authorVerified, answer.role || answer.authorRole || 'Student')}</b></button>` : `<b>${escapeHTML(user.fullName)} ${verifiedMark(answer.verified || answer.authorVerified, answer.role || answer.authorRole || 'Student')}</b>`;
  return `<article class="panel answer-card"><header class="post-head">${avatarHtml}<div class="post-head-main">${nameHtml}<small>${rolePill(answer.role || answer.authorRole || 'Student')} &nbsp; ${relativeTime(answer.createdAt)}</small></div></header><p>${nl2br(answer.content || answer.text || '')}</p></article>`;
}

async function renderNotifications() {
  const rows = state.notifications;
  const content = `${demoBanner()}<header class="page-head"><div><h1>Notifications</h1><p>Updates from your questions, answers and community.</p></div></header>
    <section class="panel">${rows.length ? rows.map(notificationItem).join('') : emptyState('bell','You are all caught up','New activity will appear here.')}</section>`;
  renderShell(content);
}

function notificationItem(n) {
  const typeIcon = n.type === 'like' ? 'heart' : n.type === 'answer' ? 'comment' : 'bell';
  return `<button class="notification-item ${n.read ? '' : 'unread'}" type="button" style="width:100%;text-align:left;color:inherit;background:${n.read?'transparent':'rgba(22,173,239,.045)'};border-left:0;border-right:0;border-top:0" data-notification="${escapeHTML(n.id)}" data-post="${escapeHTML(n.postId || '')}"><span class="notification-icon">${icon(typeIcon,18)}</span><span><p><b>${escapeHTML(n.actorName || 'Tefsen')}</b> ${escapeHTML(n.text || n.message || 'sent you an update')}</p><small>${relativeTime(n.createdAt)}</small></span></button>`;
}

async function renderMessages(conversationId = '') {
  if (!state.conversations.length) {
    const conversations = await getConversations(state.mode, state.user.uid).catch(() => []);
    setState({ conversations });
  }
  const selected = state.conversations.find(c => c.id === conversationId) || state.conversations[0] || null;
  if (selected) {
    state.selectedConversation = selected;
    stopMessages?.();
    stopMessages = subscribeMessages(state.mode, selected.id, messages => {
      state.messages = messages;
      drawMessages(selected);
      requestAnimationFrame(() => document.querySelector('.chat-messages')?.scrollTo(0, 999999));
    }, e => toast(humanError(e),'error'));
  } else drawMessages(null);
}

function drawMessages(selected) {
  const convs = state.conversations;
  const content = `${demoBanner()}<header class="page-head"><div><h1>Messages</h1><p>Continue learning conversations privately.</p></div></header>
    <section class="panel messages-layout ${selected ? 'chat-open' : ''}">
      <div class="conversation-list"><div class="conversation-list-head"><b>Conversations</b></div>${convs.length ? convs.map(c => conversationItem(c,selected)).join('') : `<div class="empty-state"><h3>No conversations</h3><p>Open a user profile and start a conversation.</p></div>`}</div>
      <div class="chat-pane">${selected ? `<div class="chat-head"><button class="btn btn-icon btn-ghost" data-messages-back>${icon('back',18)}</button>${avatar({fullName:conversationTitle(selected)},'sm')}<b>${escapeHTML(conversationTitle(selected))}</b></div><div class="chat-messages">${state.messages.map(messageBubble).join('') || '<div class="empty-state"><p>Start the conversation.</p></div>'}</div><form class="chat-form" data-message-form="${escapeHTML(selected.id)}"><input class="input" name="text" maxlength="3000" placeholder="Write a message…" required><button class="btn btn-primary btn-icon" type="submit" aria-label="Send">${icon('send',18)}</button></form>` : `<div class="empty-state"><div class="empty-icon">${icon('message',25)}</div><h3>Select a conversation</h3><p>Your messages will appear here.</p></div>`}</div>
    </section>`;
  renderShell(content,{wide:true,right:false});
}

function conversationTitle(c) {
  if (c.title) return c.title;
  if (c.participantNames) {
    const keys = Object.keys(c.participantNames).filter(k => k !== state.user.uid);
    if (keys[0]) return c.participantNames[keys[0]] || 'Conversation';
  }
  return 'Conversation';
}
function conversationItem(c,selected) { return `<button class="conversation-item ${selected?.id===c.id?'active':''}" type="button" style="width:100%;border-left:0;border-right:0;border-top:0;color:inherit;text-align:left" data-conversation="${escapeHTML(c.id)}">${avatar({fullName:conversationTitle(c)},'sm')}<div><b>${escapeHTML(conversationTitle(c))}</b><small>${escapeHTML(c.lastMessage || 'Start a conversation')} · ${relativeTime(c.updatedAt)}</small></div></button>`; }
function messageBubble(m) { return `<div class="bubble ${m.senderId === state.user.uid ? 'mine' : ''}">${nl2br(m.text || m.content || '')}<small>${relativeTime(m.createdAt)}</small></div>`; }

async function renderLeaderboard() {
  if (!state.leaderboard.length) setState({ leaderboard: await getLeaderboard(state.mode).catch(()=>[]) });
  const content = `${demoBanner()}<header class="page-head"><div><h1>Leaderboard</h1><p>Recognising useful contributions across the community.</p></div></header>
    <section class="panel">${state.leaderboard.length ? state.leaderboard.map((u,i)=>`<button class="leaderboard-row" type="button" style="width:100%;border-left:0;border-right:0;border-top:0;background:none;color:inherit;text-align:left" data-route="profile/${encodeURIComponent(u.uid)}"><span class="rank ${i<3?'top':''}">${i+1}</span><span class="user-inline">${avatar(u,'sm')}<span><b>${escapeHTML(u.fullName)} ${verifiedMark(u.verified, u.role)}</b><small>${escapeHTML(normalizeRole(u.role))}</small></span></span><span class="points">${formatCount(u.points)} pts</span></button>`).join('') : emptyState('trophy','Leaderboard is empty','Points will appear as members contribute.')}</section>`;
  renderShell(content);
}

async function renderProfile(userId = '') {
  let profile = state.profile;
  if (userId && userId !== state.user.uid) {
    profile = await getUserById(state.mode, userId).catch(() => null);
    profile = profile || state.leaderboard.find(u => u.uid === userId) || { uid:userId, fullName:'Tefsen User', role:'Student' };
  }

  currentProfileView = profile;
  const own = !userId || userId === state.user.uid;
  const posts = state.posts.filter(p => postBelongsToUser(p, profile?.uid || ''));

  let follow = {
    following: false,
    followersCount: Number(profile?.followersCount || 0),
    followingCount: Number(profile?.followingCount || 0)
  };
  try {
    follow = await getFollowState(state.mode, state.user.uid, profile?.uid || '');
  } catch {
    // Keep the public profile usable if follow state is temporarily unavailable.
  }

  let passport = null;
  let journeys = [];
  if (own) {
    [passport, journeys] = await Promise.all([
      getStudentPassport(state.mode, state.user.uid).catch(() => emptyStudentPassport(state.user.uid)),
      listJourneyStates(state.mode, state.user.uid).catch(() => [])
    ]);
  }

  const completeness = own ? studentPassportCompleteness(passport || {}) : 0;
  const activeJourneys = own
    ? journeys.filter(row => row.started && !['accepted','rejected','withdrawn'].includes(row.status))
    : [];
  const savedOpportunities = own ? journeys.filter(row => row.saved).length : 0;
  const goal = own
    ? (passport?.studyGoal || (passport?.mainField
        ? `${passport.targetEducationLevel || 'Study'} opportunity in ${passport.mainField}`
        : 'Add your education goal to Student Passport'))
    : '';

  const actions = own
    ? `<div class="v3-profile-actions"><button class="btn btn-secondary" data-edit-profile>${icon('edit',17)} Edit public profile</button><button class="btn btn-primary" type="button" data-route="passport">Student Passport</button></div>`
    : `<div class="v3-profile-actions"><button class="btn ${follow.following ? 'btn-secondary is-following' : 'btn-primary'}" type="button" data-follow-user="${escapeHTML(profile?.uid || '')}" aria-pressed="${follow.following}">${follow.following ? 'Following' : 'Follow'}</button><button class="btn btn-secondary" data-message-user="${escapeHTML(profile?.uid || '')}">${icon('message',17)} Message</button></div>`;

  const stats = own
    ? `<div class="v3-profile-metrics">
        <div><strong>${completeness}%</strong><span>Passport ready</span></div>
        <div><strong>${savedOpportunities}</strong><span>Saved opportunities</span></div>
        <div><strong>${activeJourneys.length}</strong><span>Active journeys</span></div>
        <div><strong>${posts.length}</strong><span>Community posts</span></div>
      </div>`
    : `<div class="v3-profile-metrics compact">
        <div><strong>${formatCount(posts.length)}</strong><span>Posts</span></div>
        <div><strong>${formatCount(follow.followersCount)}</strong><span>Followers</span></div>
        <div><strong>${formatCount(follow.followingCount)}</strong><span>Following</span></div>
      </div>`;

  const pathPanel = own
    ? `<aside class="v3-profile-path">
        <div class="v3-profile-path-head"><span class="opportunity-kicker">PRIVATE TO YOU</span><span class="v3-private-chip">Student path</span></div>
        <h2>${escapeHTML(goal)}</h2>
        <div class="v3-profile-path-row">
          <div><span>Student Passport</span><strong>${completeness}%</strong></div>
          <div class="v2-progress-track"><i style="width:${completeness}%"></i></div>
        </div>
        <div class="v3-profile-path-grid">
          <button type="button" data-route="opportunities"><span>${icon('compass',18)}</span><div><b>Find opportunities</b><small>See structured matches</small></div></button>
          <button type="button" data-route="journeys"><span>${icon('check',18)}</span><div><b>Continue Journey</b><small>${activeJourneys.length ? `${activeJourneys.length} active application${activeJourneys.length===1?'':'s'}` : 'Start from a saved opportunity'}</small></div></button>
        </div>
      </aside>`
    : `<aside class="v3-profile-path public">
        <span class="opportunity-kicker">PUBLIC PROFILE</span>
        <h2>Student community profile</h2>
        <p>Public posts and shared outcomes appear here. Private Student Passport and application progress are never shown.</p>
      </aside>`;

  const activity = posts.length
    ? posts.map(postCard).join('')
    : `<section class="v3-empty-profile">
        <div class="v3-empty-icon">${icon('comment',22)}</div>
        <h3>${own ? 'Your community space is ready.' : 'No public posts yet.'}</h3>
        <p>${own ? 'Share a useful discussion, scholarship success, or selected journey story when you have something that can help another student.' : 'This student has not shared any public community posts yet.'}</p>
        ${own ? '<div class="v3-empty-actions"><button class="btn btn-primary" type="button" data-route="explore">Open Community</button><button class="btn btn-secondary" type="button" data-share-success>Share a success</button></div>' : ''}
      </section>`;

  const content = `${demoBanner()}<div class="v3-profile-page">
    <section class="v3-profile-shell">
      <div class="v3-profile-identity">
        <div class="v4-profile-photo-wrap">
          ${own ? `<button class="v4-profile-photo-button" type="button" data-profile-photo-edit aria-label="${profile?.photoUrl ? 'Change profile photo' : 'Add profile photo'}">
            <span class="v3-profile-avatar">${avatar(profile,'lg')}</span>
            <span class="v4-profile-photo-badge" aria-hidden="true">${icon('edit',15)}</span>
          </button>
          <div class="v4-profile-photo-actions">
            <button type="button" data-profile-photo-edit>${profile?.photoUrl ? 'Change photo' : 'Add photo'}</button>
            ${profile?.photoUrl ? '<button class="danger" type="button" data-profile-photo-remove>Remove</button>' : ''}
          </div>` : `<span class="v3-profile-avatar">${avatar(profile,'lg')}</span>`}
        </div>
        <div class="v3-profile-copy">
          <div class="v3-profile-name-row">
            <div>
              <h1>${escapeHTML(profile?.fullName || 'Tefsen User')} ${verifiedMark(profile?.verified, profile?.role)}</h1>
              <span class="handle">@${escapeHTML(profile?.username || 'tefsen-user')}</span>
            </div>
            ${rolePill(profile?.role || 'Student')}
          </div>
          <p>${escapeHTML(profile?.bio || 'Building my education journey with Tefsen.')}</p>
          ${actions}
        </div>
      </div>
      ${pathPanel}
    </section>

    ${stats}

    <section class="v3-profile-activity">
      <header class="v3-section-head">
        <div>
          <span class="opportunity-kicker">COMMUNITY</span>
          <h2>${own ? 'Your public activity' : 'Public activity'}</h2>
          <p>${own ? 'Discussions and outcomes you choose to share publicly.' : 'Public discussions and outcomes shared by this student.'}</p>
        </div>
        ${own ? '<button class="btn btn-secondary" type="button" data-route="explore">Community</button>' : ''}
      </header>
      <div class="feed-list">${activity}</div>
    </section>
  </div>`;

  renderShell(content, { wide:true, right:false });
}

async function renderSubscription() {
  const p = state.profile || {};
  const policy = getWebPostingPolicy(p);
  let usage = { textPosts: 0, imagePosts: 0 };
  try { usage = await getDailyPostUsage(state.mode, state.user.uid); } catch { /* keep page available */ }

  const isAdmin = Boolean(policy.admin);
  const isPlus = Boolean(policy.subscribed) && !isAdmin;
  const planName = isAdmin ? 'Admin Full Access' : (isPlus ? 'Tefsen Student Plus' : 'Free Student');
  const planEyebrow = isAdmin ? 'TEFSEN ADMIN' : (isPlus ? 'ACTIVE MEMBERSHIP' : 'STUDENT MEMBERSHIP');
  const planDescription = isAdmin
    ? 'Complete web access with no student posting quota.'
    : isPlus
      ? 'Your premium student limits are active on this Tefsen account.'
      : 'Learn, ask and share for free — upgrade when you need more image publishing power.';
  const price = isAdmin
    ? `<div class="lux-access-token">${icon('check',18)} Full access</div>`
    : `<div class="lux-price"><strong>$2.99</strong><span>/ month</span></div>`;
  const primaryAction = isAdmin
    ? `<button class="btn lux-primary" type="button" data-route="settings">Open admin settings</button>`
    : isPlus
      ? `<a class="btn lux-primary" href="${GOOGLE_PLAY_SUBSCRIPTIONS_URL}" target="_blank" rel="noopener noreferrer">Manage in Google Play</a>`
      : `<a class="btn lux-primary" href="${GOOGLE_PLAY_APP_URL}" target="_blank" rel="noopener noreferrer">Get Student Plus</a>`;

  const imageLimitText = Number.isFinite(policy.dailyImagePosts) ? `${policy.dailyImagePosts} / day` : 'Unlimited';
  const textLimitText = Number.isFinite(policy.dailyTextPosts) ? `${policy.dailyTextPosts} / day` : 'Unlimited';
  const imageProgress = Number.isFinite(policy.dailyImagePosts) && policy.dailyImagePosts > 0 ? Math.min(100, Math.round((usage.imagePosts / policy.dailyImagePosts) * 100)) : 0;
  const textProgress = Number.isFinite(policy.dailyTextPosts) && policy.dailyTextPosts > 0 ? Math.min(100, Math.round((usage.textPosts / policy.dailyTextPosts) * 100)) : 0;

  const content = `${demoBanner()}
    <div class="subscription-luxury-page">
      <header class="subscription-luxury-head">
        <div><span class="lux-overline">TEFSEN MEMBERSHIP</span><h1>Study with fewer limits.</h1><p>A refined membership experience for students who publish, explain and contribute more.</p></div>
        <div class="lux-secure-note">${icon('check',16)} Same Tefsen account</div>
      </header>

      <section class="lux-plan-hero ${isAdmin ? 'is-admin' : ''} ${isPlus ? 'is-plus' : ''}">
        <div class="lux-glow lux-glow-a"></div><div class="lux-glow lux-glow-b"></div>
        <div class="lux-plan-content">
          <span class="lux-plan-eyebrow">${planEyebrow}</span>
          <h2>${planName}</h2>
          <p>${planDescription}</p>
          <div class="lux-plan-actions">${primaryAction}<button class="btn lux-secondary" type="button" data-sync-subscription>${icon('check',17)} Sync status</button></div>
        </div>
        <div class="lux-plan-price">${price}<small>${isAdmin ? 'Administrative account' : 'Google Play billing'}</small></div>
      </section>

      <div class="lux-usage-grid">
        <section class="lux-usage-card">
          <div class="lux-icon-orb">${icon('image',20)}</div>
          <div class="lux-usage-top"><span>Image posts</span><strong>${imageLimitText}</strong></div>
          <p>${policy.maxImagesPerPost} image${policy.maxImagesPerPost === 1 ? '' : 's'} per post · ${Math.round(policy.maxTotalImageBytes/1024/1024)} MB total</p>
          <div class="lux-meter"><i style="width:${imageProgress}%"></i></div>
          <small>Today ${usage.imagePosts}${Number.isFinite(policy.dailyImagePosts) ? ` of ${policy.dailyImagePosts}` : ''}</small>
        </section>
        <section class="lux-usage-card">
          <div class="lux-icon-orb">${icon('message',20)}</div>
          <div class="lux-usage-top"><span>Text posts</span><strong>${textLimitText}</strong></div>
          <p>Questions and knowledge posts without images.</p>
          <div class="lux-meter"><i style="width:${textProgress}%"></i></div>
          <small>Today ${usage.textPosts}${Number.isFinite(policy.dailyTextPosts) ? ` of ${policy.dailyTextPosts}` : ''}</small>
        </section>
      </div>

      <section class="lux-compare-section">
        <div class="lux-section-title"><span>MEMBERSHIP DETAILS</span><h2>Choose the pace that fits you.</h2></div>
        <div class="lux-compare-grid">
          <article class="lux-plan-card ${!isPlus && !isAdmin ? 'is-current' : ''}">
            <div><span class="lux-card-kicker">FREE</span><h3>Free Student</h3><p>Essential access for everyday learning.</p></div>
            <ul><li>${icon('check',16)} 20 text posts per day</li><li>${icon('check',16)} 2 image posts per day</li><li>${icon('check',16)} 1 image per post</li><li>${icon('check',16)} Up to 2 MB total</li></ul>
            ${!isPlus && !isAdmin ? '<span class="lux-current-pill">Current plan</span>' : ''}
          </article>
          <article class="lux-plan-card lux-plan-card-plus ${isPlus ? 'is-current' : ''}">
            <div><span class="lux-card-kicker">STUDENT PLUS</span><h3>$2.99 <small>/ month</small></h3><p>Designed for students who contribute more.</p></div>
            <ul><li>${icon('check',16)} Unlimited text posts</li><li>${icon('check',16)} 6 image posts per day</li><li>${icon('check',16)} 2 images per post</li><li>${icon('check',16)} Up to 6 MB total</li></ul>
            ${isPlus ? '<span class="lux-current-pill">Active plan</span>' : `<a class="lux-card-cta" href="${GOOGLE_PLAY_APP_URL}" target="_blank" rel="noopener noreferrer">Upgrade with Google Play →</a>`}
          </article>
        </div>
      </section>

      <section class="lux-billing-card">
        <div class="lux-billing-mark">G</div>
        <div><span class="lux-card-kicker">GOOGLE PLAY</span><h3>Billing stays with your Android subscription.</h3><p>Purchase or manage Student Plus through the Tefsen Android app, then sync the same Tefsen account here.</p></div>
        ${isAdmin ? '' : (isPlus ? `<a class="btn lux-secondary" href="${GOOGLE_PLAY_SUBSCRIPTIONS_URL}" target="_blank" rel="noopener noreferrer">Manage subscription</a>` : `<a class="btn lux-primary" href="${GOOGLE_PLAY_APP_URL}" target="_blank" rel="noopener noreferrer">Open Google Play</a>`)}
      </section>
    </div>`;
  renderShell(content, { wide: true });
}

function renderSettings() {
  const p = state.profile || {};
  const compact = localStorage.getItem('tefsen_pref_compact') === '1';
  const motion = localStorage.getItem('tefsen_pref_motion') === '1';
  const tabButton = (id, label) => `<button class="${settingsTab === id ? 'active' : ''}" type="button" data-settings-tab="${id}" aria-selected="${settingsTab === id}">${label}</button>`;
  const panelClass = id => `settings-panel ${settingsTab === id ? 'active' : ''}`;
  const content = `${demoBanner()}<header class="page-head"><div><h1>Settings</h1><p>Manage your profile and web experience.</p></div></header>
    <div class="settings-grid"><aside class="panel settings-nav" role="tablist">${tabButton('profile','Profile')}${tabButton('preferences','Preferences')}${tabButton('account','Account')}</aside>
    <section class="panel settings-section">
      <div class="${panelClass('profile')}" data-settings-panel="profile"><h2 style="margin-top:0">Profile details</h2><form class="form-grid" data-profile-form><div class="field"><label>Full name</label><input class="input" name="fullName" value="${escapeHTML(p.fullName || '')}" required maxlength="80"></div><div class="field"><label>Username</label><input class="input" name="username" value="${escapeHTML(p.username || '')}" maxlength="40"></div><div class="field"><label>Bio</label><textarea class="textarea" name="bio" maxlength="500">${escapeHTML(p.bio || '')}</textarea></div><div><button class="btn btn-primary" type="submit">Save changes</button></div></form></div>
      <div class="${panelClass('preferences')}" data-settings-panel="preferences"><h2 style="margin-top:0">Preferences</h2><div class="setting-row"><span><b>Compact feed</b><p>Reduce spacing between discussions.</p></span><button class="toggle ${compact ? 'active' : ''}" type="button" data-pref="compact" aria-pressed="${compact}"></button></div><div class="setting-row"><span><b>Reduced motion</b><p>Limit interface animation.</p></span><button class="toggle ${motion ? 'active' : ''}" type="button" data-pref="motion" aria-pressed="${motion}"></button></div></div>
      <div class="${panelClass('account')}" data-settings-panel="account"><h2 style="margin-top:0">Account</h2><div class="setting-row"><span><b>${String(p.role || '').trim().toLowerCase() === 'admin' ? 'Admin Full Access' : (p.subscriptionActive ? 'Subscribed Student' : 'Free Student')}</b><p>${String(p.role || '').trim().toLowerCase() === 'admin' ? 'Administrative web access with no daily posting quota.' : 'Web posting limits sync with your Tefsen account.'}</p></span><button class="btn btn-secondary" type="button" data-route="subscription">View plan</button></div><div class="nav-divider"></div><div class="account-actions"><a class="btn btn-secondary" href="../privacy.html">Privacy policy</a><a class="btn btn-secondary" href="../delete-account/">Delete account</a><button class="btn btn-danger" data-logout>Sign out</button></div></div>
    </section></div>`;
  renderShell(content,{wide:true});
}


function adminStatusMarkup(opportunity) {
  const fresh = opportunityFreshness(opportunity);
  return `<span class="admin-status ${escapeHTML(fresh.state)}">${escapeHTML(fresh.label)}</span>`;
}

function adminPreviewTable(rows = []) {
  if (!rows.length) return '<p style="color:var(--muted)">Paste data and choose Preview import.</p>';
  return `<div class="admin-preview panel"><table><thead><tr><th>#</th><th>Title</th><th>Provider</th><th>Source</th><th>Validation</th></tr></thead><tbody>${rows.map(row => {
    const problems = [...(row.errors||[]), ...(row.warnings||[])];
    const duplicate = row.duplicateExisting ? 'Duplicate existing URL' : row.duplicateBatch ? 'Duplicate in batch' : '';
    return `<tr><td>${row.index+1}</td><td>${escapeHTML(row.record?.title||'—')}</td><td>${escapeHTML(row.record?.provider||row.record?.university||'—')}</td><td>${row.record?.officialSourceUrl ? `<a href="${safeUrl(row.record.officialSourceUrl)}" target="_blank" rel="noopener noreferrer">Open</a>` : '—'}</td><td class="${row.valid && !duplicate ? '' : 'admin-error'}">${escapeHTML(duplicate || problems.join(' · ') || 'Ready')}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

async function renderAdmin() {
  if (!adminCapability) {
    renderShell(`${emptyState('info','Admin authorization required','This area requires a Firebase Auth admin custom claim. A profile label alone is not enough.')}`, { wide:true, right:false });
    return;
  }

  renderShell(`<header class="page-head"><div><h1>Opportunity Admin</h1><p>Loading verification and freshness data…</p></div></header><div class="loading-card"></div>`, { wide:true, right:false });
  try {
    currentAdminOpportunities = await listAdminOpportunities(state.mode, state.user, state.profile);
    const withFreshness = currentAdminOpportunities.map(item => ({ item, freshness: opportunityFreshness(item) }));
    const pending = withFreshness.filter(x => ['pending','unverified'].includes(x.freshness.state)).length;
    const needsReview = withFreshness.filter(x => x.freshness.needsReview).length;
    const verified = currentAdminOpportunities.filter(x => x.verificationStatus === 'verified').length;
    const reviewRows = withFreshness
      .filter(x => x.freshness.needsReview || x.item.verificationStatus !== 'verified')
      .sort((x,y) => Number(y.freshness.needsReview) - Number(x.freshness.needsReview));

    const reviewPanel = `<section class="admin-list">${reviewRows.length ? reviewRows.map(({item,freshness}) => `<article class="admin-row">
      <div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">${adminStatusMarkup(item)}<span class="opportunity-chip">${escapeHTML(item.verificationStatus||'unverified')}</span><span class="opportunity-chip">${escapeHTML(item.status||'draft')}</span></div>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.provider)} · ${escapeHTML(item.country)}${item.deadline ? ` · deadline ${escapeHTML(item.deadline)}` : ''}</p>
        <p style="margin-top:7px">${item.officialSourceUrl ? `<a href="${safeUrl(item.officialSourceUrl)}" target="_blank" rel="noopener noreferrer">Open official/source URL</a>` : '<span class="admin-warning">Official source missing</span>'}</p>
      </div>
      <div class="admin-row-actions">
        <button class="btn btn-primary" type="button" data-admin-review-action="verify" data-admin-opportunity-id="${escapeHTML(item.id)}" ${item.officialSourceUrl ? '' : 'disabled'}>Verify & publish</button>
        <button class="btn btn-secondary" type="button" data-admin-review-action="mark_review" data-admin-opportunity-id="${escapeHTML(item.id)}">Needs review</button>
        <button class="btn btn-ghost" type="button" data-admin-review-action="archive" data-admin-opportunity-id="${escapeHTML(item.id)}">Archive</button>
      </div>
    </article>`).join('') : '<div class="panel opportunity-empty">No opportunities currently need review.</div>'}</section>`;

    const preview = markImportDuplicates(adminPreviewRows, currentAdminOpportunities);
    adminPreviewRows = preview;
    const readyCount = preview.filter(row => row.valid && !row.duplicateExisting && !row.duplicateBatch).length;
    const importPanel = `<section class="panel section-card">
      <div class="panel-title"><div><h2>Safe import preview</h2><small>JSON or CSV · max 100 preview / 25 import</small></div></div>
      <div class="community-banner" style="margin-bottom:14px">Imported records are always saved as <b>draft + private + pending</b>. Import never verifies or publishes an opportunity.</div>
      <form class="form-grid" data-admin-import-preview-form>
        <div class="field"><label>JSON or CSV</label><textarea class="textarea admin-import-text" name="source" required placeholder='[{"title":"Scholarship","provider":"University","officialSourceUrl":"https://..."}]'>${escapeHTML(adminImportSource)}</textarea></div>
        <div><button class="btn btn-secondary" type="submit">Preview import</button></div>
      </form>
      <div style="margin-top:16px">${adminPreviewTable(preview)}</div>
      ${preview.length ? `<div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btn-primary" type="button" data-admin-import-confirm ${readyCount ? '' : 'disabled'}>Import ${readyCount} ready record${readyCount===1?'':'s'} as pending</button></div>` : ''}
    </section>`;

    const appCheckConfigured = Boolean(window.TEFSEN_APPCHECK_SITE_KEY);
    const content = `${demoBanner()}<div class="admin-shell">
      ${state.mode === 'firebase' && !appCheckConfigured ? '<div class="community-banner"><b>Launch blocker:</b> Web App Check is not configured yet. Add the Web reCAPTCHA/App Check site key, validate real traffic, then enable enforcement service-by-service in Firebase Console.</div>' : ''}
      <section class="admin-hero">
        <div><span class="opportunity-kicker">TRUST & DATA QUALITY</span><h1>Opportunity review</h1><p>Verification requires a real official source. Imported records stay private until an authorized admin reviews and publishes them.</p></div>
        <div class="admin-stat"><strong>${pending}</strong><span>pending / unverified</span></div>
        <div class="admin-stat"><strong>${needsReview}</strong><span>need review now</span></div>
        <div class="admin-stat"><strong>${verified}</strong><span>verified records</span></div>
      </section>
      <div class="admin-tabs"><button class="btn ${adminTab==='review'?'btn-primary':'btn-secondary'}" data-admin-tab="review">Review queue</button><button class="btn ${adminTab==='import'?'btn-primary':'btn-secondary'}" data-admin-tab="import">Import</button></div>
      ${adminTab === 'import' ? importPanel : reviewPanel}
    </div>`;
    renderShell(content,{wide:true,right:false});
  } catch (error) {
    console.error(error);
    renderShell(`${emptyState('info','Admin tools unavailable',humanError(error))}`,{wide:true,right:false});
  }
}

async function renderSearch(term = '') {
  state.searchQuery = term;
  renderShell(`<header class="page-head"><div><h1>Search</h1><p>${term ? `Results for “${escapeHTML(term)}”` : 'Find people, questions and subjects.'}</p></div></header><div class="loading-card"></div>`);
  currentSearch = term ? await searchAll(state.mode, term).catch(()=>({users:[],posts:[]})) : {users:[],posts:[]};
  const content = `${demoBanner()}<header class="page-head"><div><h1>Search</h1><p>${term ? `Results for “${escapeHTML(term)}”` : 'Find people, questions and subjects.'}</p></div></header>
    ${currentSearch.users.length ? `<section class="panel section-card" style="margin-bottom:16px"><div class="panel-title"><h2>People</h2><small>${currentSearch.users.length} results</small></div><div class="search-results">${currentSearch.users.map(u=>`<button class="search-user" type="button" style="width:100%;border:0;background:none;color:inherit;text-align:left" data-route="profile/${encodeURIComponent(u.uid)}">${avatar(u,'sm')}<span><b>${escapeHTML(u.fullName)} ${verifiedMark(u.verified, u.role)}</b><small style="display:block;color:var(--muted)">${escapeHTML(normalizeRole(u.role))}</small></span></button>`).join('')}</div></section>`:''}
    <div class="feed-list">${currentSearch.posts.length ? currentSearch.posts.map(postCard).join('') : emptyState('search',term?'No matching discussions':'Start searching','Try a name, subject or question keyword.')}</div>`;
  renderShell(content);
}

function renderRoute() {
  if (!state.user) return;
  const [route, param, param2] = routeParts();
  state.ui.profileMenu = false;
  document.documentElement.classList.remove('profile-menu-open');
  document.querySelectorAll('.profile-menu-backdrop, .profile-dropdown').forEach(el => el.remove());
  if (stopComments && route !== 'post') { stopComments(); stopComments = null; }
  if (stopMessages && route !== 'messages') { stopMessages(); stopMessages = null; }
  switch (route || 'home') {
    case 'home': renderHome(); break;
    case 'opportunities': renderOpportunities(); break;
    case 'passport': renderStudentPassport(); break;
    case 'journeys': renderJourneys(); break;
    case 'journey': renderJourneyDetail(param || ''); break;
    case 'opportunity': renderOpportunityDetail(param || ''); break;
    case 'explore': renderExplore(); break;
    case 'subject': renderSubjectCommunity(param || 'General'); break;
    case 'university': renderUniversityCommunity(param || ''); break;
    case 'intake': renderIntakeCommunity(param || '', param2 || ''); break;
    case 'saved': renderSavedCommunity(); break;
    case 'notifications': renderNotifications(); break;
    case 'messages': renderMessages(param || ''); break;
    case 'leaderboard': renderLeaderboard(); break;
    case 'profile': renderProfile(param || ''); break;
    case 'settings': renderSettings(); break;
    case 'admin': renderAdmin(); break;
    case 'subscription': renderSubscription(); break;
    case 'post': renderPostDetail(param || ''); break;
    case 'search': renderSearch(param || new URLSearchParams(location.hash.split('?')[1] || '').get('q') || ''); break;
    default: renderHome();
  }
}


function openSuccessStoryModal(prefill = {}) {
  modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop><section class="modal" role="dialog" aria-modal="true"><header class="modal-head"><h2>Share a student success</h2><button class="close-btn" data-close-modal>${icon('close',19)}</button></header><div class="modal-body">
    <div class="community-banner" style="margin-bottom:14px">Publish only information you choose to make public. Do not include application IDs, passport/visa numbers, addresses, financial account details or private documents.</div>
    <form class="form-grid" data-success-story-form>
      <div class="story-form-grid">
        <div class="field"><label>University</label><input class="input" name="university" maxlength="180" required value="${escapeHTML(prefill.university||'')}"></div>
        <div class="field"><label>Scholarship / program / offer</label><input class="input" name="opportunityName" maxlength="180" required></div>
        <div class="field"><label>Country</label><input class="input" name="country" maxlength="120"></div>
        <div class="field"><label>Subject</label><input class="input" name="subject" maxlength="120" required value="${escapeHTML(prefill.subject||'')}"></div>
        <div class="field"><label>Study level</label><input class="input" name="studyLevel" maxlength="100" placeholder="Undergraduate, Master…"></div>
        <div class="field"><label>Intake / year</label><input class="input" name="intake" maxlength="80" value="${escapeHTML(prefill.intake||'')}" placeholder="Fall 2027"></div>
        <div class="field"><label>Funding</label><select class="select" name="fundingType"><option value="">Not specified</option><option>Fully funded</option><option>Partial funding</option><option>Self funded / offer only</option><option>Other</option></select></div>
        <div class="field story-form-wide"><label>Headline</label><input class="input" name="title" maxlength="180" placeholder="I received a scholarship offer"></div>
        <div class="field story-form-wide"><label>Your message</label><textarea class="textarea" name="content" maxlength="3000" required placeholder="Share what happened and what might help the next student."></textarea></div>
      </div>
      <div class="form-error" data-story-error></div><button class="btn btn-primary" type="submit">Publish success story</button>
    </form>
  </div></section></div>`;
}

function openJourneyStoryModal(prefill = {}) {
  const rows=[1,2,3,4].map(i=>`<div class="milestone-form-row"><input class="input" name="stage${i}" maxlength="80" placeholder="Milestone, e.g. Applied"><input class="input" name="month${i}" type="month"><input class="input" name="note${i}" maxlength="300" placeholder="What you choose to share"></div>`).join('');
  modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop><section class="modal" role="dialog" aria-modal="true"><header class="modal-head"><h2>Share selected journey milestones</h2><button class="close-btn" data-close-modal>${icon('close',19)}</button></header><div class="modal-body">
    <div class="community-banner" style="margin-bottom:14px">This does not publish your private Tefsen Journey. Only the fields you enter below become public.</div>
    <form class="form-grid" data-journey-story-form>
      <div class="story-form-grid"><div class="field"><label>Subject</label><input class="input" name="subject" maxlength="120" value="${escapeHTML(prefill.subject||'')}"></div><div class="field"><label>University (optional)</label><input class="input" name="university" maxlength="180" value="${escapeHTML(prefill.university||'')}"></div><div class="field"><label>Intake (optional)</label><input class="input" name="intake" maxlength="80" value="${escapeHTML(prefill.intake||'')}"></div><div class="field"><label>Story title</label><input class="input" name="title" maxlength="180" required placeholder="My scholarship application journey"></div><div class="field story-form-wide"><label>Introduction</label><textarea class="textarea" name="content" maxlength="3000" required></textarea></div></div>
      <h3>Public milestones</h3>${rows}
      <div class="form-error" data-story-error></div><button class="btn btn-primary" type="submit">Publish journey story</button>
    </form>
  </div></section></div>`;
}

function openCommunityComposer(context = {}) {
  modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop><section class="modal" role="dialog" aria-modal="true"><header class="modal-head"><h2>Community discussion</h2><button class="close-btn" data-close-modal>${icon('close',19)}</button></header><div class="modal-body"><form class="form-grid" data-community-post-form data-community-subject="${escapeHTML(context.subject||'')}" data-community-university="${escapeHTML(context.university||'')}" data-community-intake="${escapeHTML(context.intake||'')}"><div class="community-banner">Keep private application, visa, address, booking and identity details out of public community posts.</div><div class="field"><label>Title / question</label><input class="input" name="title" maxlength="180" required></div><div class="field"><label>Details</label><textarea class="textarea" name="content" maxlength="4000" required></textarea></div><button class="btn btn-primary" type="submit">Publish discussion</button></form></div></section></div>`;
}

function openComposer() {
  const policy = getWebPostingPolicy(state.profile || {});
  const mb = Math.round(policy.maxTotalImageBytes / 1024 / 1024);
  modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop><section class="modal" role="dialog" aria-modal="true" aria-labelledby="compose-title"><header class="modal-head"><h2 id="compose-title">Ask a question or share knowledge</h2><button class="close-btn" type="button" data-close-modal>${icon('close',19)}</button></header><div class="modal-body"><form class="form-grid" data-compose-form>
    <div class="composer-plan ${policy.subscribed ? 'subscribed' : ''}"><b>${escapeHTML(policy.name)}</b><span>${policy.maxImagesPerPost} image${policy.maxImagesPerPost === 1 ? '' : 's'} · ${mb} MB total · ${Number.isFinite(policy.dailyImagePosts) ? `${policy.dailyImagePosts} image posts/day` : 'Unlimited image posts'} · ${Number.isFinite(policy.dailyTextPosts) ? `${policy.dailyTextPosts} text posts/day` : 'Unlimited text posts'}</span></div>
    <div class="field"><label>Title / question</label><input class="input" name="title" maxlength="180" required placeholder="What would you like to ask or explain?"></div>
    <div class="field"><label>Details</label><textarea class="textarea" name="content" maxlength="8000" required placeholder="Add context, what you tried, or a useful explanation…"></textarea></div>
    <div class="input-row"><div class="field"><label>Subject</label><input class="input" name="subject" maxlength="60" placeholder="e.g. Physics"></div><div class="field"><label>Tags</label><input class="input" name="tags" maxlength="150" placeholder="circuits, electricity"></div></div>
    <div class="file-drop">${icon('image',24)}<br><b>Add ${policy.maxImagesPerPost > 1 ? 'images' : 'an image'}</b><br><span class="form-help">PNG, JPG or WebP · max ${policy.maxImagesPerPost} · ${mb} MB total</span><input type="file" name="images" accept="image/png,image/jpeg,image/webp" ${policy.maxImagesPerPost > 1 ? 'multiple' : ''}></div>
    <div class="image-preview image-preview-grid hidden" data-image-preview></div><div class="form-error" data-compose-error></div><div style="display:flex;justify-content:flex-end;gap:10px"><button class="btn btn-ghost" type="button" data-close-modal>Cancel</button><button class="btn btn-primary" type="submit">Publish</button></div></form></div></section></div>`;
}

function openReportModal(postId) {
  modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop><section class="modal" role="dialog" aria-modal="true"><header class="modal-head"><h2>Report content</h2><button class="close-btn" data-close-modal>${icon('close',19)}</button></header><div class="modal-body"><form class="form-grid" data-report-form="${escapeHTML(postId)}"><div class="field"><label>Reason</label><select class="select" name="reason" required><option value="">Choose a reason</option><option>Spam</option><option>Harassment</option><option>Harmful or unsafe content</option><option>Misinformation concern</option><option>Copyright concern</option><option>Other</option></select></div><div class="field"><label>Details (optional)</label><textarea class="textarea" name="details" maxlength="1000"></textarea></div><button class="btn btn-danger" type="submit">Submit report</button></form></div></section></div>`;
}

function canDeletePost(post) {
  if (!post || !state.user?.uid) return false;
  const ownerId = String(post.authorId || post.userId || post.uid || post.ownerId || post.authorUid || post.creatorId || '');
  const ownPost = Boolean(ownerId) && ownerId === String(state.user.uid);
  const admin = String(state.profile?.role || '').trim().toLowerCase() === 'admin';
  return ownPost || admin;
}

async function openPostMenu(postId) {
  let post = state.posts.find(item => item.id === postId) || null;
  if (!post) post = await getPost(state.mode, postId).catch(() => null);
  const ownPost = canDeletePost(post);
  modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop><section class="modal" style="max-width:420px"><header class="modal-head"><h2>Post options</h2><button class="close-btn" data-close-modal>${icon('close',19)}</button></header><div class="modal-body" style="display:grid;gap:10px"><button class="btn btn-secondary" data-share="${escapeHTML(postId)}">${icon('share',17)} Copy share link</button>${ownPost ? `<button class="btn btn-danger" data-delete-post="${escapeHTML(postId)}">Delete post</button>` : `<button class="btn btn-danger" data-report="${escapeHTML(postId)}">Report content</button>`}</div></section></div>`;
}

function openDeletePostModal(postId) {
  modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop><section class="modal" style="max-width:440px" role="dialog" aria-modal="true"><header class="modal-head"><h2>Delete post?</h2><button class="close-btn" data-close-modal>${icon('close',19)}</button></header><div class="modal-body"><p style="margin:0 0 18px;color:var(--muted);line-height:1.6">This will permanently remove your post. This action cannot be undone.</p><div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap"><button class="btn btn-ghost" type="button" data-close-modal>Cancel</button><button class="btn btn-danger" type="button" data-confirm-delete-post="${escapeHTML(postId)}">Delete post</button></div></div></section></div>`;
}

function openEditProfile() {
  const p = state.profile || {};
  const hasPhoto = Boolean(safeUrl(p.photoUrl || p.profileImageUrl || p.photoURL || ''));
  modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop>
    <section class="modal v4-profile-modal" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
      <header class="modal-head"><h2 id="edit-profile-title">Edit profile</h2><button class="close-btn" data-close-modal aria-label="Close">${icon('close',19)}</button></header>
      <div class="modal-body">
        <form class="form-grid" data-profile-form data-profile-modal>
          <section class="v4-photo-editor">
            <div class="v4-photo-preview" data-profile-photo-preview>${avatar(p,'lg')}</div>
            <div class="v4-photo-editor-copy">
              <b>Profile photo</b>
              <p>Use a clear photo that represents you. JPG, PNG or WebP, up to 5 MB.</p>
              <input class="sr-only" type="file" name="profileImage" accept="image/jpeg,image/png,image/webp" data-profile-photo-input>
              <div class="v4-photo-editor-actions">
                <button class="btn btn-secondary" type="button" data-profile-photo-choose>${hasPhoto ? 'Change photo' : 'Add photo'}</button>
                ${hasPhoto ? '<button class="btn btn-ghost v4-remove-photo" type="button" data-profile-photo-remove>Remove photo</button>' : ''}
              </div>
            </div>
          </section>
          <div class="field"><label>Full name</label><input class="input" name="fullName" value="${escapeHTML(p.fullName || '')}" required maxlength="80"></div>
          <div class="field"><label>Username</label><input class="input" name="username" value="${escapeHTML(p.username || '')}" maxlength="40"></div>
          <div class="field"><label>Bio</label><textarea class="textarea" name="bio" maxlength="500">${escapeHTML(p.bio || '')}</textarea></div>
          <div class="v4-profile-modal-footer"><button class="btn btn-ghost" type="button" data-close-modal>Cancel</button><button class="btn btn-primary" type="submit">Save profile</button></div>
        </form>
      </div>
    </section>
  </div>`;
}

function openRemoveProfilePhotoModal() {
  const p = state.profile || {};
  modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop>
    <section class="modal v4-confirm-modal" role="dialog" aria-modal="true">
      <header class="modal-head"><h2>Remove profile photo?</h2><button class="close-btn" data-close-modal aria-label="Close">${icon('close',19)}</button></header>
      <div class="modal-body">
        <div class="v4-remove-photo-preview">${avatar(p,'lg')}</div>
        <p>Your current profile photo will be removed from Tefsen Storage and your public profile will return to initials.</p>
        <div class="v4-profile-modal-footer"><button class="btn btn-ghost" type="button" data-close-modal>Keep photo</button><button class="btn btn-danger" type="button" data-confirm-remove-profile-photo>Remove photo</button></div>
      </div>
    </section>
  </div>`;
}

function openDemoInfo() {
  modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop><section class="modal"><header class="modal-head"><h2>Connect the real Tefsen Firebase project</h2><button class="close-btn" data-close-modal>${icon('close',19)}</button></header><div class="modal-body"><p style="color:var(--muted)">This package is fully interactive in preview mode. To use the same real accounts and data as your Android app:</p><ol style="line-height:1.9;color:#cbd9e5"><li>Firebase Console → Project settings → General.</li><li>Add/select the Web app.</li><li>Copy its <code>firebaseConfig</code> values.</li><li>Edit <code>app/js/config/firebase-config.js</code>.</li><li>Confirm collection names in <code>app/js/config/schema.js</code>.</li><li>Add <code>tefsen.com</code> to Firebase Authentication authorized domains.</li></ol><p style="color:#ffda91"><b>Never</b> paste a service-account private key into GitHub.</p><button class="btn btn-primary" data-close-modal>Got it</button></div></section></div>`;
}

async function handleClick(event) {
  const settingsTabEl = event.target.closest('[data-settings-tab]');
  if (settingsTabEl) { settingsTab = settingsTabEl.dataset.settingsTab || 'profile'; renderSettings(); return; }
  const prefEl = event.target.closest('[data-pref]');
  if (prefEl) {
    const key = prefEl.dataset.pref;
    const storageKey = key === 'compact' ? 'tefsen_pref_compact' : 'tefsen_pref_motion';
    const next = localStorage.getItem(storageKey) !== '1';
    localStorage.setItem(storageKey, next ? '1' : '0');
    document.documentElement.classList.toggle(key === 'compact' ? 'pref-compact' : 'pref-reduced-motion', next);
    renderSettings();
    return;
  }
  const routeEl = event.target.closest('[data-route]');
  const syncSubscription = event.target.closest('[data-sync-subscription]');
  if (syncSubscription) {
    try { const profile = await getProfile(state.mode, state.user); state.profile = profile; toast('Subscription status synced.', 'success'); renderSubscription(); }
    catch (error) { toast(humanError(error), 'error'); }
    return;
  }
  if (routeEl) { event.preventDefault(); state.ui.profileMenu = false; document.documentElement.classList.remove('profile-menu-open'); document.querySelectorAll('.profile-menu-backdrop, .profile-dropdown').forEach(el => el.remove()); go(routeEl.dataset.route); return; }
  const switchEl = event.target.closest('[data-auth-switch]');
  if (switchEl) { renderAuth(switchEl.dataset.authSwitch); return; }
  if (event.target.closest('[data-google]')) { await withButton(event.target.closest('[data-google]'), () => signInGoogle(state.mode).catch(e=>toast(humanError(e),'error'))); return; }
  if (event.target.closest('[data-demo-login]')) { await signIn(state.mode,'demo@tefsen.com','demo123'); return; }
  if (event.target.closest('[data-demo-info]')) { event.preventDefault(); openDemoInfo(); return; }
  if (event.target.closest('[data-forgot]')) { handleForgot(); return; }
  if (event.target.closest('[data-action="compose"]')) { openComposer(); return; }
  const shareSuccess = event.target.closest('[data-share-success]');
  if (shareSuccess) { openSuccessStoryModal({ subject:shareSuccess.dataset.prefillSubject||'', university:shareSuccess.dataset.prefillUniversity||'', intake:shareSuccess.dataset.prefillIntake||'' }); return; }
  const shareJourneyStory = event.target.closest('[data-share-journey-story]');
  if (shareJourneyStory) { openJourneyStoryModal({ subject:shareJourneyStory.dataset.prefillSubject||'', university:shareJourneyStory.dataset.prefillUniversity||'', intake:shareJourneyStory.dataset.prefillIntake||'' }); return; }
  const communityDiscussion = event.target.closest('[data-community-discussion]');
  if (communityDiscussion) { openCommunityComposer({ subject:communityDiscussion.dataset.communitySubject||'', university:communityDiscussion.dataset.communityUniversity||'', intake:communityDiscussion.dataset.communityIntake||'' }); return; }
  if (event.target.closest('[data-close-modal]')) { modalRoot.innerHTML=''; return; }
  if (event.target.matches('[data-modal-backdrop]')) { modalRoot.innerHTML=''; return; }
  const tab = event.target.closest('[data-feed-tab]');
  if (tab) { state.activeFeedTab = tab.dataset.feedTab; renderHome(); return; }
  const adminTabButton = event.target.closest('[data-admin-tab]');
  if (adminTabButton) { adminTab = adminTabButton.dataset.adminTab === 'import' ? 'import' : 'review'; await renderAdmin(); return; }
  const adminReview = event.target.closest('[data-admin-review-action]');
  if (adminReview) { await handleAdminReview(adminReview); return; }
  const adminImportConfirm = event.target.closest('[data-admin-import-confirm]');
  if (adminImportConfirm) { await handleAdminImportConfirm(adminImportConfirm); return; }
  const like = event.target.closest('[data-like]');
  if (like) { await handleLike(like.dataset.like); return; }
  const save = event.target.closest('[data-save]');
  if (save) { await handleSave(save.dataset.save); return; }
  const opportunitySave = event.target.closest('[data-opportunity-save]');
  if (opportunitySave) { await handleOpportunitySave(opportunitySave); return; }
  const startJourneyButton = event.target.closest('[data-start-journey]');
  if (startJourneyButton) { await handleStartJourney(startJourneyButton); return; }
  const taskToggle = event.target.closest('[data-journey-task-toggle]');
  if (taskToggle) { await handleJourneyTaskToggle(taskToggle); return; }
  const taskDelete = event.target.closest('[data-journey-task-delete]');
  if (taskDelete) { await handleJourneyTaskDelete(taskDelete); return; }
  const share = event.target.closest('[data-share]');
  if (share) { await copyText(`${location.origin}${location.pathname}#/post/${share.dataset.share}`); modalRoot.innerHTML=''; return; }
  const postMenu = event.target.closest('[data-post-menu]');
  if (postMenu) { await openPostMenu(postMenu.dataset.postMenu); return; }
  const deletePostButton = event.target.closest('[data-delete-post]');
  if (deletePostButton) { openDeletePostModal(deletePostButton.dataset.deletePost); return; }
  const confirmDeletePost = event.target.closest('[data-confirm-delete-post]');
  if (confirmDeletePost) { await handleDeletePost(confirmDeletePost.dataset.confirmDeletePost, confirmDeletePost); return; }
  const report = event.target.closest('[data-report]');
  if (report) { openReportModal(report.dataset.report); return; }
  const notification = event.target.closest('[data-notification]');
  if (notification) { await handleNotification(notification); return; }
  const conv = event.target.closest('[data-conversation]');
  if (conv) { go(`messages/${conv.dataset.conversation}`); return; }
  if (event.target.closest('[data-messages-back]')) { drawMessages(null); return; }
  if (event.target.closest('[data-back]')) { history.length > 1 ? history.back() : go('home'); return; }
  if (event.target.closest('[data-profile-menu]')) { state.ui.profileMenu = !state.ui.profileMenu; syncProfileMenu(); return; }
  if (event.target.closest('[data-profile-menu-dismiss]')) { state.ui.profileMenu = false; syncProfileMenu(); return; }
  if (event.target.closest('[data-logout]')) { await logout(state.mode); return; }
  const profilePhotoEdit = event.target.closest('[data-profile-photo-edit]');
  if (profilePhotoEdit) {
    openEditProfile();
    requestAnimationFrame(() => document.querySelector('[data-profile-photo-input]')?.click());
    return;
  }
  const profilePhotoChoose = event.target.closest('[data-profile-photo-choose]');
  if (profilePhotoChoose) {
    document.querySelector('[data-profile-photo-input]')?.click();
    return;
  }
  if (event.target.closest('[data-profile-photo-remove]')) { openRemoveProfilePhotoModal(); return; }
  const confirmRemoveProfilePhoto = event.target.closest('[data-confirm-remove-profile-photo]');
  if (confirmRemoveProfilePhoto) { await handleProfilePhotoRemove(confirmRemoveProfilePhoto); return; }
  if (event.target.closest('[data-edit-profile]')) { openEditProfile(); return; }
  const followUser = event.target.closest('[data-follow-user]');
  if (followUser) { await handleFollow(followUser); return; }
  const messageUser = event.target.closest('[data-message-user]');
  if (messageUser) { await handleStartConversation(currentProfileView); return; }
  const subject = event.target.closest('[data-subject]');
  if (subject) { state.searchQuery = subject.dataset.subject; go(`search/${encodeURIComponent(subject.dataset.subject)}`); return; }
}

async function handleSubmit(event) {
  const form = event.target;
  if (form.matches('[data-auth-form]')) { event.preventDefault(); await handleAuthForm(form); return; }
  if (form.matches('[data-global-search-form]')) { event.preventDefault(); const term = new FormData(form).get('q')?.trim(); if (term) go(`search/${encodeURIComponent(term)}`); return; }
  if (form.matches('[data-compose-form]')) { event.preventDefault(); await handleCompose(form); return; }
  if (form.matches('[data-comment-form]')) { event.preventDefault(); await handleComment(form); return; }
  if (form.matches('[data-message-form]')) { event.preventDefault(); await handleMessage(form); return; }
  if (form.matches('[data-profile-form]')) { event.preventDefault(); await handleProfileSave(form); return; }
  if (form.matches('[data-student-passport-form]')) { event.preventDefault(); await handleStudentPassportSave(form); return; }
  if (form.matches('[data-success-story-form]')) { event.preventDefault(); await handleSuccessStorySubmit(form); return; }
  if (form.matches('[data-journey-story-form]')) { event.preventDefault(); await handleJourneyStorySubmit(form); return; }
  if (form.matches('[data-community-post-form]')) { event.preventDefault(); await handleCommunityPostSubmit(form); return; }
  if (form.matches('[data-journey-stage-form]')) { event.preventDefault(); await handleJourneyStageSave(form); return; }
  if (form.matches('[data-journey-planning-form]')) { event.preventDefault(); await handleJourneyPlanningSave(form); return; }
  if (form.matches('[data-journey-task-form]')) { event.preventDefault(); await handleJourneyTaskAdd(form); return; }
  if (form.matches('[data-report-form]')) { event.preventDefault(); await handleReport(form); return; }
  if (form.matches('[data-admin-import-preview-form]')) { event.preventDefault(); await handleAdminImportPreview(form); return; }
}

async function handleAuthForm(form) {
  const fd = new FormData(form), mode = form.dataset.authForm;
  const errorEl = form.querySelector('[data-auth-error]');
  errorEl.textContent = '';
  const submit = form.querySelector('button[type="submit"]');
  await withButton(submit, async () => {
    try {
      if (mode === 'register') await register(state.mode, { fullName: fd.get('fullName').trim(), email: fd.get('email').trim(), password: fd.get('password') });
      else await signIn(state.mode, fd.get('email').trim(), fd.get('password'));
    } catch (error) { errorEl.textContent = humanError(error); }
  });
}

async function handleForgot() {
  const email = document.querySelector('[data-auth-form] input[name="email"]')?.value?.trim();
  if (!email) { toast('Enter your email first.', 'error'); return; }
  try { await resetPassword(state.mode,email); toast(state.mode==='demo'?'Preview: password reset is ready when Firebase is connected.':'Password reset email sent.','success'); }
  catch(e){ toast(humanError(e),'error'); }
}

async function handleCompose(form) {
  const fd = new FormData(form), errorEl = form.querySelector('[data-compose-error]'), submit = form.querySelector('button[type="submit"]');
  const imageFiles = fd.getAll('images').filter(file => file && file.size);
  const payload = {
    title: String(fd.get('title')||'').trim(), content: String(fd.get('content')||'').trim(), subject: String(fd.get('subject')||'General').trim() || 'General',
    tags: String(fd.get('tags')||'').split(',').map(x=>x.trim().replace(/^#/,'')).filter(Boolean).slice(0,8), imageFiles
  };
  if (!payload.title || !payload.content) return;
  const policy = getWebPostingPolicy(state.profile || {});
  const totalBytes = imageFiles.reduce((sum, file) => sum + Number(file.size || 0), 0);
  if (imageFiles.length > policy.maxImagesPerPost) { errorEl.textContent = `Your plan allows ${policy.maxImagesPerPost} image${policy.maxImagesPerPost === 1 ? '' : 's'} per post.`; return; }
  if (totalBytes > policy.maxTotalImageBytes) { errorEl.textContent = `Your plan allows ${Math.round(policy.maxTotalImageBytes/1024/1024)} MB total images per post.`; return; }
  await withButton(submit, async()=>{
    try { const post = await createPost(state.mode,state.user,state.profile,payload); modalRoot.innerHTML=''; toast('Published successfully','success'); if (state.mode==='demo') { state.posts=[post,...state.posts]; } go(`post/${post.id}`); }
    catch(e){ errorEl.textContent=humanError(e); }
  });
}

function syncLikeButtons(postId, active, count, pending = false) {
  document.querySelectorAll('[data-like]').forEach((button) => {
    if (button.dataset.like !== postId) return;
    button.classList.toggle('active', active);
    button.classList.toggle('is-pending', pending);
    button.setAttribute('aria-pressed', String(active));
    button.disabled = pending;
    button.innerHTML = `<span class="action-icon">${icon('heart',17)}</span><span class="action-count">${formatCount(count)}</span>`;
  });
}

async function handleLike(postId) {
  if (!postId || likeRequests.has(postId)) return;

  const post = state.posts.find(item => item.id === postId);
  const wasLiked = reactionState.liked.has(postId);
  const optimisticLiked = !wasLiked;
  const previousCount = Math.max(0, Number(post?.likeCount || 0));
  const optimisticCount = Math.max(0, previousCount + (optimisticLiked ? 1 : -1));

  // Optimistic UI: update immediately so the interaction feels native,
  // then reconcile with Firebase in the background.
  optimisticLiked ? reactionState.liked.add(postId) : reactionState.liked.delete(postId);
  if (post) post.likeCount = optimisticCount;
  likeRequests.add(postId);
  syncLikeButtons(postId, optimisticLiked, optimisticCount, true);

  try {
    const serverLiked = await toggleLike(state.mode, state.user.uid, postId);
    const finalCount = Math.max(0, optimisticCount + (serverLiked === optimisticLiked ? 0 : (serverLiked ? 1 : -1)));
    serverLiked ? reactionState.liked.add(postId) : reactionState.liked.delete(postId);
    if (post) post.likeCount = finalCount;
    syncLikeButtons(postId, serverLiked, finalCount, false);

    // The Liked tab needs an immediate list refresh when an item is removed.
    if (state.activeFeedTab === 'liked') renderRoute();
  } catch (error) {
    // Roll back the optimistic change if Firebase rejects the write.
    wasLiked ? reactionState.liked.add(postId) : reactionState.liked.delete(postId);
    if (post) post.likeCount = previousCount;
    syncLikeButtons(postId, wasLiked, previousCount, false);
    toast(humanError(error), 'error');
  } finally {
    likeRequests.delete(postId);
    document.querySelectorAll('[data-like]').forEach((button) => {
      if (button.dataset.like === postId) button.disabled = false;
    });
  }
}
async function handleFollow(button) {
  const targetUserId = button?.dataset?.followUser || currentProfileView?.uid || '';
  if (!targetUserId || targetUserId === state.user.uid) return;
  const previous = button.getAttribute('aria-pressed') === 'true';
  button.disabled = true;
  button.textContent = previous ? 'Follow' : 'Following';
  button.classList.toggle('btn-primary', previous);
  button.classList.toggle('btn-secondary', !previous);
  button.classList.toggle('is-following', !previous);
  button.setAttribute('aria-pressed', String(!previous));
  try {
    const active = await toggleFollow(state.mode, state.user.uid, targetUserId);
    button.textContent = active ? 'Following' : 'Follow';
    button.classList.toggle('btn-primary', !active);
    button.classList.toggle('btn-secondary', active);
    button.classList.toggle('is-following', active);
    button.setAttribute('aria-pressed', String(active));
    await renderProfile(targetUserId);
  } catch (error) {
    button.textContent = previous ? 'Following' : 'Follow';
    button.classList.toggle('btn-primary', !previous);
    button.classList.toggle('btn-secondary', previous);
    button.classList.toggle('is-following', previous);
    button.setAttribute('aria-pressed', String(previous));
    toast(humanError(error), 'error');
  } finally {
    button.disabled = false;
  }
}

async function handleSave(postId) {
  try { const active=await toggleSave(state.mode,state.user.uid,postId); active?reactionState.saved.add(postId):reactionState.saved.delete(postId); toast(active?'Saved for later':'Removed from saved','success'); renderRoute(); }
  catch(e){ toast(humanError(e),'error'); }
}


async function handleOpportunitySave(button) {
  const opportunityId = button?.dataset?.opportunitySave || '';
  if (!opportunityId) return;
  await withButton(button, async () => {
    try {
      const opportunity = await getOpportunityById(state.mode, opportunityId);
      if (!opportunity) throw new Error('Opportunity is not available.');
      const isSaved = button.dataset.opportunitySaved === 'true';
      const journey = await setOpportunitySaved(state.mode, state.user.uid, opportunity, !isSaved);
      if (journey) currentJourneyStates.set(opportunityId, journey);
      toast(isSaved ? 'Removed from saved opportunities.' : 'Opportunity saved.', 'success');
      renderRoute();
    } catch (error) {
      toast(humanError(error), 'error');
    }
  });
}

async function handleStartJourney(button) {
  const opportunityId = button?.dataset?.startJourney || '';
  if (!opportunityId) return;
  await withButton(button, async () => {
    try {
      const opportunity = await getOpportunityById(state.mode, opportunityId);
      if (!opportunity) throw new Error('Opportunity is not available.');
      const journey = await startJourney(state.mode, state.user.uid, opportunity);
      currentJourneyStates.set(opportunityId, journey);
      toast('Application journey ready.', 'success');
      go(`journey/${encodeURIComponent(opportunityId)}`);
    } catch (error) {
      toast(humanError(error), 'error');
    }
  });
}

async function handleJourneyTaskToggle(button) {
  const opportunityId = button?.dataset?.opportunityId || '';
  const taskId = button?.dataset?.journeyTaskToggle || '';
  if (!opportunityId || !taskId) return;
  try {
    await toggleJourneyTask(state.mode, state.user.uid, opportunityId, taskId);
    await renderJourneyDetail(opportunityId);
  } catch (error) {
    toast(humanError(error), 'error');
  }
}

async function handleJourneyTaskDelete(button) {
  const opportunityId = button?.dataset?.opportunityId || '';
  const taskId = button?.dataset?.journeyTaskDelete || '';
  if (!opportunityId || !taskId) return;
  try {
    await deleteCustomJourneyTask(state.mode, state.user.uid, opportunityId, taskId);
    toast('Task removed.', 'success');
    await renderJourneyDetail(opportunityId);
  } catch (error) {
    toast(humanError(error), 'error');
  }
}

async function handleJourneyStageSave(form) {
  const opportunityId = form.dataset.journeyStageForm || '';
  const status = String(new FormData(form).get('status') || '');
  if (!opportunityId || !status) return;
  const submit = form.querySelector('button[type="submit"]');
  await withButton(submit, async () => {
    try {
      await updateJourneyStage(state.mode, state.user.uid, opportunityId, status);
      toast('Journey stage updated.', 'success');
      await renderJourneyDetail(opportunityId);
    } catch (error) {
      toast(humanError(error), 'error');
    }
  });
}

async function handleJourneyPlanningSave(form) {
  const opportunityId = form.dataset.journeyPlanningForm || '';
  const fd = new FormData(form);
  const submit = form.querySelector('button[type="submit"]');
  await withButton(submit, async () => {
    try {
      await updateJourneyPlanning(state.mode, state.user.uid, opportunityId, {
        personalTargetDate: String(fd.get('personalTargetDate') || ''),
        notes: String(fd.get('notes') || '')
      });
      toast('Journey planning saved.', 'success');
      await renderJourneyDetail(opportunityId);
    } catch (error) {
      toast(humanError(error), 'error');
    }
  });
}

async function handleJourneyTaskAdd(form) {
  const opportunityId = form.dataset.journeyTaskForm || '';
  const label = String(new FormData(form).get('label') || '').trim();
  if (!opportunityId || !label) return;
  const submit = form.querySelector('button[type="submit"]');
  await withButton(submit, async () => {
    try {
      await addCustomJourneyTask(state.mode, state.user.uid, opportunityId, label);
      toast('Task added.', 'success');
      await renderJourneyDetail(opportunityId);
    } catch (error) {
      toast(humanError(error), 'error');
    }
  });
}

async function handleDeletePost(postId, button) {
  const post = state.posts.find(item => item.id === postId) || await getPost(state.mode, postId).catch(() => null);
  if (!canDeletePost(post)) {
    modalRoot.innerHTML = '';
    toast('You can delete only your own posts.', 'error');
    return;
  }
  await withButton(button, async () => {
    try {
      await deletePost(state.mode, state.user.uid, postId);
      state.posts = state.posts.filter(item => item.id !== postId);
      reactionState.saved.delete(postId);
      reactionState.liked.delete(postId);
      modalRoot.innerHTML = '';
      toast('Post deleted successfully.', 'success');
      const [route, param] = routeParts();
      if (route === 'post' && param === postId) go('profile');
      else renderRoute();
    } catch (error) {
      toast(humanError(error), 'error');
    }
  });
}
async function handleComment(form) {
  const text=String(new FormData(form).get('content')||'').trim(); if(!text)return;
  const submit=form.querySelector('button[type="submit"]');
  await withButton(submit,async()=>{ try { const item=await addComment(state.mode,state.user,state.profile,form.dataset.commentForm,text); if(state.mode==='demo'){currentComments=[...currentComments,item]; renderPostDetail(form.dataset.commentForm);} form.reset(); toast('Answer published','success'); } catch(e){toast(humanError(e),'error');} });
}
async function handleMessage(form) {
  const text=String(new FormData(form).get('text')||'').trim(); if(!text)return;
  const input=form.elements.text; input.value='';
  try { const item=await sendMessage(state.mode,state.user.uid,form.dataset.messageForm,text); if(state.mode==='demo'){state.messages=[...state.messages,item];drawMessages(state.selectedConversation);} }
  catch(e){ input.value=text; toast(humanError(e),'error'); }
}
async function handleProfileSave(form) {
  const fd = new FormData(form);
  const submit = form.querySelector('button[type="submit"]');
  const selectedPhoto = fd.get('profileImage');
  await withButton(submit, async () => {
    try {
      const profile = await updateUserProfile(state.mode, state.user.uid, {
        fullName: String(fd.get('fullName') || '').trim(),
        username: String(fd.get('username') || '').trim(),
        bio: String(fd.get('bio') || '').trim(),
        profileImageFile: selectedPhoto instanceof File && selectedPhoto.size ? selectedPhoto : null
      });
      state.profile = { ...state.profile, ...profile };
      state.posts = state.posts.map(post => post.authorId === state.user.uid
        ? { ...post, authorName: profile.fullName, authorPhotoUrl: profile.photoUrl || '' }
        : post);
      modalRoot.innerHTML = '';
      toast(selectedPhoto instanceof File && selectedPhoto.size ? 'Profile and photo updated.' : 'Profile updated.', 'success');
      renderRoute();
    } catch (error) {
      toast(humanError(error), 'error');
    }
  });
}

async function handleProfilePhotoRemove(button) {
  await withButton(button, async () => {
    try {
      const profile = await removeProfilePhoto(state.mode, state.user.uid);
      state.profile = {
        ...state.profile,
        ...(profile || {}),
        photoUrl: '',
        profileImageUrl: '',
        photoURL: ''
      };
      state.posts = state.posts.map(post => post.authorId === state.user.uid
        ? { ...post, authorPhotoUrl: '' }
        : post);
      modalRoot.innerHTML = '';
      toast('Profile photo removed.', 'success');
      renderRoute();
    } catch (error) {
      toast(humanError(error), 'error');
    }
  });
}
async function handleStudentPassportSave(form) {
  const fd = new FormData(form);
  const submit = form.querySelector('button[type="submit"]');
  const csv = name => String(fd.get(name) || '').split(',').map(item => item.trim()).filter(Boolean);
  const input = {
    currentCountry: String(fd.get('currentCountry') || '').trim(),
    nationality: String(fd.get('nationality') || '').trim(),
    currentEducationLevel: String(fd.get('currentEducationLevel') || '').trim(),
    targetEducationLevel: String(fd.get('targetEducationLevel') || '').trim(),
    mainField: String(fd.get('mainField') || '').trim(),
    institution: String(fd.get('institution') || '').trim(),
    gpa: fd.get('gpa') === '' ? null : Number(fd.get('gpa')),
    gpaScale: Number(fd.get('gpaScale') || 4),
    preferredCountries: csv('preferredCountries'),
    fundingPreference: String(fd.get('fundingPreference') || '').trim(),
    englishTestStatus: String(fd.get('englishTestStatus') || '').trim(),
    languages: csv('languages'),
    skills: csv('skills'),
    studyGoal: String(fd.get('studyGoal') || '').trim(),
    documentsReady: {
      passport: fd.get('docPassport') === 'on',
      transcript: fd.get('docTranscript') === 'on',
      englishCertificate: fd.get('docEnglish') === 'on',
      recommendationLetter: fd.get('docRecommendation') === 'on',
      cv: fd.get('docCv') === 'on',
      personalStatement: fd.get('docStatement') === 'on'
    }
  };
  await withButton(submit, async () => {
    try {
      currentStudentPassport = await saveStudentPassport(state.mode, state.user.uid, input);
      toast('Student Passport saved.', 'success');
      await renderStudentPassport();
    } catch (error) {
      toast(humanError(error), 'error');
    }
  });
}


async function handleSuccessStorySubmit(form) {
  const fd=new FormData(form), submit=form.querySelector('button[type="submit"]'), errorEl=form.querySelector('[data-story-error]');
  const opportunityName=String(fd.get('opportunityName')||'').trim();
  const subject=String(fd.get('subject')||'').trim();
  const university=String(fd.get('university')||'').trim();
  const payload={
    title:String(fd.get('title')||'').trim() || `I received ${opportunityName}`,
    content:String(fd.get('content')||'').trim(),
    subject:subject || 'Student Success',
    tags:['student-success', subject].filter(Boolean),
    postType:'success_story',
    successData:{
      university, opportunityName, country:String(fd.get('country')||'').trim(),
      subject, studyLevel:String(fd.get('studyLevel')||'').trim(),
      intake:String(fd.get('intake')||'').trim(), fundingType:String(fd.get('fundingType')||'').trim()
    },
    communityUniversity:university,
    communityIntake:String(fd.get('intake')||'').trim(),
    communitySubject:subject,
    imageFiles:[]
  };
  await withButton(submit,async()=>{try{const post=await createPost(state.mode,state.user,state.profile,payload);modalRoot.innerHTML='';if(state.mode==='demo')state.posts=[post,...state.posts];toast('Success story published.','success');go(`post/${post.id}`);}catch(error){errorEl.textContent=humanError(error);}});
}

async function handleJourneyStorySubmit(form) {
  const fd=new FormData(form), submit=form.querySelector('button[type="submit"]'), errorEl=form.querySelector('[data-story-error]');
  const milestones=[];
  for(let i=1;i<=4;i++){const stage=String(fd.get(`stage${i}`)||'').trim(),month=String(fd.get(`month${i}`)||'').trim(),note=String(fd.get(`note${i}`)||'').trim();if(stage||note)milestones.push({stage,month,note});}
  if(!milestones.length){errorEl.textContent='Add at least one public milestone.';return;}
  const subject=String(fd.get('subject')||'').trim(), university=String(fd.get('university')||'').trim(), intake=String(fd.get('intake')||'').trim();
  const payload={title:String(fd.get('title')||'').trim(),content:String(fd.get('content')||'').trim(),subject:subject||'Student Journey',tags:['student-journey',subject].filter(Boolean),postType:'journey_story',publicMilestones:milestones,communitySubject:subject,communityUniversity:university,communityIntake:intake,imageFiles:[]};
  await withButton(submit,async()=>{try{const post=await createPost(state.mode,state.user,state.profile,payload);modalRoot.innerHTML='';if(state.mode==='demo')state.posts=[post,...state.posts];toast('Journey story published.','success');go(`post/${post.id}`);}catch(error){errorEl.textContent=humanError(error);}});
}

async function handleCommunityPostSubmit(form) {
  const fd=new FormData(form),submit=form.querySelector('button[type="submit"]');
  const subject=form.dataset.communitySubject||'', university=form.dataset.communityUniversity||'', intake=form.dataset.communityIntake||'';
  const payload={title:String(fd.get('title')||'').trim(),content:String(fd.get('content')||'').trim(),subject:subject||'General',tags:[subject,university,intake].filter(Boolean).slice(0,6),postType:'discussion',communitySubject:subject,communityUniversity:university,communityIntake:intake,imageFiles:[]};
  await withButton(submit,async()=>{try{const post=await createPost(state.mode,state.user,state.profile,payload);modalRoot.innerHTML='';if(state.mode==='demo')state.posts=[post,...state.posts];toast('Community post published.','success');go(`post/${post.id}`);}catch(error){toast(humanError(error),'error');}});
}


async function handleAdminReview(button) {
  if (!adminCapability) return;
  const id=button.dataset.adminOpportunityId||'', action=button.dataset.adminReviewAction||'';
  const opportunity=currentAdminOpportunities.find(item=>item.id===id);
  if(!opportunity){toast('Opportunity not found.','error');return;}
  await withButton(button,async()=>{try{await reviewOpportunity(state.mode,state.user,state.profile,opportunity,action);toast(action==='verify'?'Opportunity verified and published.':'Opportunity review state updated.','success');await renderAdmin();}catch(error){toast(humanError(error),'error');}});
}

async function handleAdminImportPreview(form) {
  if (!adminCapability) return;
  const fd=new FormData(form);
  adminImportSource=String(fd.get('source')||'');
  const parsed=parseOpportunityImport(adminImportSource,'auto');
  if(parsed.error){adminPreviewRows=[];toast(parsed.error,'error');}
  else{adminPreviewRows=markImportDuplicates(parsed.rows,currentAdminOpportunities);toast(`Previewed ${adminPreviewRows.length} record${adminPreviewRows.length===1?'':'s'}.`,'success');}
  adminTab='import';
  await renderAdmin();
}

async function handleAdminImportConfirm(button) {
  if (!adminCapability) return;
  await withButton(button,async()=>{try{const result=await importOpportunityRecords(state.mode,state.user,state.profile,adminPreviewRows,currentAdminOpportunities);toast(`${result.imported} opportunit${result.imported===1?'y':'ies'} imported as pending drafts.`,'success');adminPreviewRows=[];adminImportSource='';await renderAdmin();}catch(error){toast(humanError(error),'error');}});
}

async function handleReport(form) {
  const fd=new FormData(form); try { await reportPost(state.mode,state.user.uid,form.dataset.reportForm,String(fd.get('reason')||''),String(fd.get('details')||'')); modalRoot.innerHTML=''; toast('Report submitted. Thank you.','success'); } catch(e){toast(humanError(e),'error');}
}
async function handleNotification(el) {
  try { await markNotificationRead(state.mode,el.dataset.notification); const n=state.notifications.find(x=>x.id===el.dataset.notification); if(n)n.read=true; state.unreadCount=state.notifications.filter(n=>!n.read).length; if(el.dataset.post)go(`post/${el.dataset.post}`);else renderNotifications(); }catch(e){toast(humanError(e),'error');}
}
async function handleStartConversation(profile) {
  if(!profile?.uid)return;
  try { const conv=await startConversation(state.mode,state.user.uid,profile); if(!state.conversations.some(c=>c.id===conv.id))state.conversations.unshift(conv); go(`messages/${conv.id}`); }
  catch(e){toast(humanError(e),'error');}
}
async function withButton(button, task) {
  if (!button) return task();
  const old=button.innerHTML; button.disabled=true; button.textContent='Please wait…';
  try { return await task(); } finally { button.disabled=false; button.innerHTML=old; }
}

function handleInput(event) {
  if (event.target.matches('[data-profile-photo-input]')) {
    const input = event.target;
    const file = input.files?.[0] || null;
    const preview = input.form?.querySelector('[data-profile-photo-preview]');
    if (!file) return;

    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(String(file.type || '').toLowerCase())) {
      toast('Profile photo must be JPG, PNG or WebP.', 'error');
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast('Profile photo must be 5 MB or smaller.', 'error');
      input.value = '';
      return;
    }

    if (input.dataset.previewUrl) URL.revokeObjectURL(input.dataset.previewUrl);
    const url = URL.createObjectURL(file);
    input.dataset.previewUrl = url;
    if (preview) {
      preview.innerHTML = `<div class="avatar lg has-photo v4-modal-avatar"><img class="protected-avatar-image" src="${url}" alt="New profile photo preview"></div>`;
    }
    return;
  }

  const fileInput = event.target.matches('[data-compose-form] input[type="file"]') ? event.target : null;
  if (!fileInput) return;
  const preview = fileInput.form.querySelector('[data-image-preview]');
  const files = [...(fileInput.files || [])];
  const policy = getWebPostingPolicy(state.profile || {});
  const allowed = new Set(['image/png', 'image/jpeg', 'image/webp']);
  const totalBytes = files.reduce((sum, file) => sum + Number(file.size || 0), 0);

  if (!files.length) { preview.classList.add('hidden'); preview.innerHTML = ''; return; }
  if (files.length > policy.maxImagesPerPost) { toast(`Your plan allows ${policy.maxImagesPerPost} image${policy.maxImagesPerPost === 1 ? '' : 's'} per post.`, 'error'); fileInput.value = ''; return; }
  if (files.some(file => !allowed.has(file.type))) { toast('Only PNG, JPG and WebP images are allowed.', 'error'); fileInput.value = ''; return; }
  if (totalBytes > policy.maxTotalImageBytes) { toast(`Images must be within ${Math.round(policy.maxTotalImageBytes/1024/1024)} MB total for your plan.`, 'error'); fileInput.value = ''; return; }

  preview.innerHTML = files.map((file, index) => {
    const url = URL.createObjectURL(file);
    return `<figure><img src="${url}" alt="Selected image ${index + 1}"><figcaption>${(file.size/1024/1024).toFixed(1)} MB</figcaption></figure>`;
  }).join('');
  preview.classList.remove('hidden');
}

document.addEventListener('error', event => {
  const img = event.target;
  if (img instanceof HTMLImageElement && img.closest('.avatar, .top-avatar')) {
    img.remove();
  }
}, true);

function handleProfileMenuCapture(event) {
  const trigger = event.target.closest?.('[data-profile-menu]');
  if (!trigger) return;
  event.preventDefault();
  event.stopPropagation();
  state.ui.profileMenu = !state.ui.profileMenu;
  syncProfileMenu();
}

function protectDisplayedAvatarMedia(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (!target.closest('.avatar, .top-avatar')) return;
  event.preventDefault();
}

window.addEventListener('hashchange', renderRoute);
// Capture phase makes the top-right avatar reliable on mobile even when the
// search/header layers overlap or the image itself receives the tap.
document.addEventListener('click', handleProfileMenuCapture, true);
document.addEventListener('contextmenu', protectDisplayedAvatarMedia, true);
document.addEventListener('dragstart', protectDisplayedAvatarMedia, true);
document.addEventListener('click', handleClick);
document.addEventListener('submit', handleSubmit);
document.addEventListener('change', handleInput);
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==='k') { event.preventDefault(); document.querySelector('[data-global-search-form] input')?.focus(); }
  if (event.key==='Escape' && modalRoot.innerHTML) modalRoot.innerHTML='';
  if (event.key==='Escape' && state.ui.profileMenu) { state.ui.profileMenu = false; syncProfileMenu(); }
});

if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

boot();
