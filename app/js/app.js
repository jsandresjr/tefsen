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
import { getStudentPassport, saveStudentPassport, studentPassportCompleteness, studentPassportCompletionDetails, validateStudentPassportInput, studentPassportOnboardingProgress, shouldShowPassportOnboarding, emptyStudentPassport } from './services/student-passport-service.js';
import { evaluateEligibility, scoreOpportunityMatch } from './services/eligibility-engine.js';
import {
  listJourneyStates, getJourneyState, setOpportunitySaved, removeSavedOpportunity, startJourney,
  updateJourneyStage, updateJourneyPlanning, toggleJourneyTask,
  addCustomJourneyTask, deleteCustomJourneyTask,
  updatePostAcceptancePlanning, togglePostAcceptanceTask, addPostAcceptanceTask, deletePostAcceptanceTask,
  journeyProgress, allowedJourneyTransitions, JOURNEY_LABELS, JOURNEY_STATUSES
} from './services/journey-service.js';
import { deadlineInfo } from './services/deadline-engine.js';
import { buildHomeDashboardModel } from './services/home-dashboard-service.js';
import { buildSavedOpportunityWorkspace, buildSavedComparison } from './services/saved-opportunity-service.js';
import { buildJourneyPriorityWorkspace } from './services/journey-priority-service.js';
import { buildJourneyDetailModel, validateJourneyPlanningDraft } from './services/journey-detail-service.js';
import { buildPublicProfileModel, isPublicProfileActivity, validatePublicProfileDraft } from './services/public-profile-service.js';
import { validatePostAcceptanceDraft } from './services/post-acceptance-service.js';
import { postAcceptancePanelMarkup } from './post-acceptance-view.js';
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
let passportOnboardingJustCompleted = false;
let currentJourneyStates = new Map();
let currentSavedWorkspace = null;
let savedOpportunityCompareIds = new Set();
const DEFAULT_OPPORTUNITY_FILTERS = Object.freeze({
  query: '',
  country: 'all',
  level: 'all',
  funding: 'all',
  type: 'all',
  view: 'all',
  sort: 'match'
});
let opportunityDiscoveryFilters = { ...DEFAULT_OPPORTUNITY_FILTERS };
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
  currentStudentPassport = null;
  passportOnboardingJustCompleted = false;
  currentSavedWorkspace = null;
  savedOpportunityCompareIds = new Set();
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
    const [profile, reactions, notifications, conversations, passport] = await Promise.all([
      getProfile(state.mode, user).catch(() => normalizeUser({ uid: user.uid, fullName: user.displayName || user.email || 'Tefsen User', email: user.email || '' }, user.uid)),
      getReactionIds(state.mode, user.uid).catch(() => ({ saved: new Set(), liked: new Set() })),
      getNotifications(state.mode, user.uid).catch(() => []),
      getConversations(state.mode, user.uid).catch(() => []),
      getStudentPassport(state.mode, user.uid).catch(() => emptyStudentPassport(user.uid))
    ]);
    currentStudentPassport = passport;
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
    if (!location.hash || location.hash === '#/') go(shouldShowPassportOnboarding(passport) ? 'passport' : 'home'); else renderRoute();
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
  renderShell(`<div class="home-v3"><section class="home-v3-hero loading"><div><span class="opportunity-kicker">YOUR STUDENT JOURNEY</span><h1>Preparing your next step…</h1><p>Loading Student Passport, opportunities and private Journey progress.</p></div></section></div>`, { wide:true, right:false });

  try {
    const [passport, opportunities, journeys] = await Promise.all([
      getStudentPassport(state.mode, state.user.uid).catch(() => emptyStudentPassport(state.user.uid)),
      getOpportunities(state.mode).catch(() => []),
      listJourneyStates(state.mode, state.user.uid).catch(() => [])
    ]);

    currentStudentPassport = passport;
    currentJourneyStates = new Map(journeys.map(row => [row.opportunityId, row]));

    const passportDetails = studentPassportCompletionDetails(passport);
    const ranked = opportunities
      .map(item => {
        const match = scoreOpportunityMatch(passport, item);
        const matchView = opportunityMatchPresentation(match);
        return {
          item,
          match,
          matchView,
          profileScore:matchView.score,
          personalized:matchView.personalized
        };
      })
      .sort((a,b) => (b.profileScore - a.profileScore) || (b.match.score - a.match.score));

    const dashboard = buildHomeDashboardModel({
      passport,
      passportDetails,
      rankedOpportunities:ranked,
      journeys
    });

    const firstName = String(state.profile?.fullName || 'Student').trim().split(/\s+/)[0] || 'Student';
    const successes = state.posts.filter(post => post.postType === 'success_story').slice(0,2);
    const stateCopy = {
      deadline:{ label:'DEADLINE FOCUS', title:'Protect the opportunity already on your path.' },
      accepted:{ label:'ACCEPTED · NEXT STAGE', title:'Turn an acceptance into a prepared next chapter.' },
      journey:{ label:'APPLICATION IN PROGRESS', title:'Keep your active application moving.' },
      getting_started:{ label:'GETTING STARTED', title:'Build enough context for Tefsen to guide you.' },
      saved:{ label:'SAVED OPPORTUNITY', title:'Turn interest into a preparation plan.' },
      match:{ label:'PROFILE MATCH', title:'Review the strongest opportunity signal on your path.' },
      discovery:{ label:'DISCOVERY', title:'Find a useful next opportunity.' }
    };
    const homeState = stateCopy[dashboard.state] || stateCopy.discovery;

    const homeMatchCard = ({item,matchView}) => {
      const deadline = opportunityDeadlinePresentation(item);
      const matchLabel = matchView.personalized
        ? `${matchView.score}% profile match`
        : 'Complete Passport to personalize';
      return `<button class="home-v3-match-card" type="button" data-route="opportunity/${encodeURIComponent(item.id)}">
        <div class="home-v3-match-meta">
          <span class="opportunity-funding-badge">${escapeHTML(item.fundingType || 'Funding varies')}</span>
          <span class="opportunity-location-badge">${escapeHTML(item.country || 'Multiple / global')}</span>
        </div>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.provider || item.university || 'Opportunity provider')}</p>
        <div class="home-v3-match-foot">
          <span class="${matchView.personalized ? 'personalized' : ''}">${escapeHTML(matchLabel)}</span>
          <small class="${escapeHTML(deadline.tone)}">${escapeHTML(deadline.label)}</small>
        </div>
      </button>`;
    };

    const nearestMarkup = dashboard.nearestDeadline
      ? `<section class="home-v3-focus-card">
          <div class="home-v3-focus-icon">${icon('info',19)}</div>
          <div>
            <span>NEAREST SAVED DEADLINE</span>
            <h3>${escapeHTML(dashboard.nearestDeadline.title)}</h3>
            <p>${dashboard.nearestDeadline.days === 0 ? 'Deadline today' : `${dashboard.nearestDeadline.days} days remaining`}. Confirm the exact deadline on the official provider source.</p>
          </div>
          <button class="btn btn-secondary" type="button" data-route="${escapeHTML(dashboard.nearestDeadline.route)}">Open</button>
        </section>`
      : '';

    const journeyFocus = dashboard.acceptedJourney
      ? `<section class="home-v3-journey-empty accepted">
          <span class="home-v3-mini-kicker">ACCEPTED OUTCOME</span>
          <h3>Continue planning after acceptance.</h3>
          <p>Your accepted Journey stays private. Use it to organize the next stage instead of treating acceptance as the end of the process.</p>
          <button class="btn btn-primary" type="button" data-route="journey/${encodeURIComponent(dashboard.acceptedJourney.opportunityId)}">Open accepted Journey</button>
        </section>`
      : dashboard.activeJourney
        ? (() => {
            const row = dashboard.activeJourney;
            const opportunity = opportunities.find(item => item.id === row.opportunityId);
            const progress = journeyProgress(row);
            return `<section class="home-v3-journey-empty active">
              <span class="home-v3-mini-kicker">ACTIVE APPLICATION</span>
              <h3>${escapeHTML(opportunity?.title || 'Application Journey')}</h3>
              <p>${escapeHTML(JOURNEY_LABELS[row.status] || row.status)} · ${progress.completed}/${progress.total} preparation tasks complete.</p>
              <div class="home-v3-inline-progress"><i style="width:${progress.percent}%"></i></div>
              <button class="btn btn-primary" type="button" data-route="journey/${encodeURIComponent(row.opportunityId)}">Continue Journey</button>
            </section>`;
          })()
        : dashboard.savedCount
          ? `<section class="home-v3-journey-empty saved">
              <span class="home-v3-mini-kicker">SAVED FOR LATER</span>
              <h3>${dashboard.savedCount} saved opportunit${dashboard.savedCount === 1 ? 'y' : 'ies'} waiting for a decision.</h3>
              <p>Review requirements and start a private Journey only for opportunities you seriously want to prepare.</p>
              <button class="btn btn-secondary" type="button" data-route="journeys">Review saved opportunities</button>
            </section>`
          : `<section class="home-v3-journey-empty">
              <span class="home-v3-mini-kicker">NO APPLICATION JOURNEY YET</span>
              <h3>Save an opportunity when it is worth tracking.</h3>
              <p>Your Journey becomes the private place for stages, tasks, notes and deadlines. You do not need to start one just to browse.</p>
              <button class="btn btn-secondary" type="button" data-route="opportunities">Find an opportunity</button>
            </section>`;

    const gettingStarted = dashboard.newUser
      ? `<section class="home-v3-starter">
          <div class="home-v3-section-title">
            <div><span class="opportunity-kicker">START WITH THREE SMALL STEPS</span><h2>Make Tefsen useful without filling everything at once.</h2></div>
          </div>
          <div class="home-v3-starter-grid">
            <button type="button" data-route="passport"><span>01</span><div><b>Set your direction</b><small>Add essential Student Passport fields.</small></div></button>
            <button type="button" data-route="opportunities"><span>02</span><div><b>Explore globally</b><small>Browse opportunities from different countries and providers.</small></div></button>
            <button type="button" data-route="opportunities"><span>03</span><div><b>Save selectively</b><small>Start a Journey only when an opportunity is worth preparing.</small></div></button>
          </div>
        </section>`
      : '';

    const content = `${demoBanner()}<div class="home-v3 home-state-${escapeHTML(dashboard.state)}">
      <section class="home-v3-hero">
        <div class="home-v3-hero-copy">
          <span class="opportunity-kicker">${escapeHTML(homeState.label)}</span>
          <h1>Welcome, ${escapeHTML(firstName)}.<br>${escapeHTML(homeState.title)}</h1>
          <p>Tefsen brings your private Student Passport, global opportunity discovery, deadlines and application Journey into one place without turning profile completion into an acceptance score.</p>
          <div class="home-v3-hero-actions">
            <button class="btn btn-primary" type="button" data-route="${escapeHTML(dashboard.action.route)}">${escapeHTML(dashboard.action.button)}</button>
            <button class="btn btn-secondary" type="button" data-route="opportunities">Explore opportunities</button>
          </div>
        </div>

        <aside class="home-v3-goal">
          <span>CURRENT DIRECTION</span>
          <strong>${escapeHTML(dashboard.goal)}</strong>
          <div class="home-v3-passport-progress"><i style="width:${dashboard.passportPercent}%"></i></div>
          <div class="home-v3-goal-foot">
            <small>Student Passport · ${dashboard.passportPercent}% complete</small>
            <button type="button" data-route="passport">Edit Passport</button>
          </div>
        </aside>
      </section>

      <section class="home-v3-next ${escapeHTML(dashboard.action.tone)}">
        <div class="home-v3-next-icon">${dashboard.action.tone === 'urgent' ? '!' : icon('check',20)}</div>
        <div class="home-v3-next-copy">
          <span>RECOMMENDED NEXT ACTION</span>
          <h2>${escapeHTML(dashboard.action.title)}</h2>
          <p>${escapeHTML(dashboard.action.detail)}</p>
          <small>${escapeHTML(dashboard.action.reason)}</small>
        </div>
        <button class="btn btn-primary" type="button" data-route="${escapeHTML(dashboard.action.route)}">${escapeHTML(dashboard.action.button)}</button>
      </section>

      ${gettingStarted}

      <section class="home-v3-stats" aria-label="Student journey summary">
        <article><span>Passport</span><strong>${dashboard.passportPercent}%</strong><small>Profile completeness</small></article>
        <article><span>Saved</span><strong>${dashboard.savedCount || '—'}</strong><small>${dashboard.savedCount ? 'opportunities being tracked' : 'Nothing saved yet'}</small></article>
        <article><span>Active</span><strong>${dashboard.activeCount || '—'}</strong><small>${dashboard.activeCount ? 'application Journeys' : 'No active application'}</small></article>
        <article><span>Nearest deadline</span><strong>${dashboard.nearestDeadline ? (dashboard.nearestDeadline.days === 0 ? 'Today' : dashboard.nearestDeadline.days) : '—'}</strong><small>${dashboard.nearestDeadline ? (dashboard.nearestDeadline.days === 0 ? 'Act today' : 'days remaining') : 'No dated saved deadline'}</small></article>
      </section>

      ${nearestMarkup}

      <section class="home-v3-section">
        <div class="home-v3-section-title">
          <div><span class="opportunity-kicker">DISCOVER</span><h2>${dashboard.essentialReady ? 'Recommended from your current profile' : 'Explore opportunities while you build your Passport'}</h2><p>${dashboard.essentialReady ? 'Profile match is based on structured Student Passport factors, not source verification and not an admission prediction.' : 'You can explore the global catalogue now. Tefsen will personalize ranking more as your essential Passport fields become complete.'}</p></div>
          <button class="btn btn-ghost" type="button" data-route="opportunities">View all</button>
        </div>
        <div class="home-v3-match-grid">
          ${ranked.length ? ranked.slice(0,3).map(homeMatchCard).join('') : `<section class="home-v3-empty">
            <div>${icon('compass',22)}</div><h3>No opportunities are loaded yet.</h3><p>Open Opportunities to review the catalogue state and official-source listings.</p><button class="btn btn-secondary" type="button" data-route="opportunities">Open Opportunities</button>
          </section>`}
        </div>
      </section>

      <section class="home-v3-section home-v3-two-col">
        <div>
          <div class="home-v3-section-title compact">
            <div><span class="opportunity-kicker">YOUR JOURNEY</span><h2>Applications & preparation</h2><p>Private stages, tasks and deadlines for opportunities you choose to pursue.</p></div>
            <button class="btn btn-ghost" type="button" data-route="journeys">Open Journey</button>
          </div>
          ${journeyFocus}
        </div>

        <div>
          <div class="home-v3-section-title compact">
            <div><span class="opportunity-kicker">COMMUNITY OUTCOMES</span><h2>Learn from student experiences</h2><p>Community stories can add context, but official sources still control requirements.</p></div>
            <button class="btn btn-ghost" type="button" data-route="explore">Community</button>
          </div>
          <div class="home-v3-outcomes">${successes.length
            ? successes.map(post => `<button class="home-v3-outcome-card" type="button" data-route="post/${encodeURIComponent(post.id)}"><span>SUCCESS STORY</span><h3>${escapeHTML(post.title || 'Student success')}</h3><p>${escapeHTML((post.content || '').slice(0,150))}</p></button>`).join('')
            : `<section class="home-v3-journey-empty"><span class="home-v3-mini-kicker">COMMUNITY IS GROWING</span><h3>No public success stories yet.</h3><p>Student outcomes will appear here only when students choose to share them publicly.</p><button class="btn btn-secondary" type="button" data-route="explore">Open Community</button></section>`}
          </div>
        </div>
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

function opportunityDeadlineLabel(item = {}) {
  if (item.deadline) return opportunityDateLabel(item.deadline);
  return item.deadlineNote || 'Deadline varies — check official source';
}

function opportunitySourceCheckedLabel(item = {}) {
  const raw = item.sourceCheckedAt || item.lastVerifiedAt || '';
  const date = new Date(raw);
  if (!raw || Number.isNaN(date.getTime())) return 'Official source linked';
  return `Source checked ${date.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' })}`;
}

function opportunityFilterOptions(values = []) {
  return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))]
    .sort((a,b) => a.localeCompare(b));
}

function opportunityOptionMarkup(values, current, label = 'All') {
  return `<option value="all">${escapeHTML(label)}</option>${values.map(value => `<option value="${escapeHTML(value.toLowerCase())}" ${current === value.toLowerCase() ? 'selected' : ''}>${escapeHTML(value)}</option>`).join('')}`;
}

function opportunityDeadlineDays(item = {}) {
  const info = deadlineInfo(item.deadline || '');
  return info.valid && Number.isFinite(info.daysRemaining) ? info.daysRemaining : 99999;
}

function opportunitySearchText(item = {}) {
  return [
    item.title, item.provider, item.university, item.country, item.opportunityType,
    item.fundingType, ...(item.subjects || []), ...(item.studyLevels || [])
  ].filter(Boolean).join(' ').toLowerCase();
}

function opportunityActiveFilterLabel(key, value) {
  const labels = {
    query: `Search: ${value}`,
    country: value,
    level: value,
    funding: value,
    type: value,
    view: value === 'closing' ? 'Closing soon' : value === 'saved' ? 'Saved' : value
  };
  return labels[key] || value;
}

function syncOpportunityDiscoveryControls() {
  const filters = opportunityDiscoveryFilters;
  const search = document.querySelector('[data-opportunity-search]');
  if (search && search.value !== filters.query) search.value = filters.query;

  document.querySelectorAll('[data-opportunity-filter]').forEach(control => {
    const key = control.dataset.opportunityFilter;
    if (key && control.value !== filters[key]) control.value = filters[key];
  });

  document.querySelectorAll('[data-opportunity-view]').forEach(button => {
    const active = button.dataset.opportunityView === filters.view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function applyOpportunityDiscoveryFilters() {
  const grid = document.querySelector('[data-opportunity-grid]');
  if (!grid) return;

  syncOpportunityDiscoveryControls();
  const filters = opportunityDiscoveryFilters;
  const cards = [...grid.querySelectorAll('[data-opportunity-card]')];

  const visible = cards.filter(card => {
    const matchesSearch = !filters.query || String(card.dataset.search || '').includes(filters.query.toLowerCase());
    const matchesCountry = filters.country === 'all' || card.dataset.country === filters.country;
    const levels = String(card.dataset.levels || '').split('|').filter(Boolean);
    const matchesLevel = filters.level === 'all' || levels.includes(filters.level);
    const matchesFunding = filters.funding === 'all' || card.dataset.funding === filters.funding;
    const matchesType = filters.type === 'all' || card.dataset.type === filters.type;
    const days = Number(card.dataset.deadlineDays || 99999);
    const matchesView = filters.view === 'all'
      || (filters.view === 'closing' && days >= 0 && days <= 30)
      || (filters.view === 'saved' && card.dataset.saved === 'true');

    const show = matchesSearch && matchesCountry && matchesLevel && matchesFunding && matchesType && matchesView;
    card.hidden = !show;
    return show;
  });

  visible.sort((a,b) => {
    if (filters.sort === 'deadline') {
      return Number(a.dataset.deadlineDays || 99999) - Number(b.dataset.deadlineDays || 99999);
    }
    if (filters.sort === 'title') {
      return String(a.dataset.title || '').localeCompare(String(b.dataset.title || ''));
    }
    return Number(b.dataset.match || 0) - Number(a.dataset.match || 0);
  });
  visible.forEach(card => grid.appendChild(card));

  const count = document.querySelector('[data-opportunity-results-count]');
  if (count) count.textContent = `${visible.length} opportunit${visible.length === 1 ? 'y' : 'ies'}`;

  const empty = document.querySelector('[data-opportunity-filter-empty]');
  if (empty) empty.hidden = visible.length > 0;

  const active = document.querySelector('[data-opportunity-active-filters]');
  if (active) {
    const chips = [];
    for (const key of ['query','country','level','funding','type','view']) {
      const value = filters[key];
      if (!value || value === 'all') continue;
      chips.push(`<button type="button" class="opportunity-active-chip" data-opportunity-clear-filter="${key}" aria-label="Remove ${escapeHTML(opportunityActiveFilterLabel(key,value))} filter">${escapeHTML(opportunityActiveFilterLabel(key,value))}<span aria-hidden="true">×</span></button>`);
    }
    active.innerHTML = chips.join('');
    active.hidden = chips.length === 0;
  }
}

const applyOpportunitySearchDebounced = debounce(() => applyOpportunityDiscoveryFilters(), 120);

function opportunityDeadlinePresentation(item = {}) {
  const info = deadlineInfo(item.deadline || '');
  if (!info.valid) {
    return {
      tone: 'unknown',
      label: item.deadlineNote || 'Deadline varies',
      detail: item.deadlineNote ? 'Check the official source for the exact date.' : 'No structured deadline is stored.'
    };
  }

  if (info.daysRemaining === 0) return { tone:'urgent', label:'Deadline today', detail:'Review the official source now.' };
  if (info.daysRemaining > 0 && info.daysRemaining <= 6) return { tone:'urgent', label:`${info.daysRemaining} days left`, detail:opportunityDateLabel(item.deadline) };
  if (info.daysRemaining <= 14) return { tone:'soon', label:`${info.daysRemaining} days left`, detail:opportunityDateLabel(item.deadline) };
  if (info.daysRemaining <= 30) return { tone:'watch', label:`${info.daysRemaining} days left`, detail:opportunityDateLabel(item.deadline) };
  if (info.daysRemaining < 0) return { tone:'expired', label:'Expired', detail:opportunityDateLabel(item.deadline) };
  return { tone:'normal', label:opportunityDateLabel(item.deadline).replace(/^Deadline\s+/,'').trim(), detail:`${info.daysRemaining} days remaining` };
}

function opportunityTrustPresentation(item = {}) {
  const preview = item.verificationStatus === 'preview';
  const starter = item.catalogSource === 'starter';

  if (preview) {
    return { tone:'preview', label:'Preview data', detail:'Development-only listing' };
  }

  if (starter) {
    return {
      tone:'starter',
      label:'Official source checked',
      detail:opportunitySourceCheckedLabel(item)
    };
  }

  const freshness = opportunityFreshness(item);
  if (item.verificationStatus === 'verified' && freshness.state === 'stale') {
    return { tone:'stale', label:'Source needs re-check', detail:freshness.label };
  }
  if (item.verificationStatus === 'verified' && freshness.state === 'aging') {
    return { tone:'aging', label:'Verified · review soon', detail:freshness.label };
  }
  if (item.verificationStatus === 'verified') {
    return { tone:'verified', label:'Verified source', detail:opportunitySourceCheckedLabel(item) };
  }
  return { tone:'unverified', label:'Source not verified', detail:'Use the provider page before acting.' };
}

function opportunityMatchPresentation(match = null) {
  const reasons = (match?.reasons || []).filter(reason => reason !== 'verified source');
  if (!reasons.length) {
    return {
      personalized:false,
      score:0,
      label:'Build your match',
      detail:'Complete Student Passport for a profile-based comparison.'
    };
  }

  const reasonLabels = {
    'field of study':'field',
    'study level':'study level',
    'preferred country':'country',
    'funding preference':'funding',
    'nationality':'nationality'
  };
  const weights = {
    'field of study':30,
    'study level':25,
    'preferred country':15,
    'funding preference':15,
    'nationality':10
  };
  const rawProfileScore = reasons.reduce((sum, reason) => sum + (weights[reason] || 0), 0);
  const adjustedProfileScore = match?.eligibility?.hasBlockingMismatch
    ? Math.max(0, rawProfileScore - 45)
    : rawProfileScore;
  const profileScore = Math.max(0, Math.min(100, Math.round((adjustedProfileScore / 95) * 100)));
  const readable = reasons.map(reason => reasonLabels[reason] || reason);

  return {
    personalized:true,
    score:profileScore,
    label:`${profileScore}% profile match`,
    detail:`Matches ${readable.slice(0,3).join(' · ')}${readable.length > 3 ? ` +${readable.length - 3}` : ''}`
  };
}

function opportunityCard(item, match = null, journey = null) {
  const deadline = opportunityDeadlinePresentation(item);
  const trust = opportunityTrustPresentation(item);
  const matchView = opportunityMatchPresentation(match);
  const deadlineDays = opportunityDeadlineDays(item);
  const searchText = opportunitySearchText(item);
  const subjects = (item.subjects || []).filter(Boolean);
  const studyLevels = (item.studyLevels || []).filter(Boolean);
  const saved = Boolean(journey?.saved);
  const inJourney = Boolean(journey?.started);
  const source = safeUrl(item.officialSourceUrl || '');

  const subjectMarkup = subjects.slice(0,2).map(value => `<span class="opportunity-subject-tag">${escapeHTML(value)}</span>`).join('');
  const extraSubjects = subjects.length > 2 ? `<span class="opportunity-subject-more">+${subjects.length - 2}</span>` : '';
  const levelText = studyLevels.slice(0,2).join(' · ') || 'Study level varies';

  return `<article class="opportunity-card opportunity-card-v3" data-opportunity-card
    data-search="${escapeHTML(searchText)}"
    data-country="${escapeHTML(String(item.country || '').toLowerCase())}"
    data-levels="${escapeHTML(studyLevels.map(value => String(value).toLowerCase()).join('|'))}"
    data-funding="${escapeHTML(String(item.fundingType || '').toLowerCase())}"
    data-type="${escapeHTML(String(item.opportunityType || '').toLowerCase())}"
    data-deadline-days="${deadlineDays}"
    data-saved="${saved ? 'true' : 'false'}"
    data-match="${Number(matchView.score || 0)}"
    data-title="${escapeHTML(String(item.title || '').toLowerCase())}">

    <div class="opportunity-card-eyebrow">
      <span class="opportunity-type-mark">${icon('compass',15)} ${escapeHTML(item.opportunityType || 'Opportunity')}</span>
      <div class="opportunity-card-state">
        ${inJourney ? '<span class="opportunity-journey-state">In Journey</span>' : saved ? '<span class="opportunity-saved-state">Saved</span>' : ''}
      </div>
    </div>

    <div class="opportunity-card-heading">
      <h3>${escapeHTML(item.title)}</h3>
      <p class="opportunity-provider">${escapeHTML(item.provider || item.university || 'Opportunity provider')}</p>
    </div>

    <div class="opportunity-card-primary-meta">
      <span class="opportunity-funding-badge">${escapeHTML(item.fundingType || 'Funding not specified')}</span>
      <span class="opportunity-location-badge">${escapeHTML(item.country || 'Global')}</span>
      <span class="opportunity-level-text">${escapeHTML(levelText)}</span>
    </div>

    <p class="opportunity-card-summary">${escapeHTML(item.summary || 'Review the opportunity details, requirements and official provider source.')}</p>

    ${subjects.length ? `<div class="opportunity-subject-row">${subjectMarkup}${extraSubjects}</div>` : ''}

    <div class="opportunity-card-signals">
      <div class="opportunity-signal match ${matchView.personalized ? 'personalized' : 'incomplete'}">
        <span class="opportunity-signal-icon">${icon('user',16)}</span>
        <div>
          <b>${escapeHTML(matchView.label)}</b>
          <small>${escapeHTML(matchView.detail)}</small>
        </div>
      </div>

      <div class="opportunity-signal deadline ${deadline.tone}">
        <span class="opportunity-signal-icon">${icon('info',16)}</span>
        <div>
          <b>${escapeHTML(deadline.label)}</b>
          <small>${escapeHTML(deadline.detail)}</small>
        </div>
      </div>
    </div>

    <div class="opportunity-trust-row">
      <div class="opportunity-trust ${trust.tone}">
        <span class="opportunity-trust-icon">${icon('check',15)}</span>
        <div><b>${escapeHTML(trust.label)}</b><small>${escapeHTML(trust.detail)}</small></div>
      </div>
      ${source ? `<a class="opportunity-source-link" href="${source}" target="_blank" rel="noopener noreferrer" aria-label="Open official source for ${escapeHTML(item.title)}">Official source ↗</a>` : ''}
    </div>

    <div class="opportunity-card-actions">
      <button class="opportunity-save-button ${saved ? 'saved' : ''}" type="button" data-opportunity-save="${escapeHTML(item.id)}" data-opportunity-saved="${saved ? 'true' : 'false'}" aria-pressed="${saved}">
        ${icon('bookmark',16)} <span>${saved ? 'Saved' : 'Save'}</span>
      </button>
      <button class="btn btn-primary opportunity-view-button" type="button" data-route="opportunity/${encodeURIComponent(item.id)}">View opportunity</button>
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
    const rankedItems = rawItems
      .map(item => {
        const match = scoreOpportunityMatch(passport, item);
        return { item, match, profileMatch: opportunityMatchPresentation(match), journey: currentJourneyStates.get(item.id) || null };
      })
      .sort((a, b) => (b.profileMatch.score - a.profileMatch.score) || (b.match.score - a.match.score));

    const fundedCount = rawItems.filter(item => /funded|scholarship/i.test(item.fundingType || '')).length;
    const closingCount = rawItems.filter(item => {
      const days = opportunityDeadlineDays(item);
      return days >= 0 && days <= 30;
    }).length;
    const savedCount = rankedItems.filter(row => row.journey?.saved).length;
    const starterCatalogue = rawItems.length > 0 && rawItems.every(item => item.catalogSource === 'starter');

    const countries = opportunityFilterOptions(rawItems.map(item => item.country));
    const levels = opportunityFilterOptions(rawItems.flatMap(item => item.studyLevels || []));
    const fundingTypes = opportunityFilterOptions(rawItems.map(item => item.fundingType));
    const types = opportunityFilterOptions(rawItems.map(item => item.opportunityType));

    const catalogueNotice = starterCatalogue
      ? `<section class="opportunity-starter-notice">
          <span class="opportunity-starter-icon">${icon('check',18)}</span>
          <div>
            <b>Official-source starter catalogue</b>
            <p>Tefsen’s Firestore catalogue does not have published records yet, so these source-checked starter opportunities are shown instead. Always re-check the official provider page before applying.</p>
          </div>
          ${adminCapability ? '<button class="btn btn-secondary" type="button" data-route="admin">Publish live catalogue</button>' : ''}
        </section>`
      : '';

    const content = `${demoBanner()}
      <section class="opportunity-hero">
        <div class="opportunity-hero-card">
          <span class="opportunity-kicker">YOUR PATH TO OPPORTUNITY</span>
          <h1>Find the next step in your education journey.</h1>
          <p>Search scholarships, research programmes, exchanges and other student opportunities. Tefsen keeps official-source verification separate from community information.</p>
        </div>
        <div class="opportunity-stat-card">
          <span>${starterCatalogue ? 'Starter catalogue' : 'Available now'}</span>
          <strong>${rawItems.length}</strong>
          <span>${starterCatalogue ? 'official-source opportunities to explore' : `${fundedCount} funded opportunities in this catalogue`}</span>
        </div>
      </section>

      ${catalogueNotice}

      <section class="opportunity-discovery-panel" aria-label="Opportunity discovery controls">
        <div class="opportunity-quick-views" role="group" aria-label="Opportunity views">
          <button type="button" data-opportunity-view="all" aria-pressed="true">All <span>${rawItems.length}</span></button>
          <button type="button" data-opportunity-view="closing" aria-pressed="false">Closing soon <span>${closingCount}</span></button>
          <button type="button" data-opportunity-view="saved" aria-pressed="false">Saved <span>${savedCount}</span></button>
        </div>

        <div class="opportunity-filter-row">
          <label class="opportunity-search-box">
            <span class="sr-only">Search opportunities</span>
            ${icon('search',18)}
            <input type="search" data-opportunity-search value="${escapeHTML(opportunityDiscoveryFilters.query)}" placeholder="Search scholarship, provider, country or subject…" autocomplete="off">
          </label>

          <label><span>Country</span><select data-opportunity-filter="country">${opportunityOptionMarkup(countries, opportunityDiscoveryFilters.country, 'All countries')}</select></label>
          <label><span>Study level</span><select data-opportunity-filter="level">${opportunityOptionMarkup(levels, opportunityDiscoveryFilters.level, 'All levels')}</select></label>
          <label><span>Funding</span><select data-opportunity-filter="funding">${opportunityOptionMarkup(fundingTypes, opportunityDiscoveryFilters.funding, 'All funding')}</select></label>
          <label><span>Type</span><select data-opportunity-filter="type">${opportunityOptionMarkup(types, opportunityDiscoveryFilters.type, 'All types')}</select></label>
          <label><span>Sort</span><select data-opportunity-filter="sort">
            <option value="match" ${opportunityDiscoveryFilters.sort === 'match' ? 'selected' : ''}>Best match</option>
            <option value="deadline" ${opportunityDiscoveryFilters.sort === 'deadline' ? 'selected' : ''}>Deadline soonest</option>
            <option value="title" ${opportunityDiscoveryFilters.sort === 'title' ? 'selected' : ''}>A–Z</option>
          </select></label>
        </div>

        <div class="opportunity-filter-summary">
          <div><strong data-opportunity-results-count>${rankedItems.length} opportunities</strong><span>Use filters to narrow the catalogue without changing your Student Passport.</span></div>
          <button class="btn btn-ghost" type="button" data-opportunity-clear-all>Clear filters</button>
        </div>
        <div class="opportunity-active-filters" data-opportunity-active-filters hidden></div>
      </section>

      <div class="passport-private-note opportunity-passport-note">
        <span>${icon('user',18)}</span>
        <div><b>${completeness ? `Personalized using your Student Passport · ${completeness}% complete` : 'Complete your Student Passport for personalized matching'}</b><br><span>${completeness ? 'Best Match uses structured profile fields and is not an admission guarantee.' : 'Add study level, field, nationality and funding preference to improve ranking.'}</span></div>
        <button class="btn btn-ghost" type="button" data-route="passport">Open Passport</button>
      </div>

      <header class="page-head opportunity-results-head">
        <div><h2 style="margin:0">Discover opportunities</h2><p>Review funding, requirements, deadline and source status before deciding what to pursue.</p></div>
      </header>

      <div class="opportunity-grid" data-opportunity-grid>
        ${rankedItems.map(({item,match,journey}) => opportunityCard(item, match, journey)).join('')}
        <section class="opportunity-empty-state" data-opportunity-filter-empty hidden>
          <div class="empty-icon">${icon('search',24)}</div>
          <h3>No opportunities match these filters.</h3>
          <p>Try removing a filter or searching with a broader subject, country or provider name.</p>
          <div class="opportunity-empty-actions"><button class="btn btn-primary" type="button" data-opportunity-clear-all>Clear filters</button><button class="btn btn-secondary" type="button" data-route="passport">Update Student Passport</button></div>
        </section>
      </div>`;

    renderShell(content, { wide:true });
    requestAnimationFrame(() => applyOpportunityDiscoveryFilters());
  } catch (error) {
    console.error(error);
    renderShell(`${demoBanner()}<header class="page-head"><div><h1>Opportunities</h1><p>We could not load the opportunity catalogue.</p></div></header>${emptyState('info','Opportunities unavailable','Please try again after the opportunity collection and Firestore access are configured.')}`, { wide:true });
  }
}


function passportSelectOptions(values, current = '', placeholder = 'Choose one') {
  return `<option value="">${escapeHTML(placeholder)}</option>${values.map(value => `<option value="${escapeHTML(value)}" ${String(value) === String(current) ? 'selected' : ''}>${escapeHTML(value)}</option>`).join('')}`;
}

function checked(value) { return value ? 'checked' : ''; }

function passportOnboardingLevels() {
  return ['Secondary school','Diploma','Undergraduate','Master','Doctorate','Other'];
}

function passportOnboardingFunding() {
  return ['Fully funded only','Fully or partially funded','Any funding','Undecided'];
}

function renderPassportOnboarding(passport) {
  const levels = passportOnboardingLevels();
  const funding = passportOnboardingFunding();
  const progress = studentPassportOnboardingProgress(passport);

  const content = `${demoBanner()}
    <div class="passport-onboarding-page">
      <section class="passport-onboarding-shell">
        <aside class="passport-onboarding-aside">
          <a class="passport-onboarding-brand" href="../" aria-label="Tefsen home"><img src="assets/tefsen-logo.png" alt=""><span>Tefsen</span></a>
          <div>
            <span class="opportunity-kicker">PRIVATE STUDENT PASSPORT</span>
            <h1>Tell Tefsen what you are working toward.</h1>
            <p>These details help Tefsen compare opportunities with your education path. Your Student Passport is private by default.</p>
          </div>
          <div class="passport-onboarding-promise">
            <div>${icon('check',16)}<span>No default country. You choose your real profile.</span></div>
            <div>${icon('check',16)}<span>No sensitive document uploads in this onboarding.</span></div>
            <div>${icon('check',16)}<span>You can edit everything later.</span></div>
          </div>
        </aside>

        <form class="passport-onboarding-card" data-passport-onboarding-form data-current-step="0">
          <div class="passport-onboarding-progress">
            <span data-passport-onboarding-progress-label>Welcome</span>
            <div><i data-passport-onboarding-progress-bar style="width:20%"></i></div>
            <small>${progress.completed}/${progress.total} essential fields already complete</small>
          </div>

          <section class="passport-onboarding-step active" data-passport-onboarding-pane="0">
            <span class="passport-onboarding-step-kicker">WELCOME TO YOUR STUDENT PASSPORT</span>
            <h2>Better matches start with a small amount of context.</h2>
            <p>You do not need to complete your entire academic history now. Start with six essential fields, then Tefsen can rank opportunities more meaningfully.</p>
            <div class="passport-onboarding-preview-grid">
              <article><span>01</span><div><b>About you</b><small>Country, nationality and current study level.</small></div></article>
              <article><span>02</span><div><b>Your target</b><small>Study level and field you want to pursue.</small></div></article>
              <article><span>03</span><div><b>Funding</b><small>Tell Tefsen how important funding is to your search.</small></div></article>
            </div>
          </section>

          <section class="passport-onboarding-step" data-passport-onboarding-pane="1" hidden>
            <span class="passport-onboarding-step-kicker">STEP 1 OF 3 · ABOUT YOU</span>
            <h2>Where are you studying from?</h2>
            <p>Country and nationality can affect scholarship eligibility. Tefsen never assumes either one.</p>
            <div class="passport-onboarding-fields">
              <div class="field"><label>Current country <span>Required</span></label><input class="input" name="currentCountry" value="${escapeHTML(passport.currentCountry)}" maxlength="120" placeholder="Enter your current country" autocomplete="country-name" required></div>
              <div class="field"><label>Nationality <span>Required</span></label><input class="input" name="nationality" value="${escapeHTML(passport.nationality)}" maxlength="120" placeholder="Enter your nationality" required></div>
              <div class="field"><label>Current education level <span>Required</span></label><select class="select" name="currentEducationLevel" required>${passportSelectOptions(levels, passport.currentEducationLevel)}</select></div>
            </div>
          </section>

          <section class="passport-onboarding-step" data-passport-onboarding-pane="2" hidden>
            <span class="passport-onboarding-step-kicker">STEP 2 OF 3 · YOUR TARGET</span>
            <h2>What are you trying to study next?</h2>
            <p>This gives Tefsen the strongest signals for opportunity ranking.</p>
            <div class="passport-onboarding-fields">
              <div class="field"><label>Target education level <span>Required</span></label><select class="select" name="targetEducationLevel" required>${passportSelectOptions(levels, passport.targetEducationLevel)}</select></div>
              <div class="field"><label>Main field / subject <span>Required</span></label><input class="input" name="mainField" value="${escapeHTML(passport.mainField)}" maxlength="120" placeholder="e.g. Computer Science, Economics, Biology" required></div>
              <div class="field passport-field-wide"><label>Study / career goal <small>Optional</small></label><textarea class="textarea" name="studyGoal" maxlength="300" placeholder="What kind of opportunity or future are you working toward?">${escapeHTML(passport.studyGoal)}</textarea></div>
            </div>
          </section>

          <section class="passport-onboarding-step" data-passport-onboarding-pane="3" hidden>
            <span class="passport-onboarding-step-kicker">STEP 3 OF 3 · FUNDING & DESTINATIONS</span>
            <h2>What kind of opportunity fits your plan?</h2>
            <p>Funding preference improves ranking. Preferred countries are optional and can include any destinations you are considering.</p>
            <div class="passport-onboarding-fields">
              <div class="field"><label>Funding preference <span>Required</span></label><select class="select" name="fundingPreference" required>${passportSelectOptions(funding, passport.fundingPreference)}</select></div>
              <div class="field passport-field-wide"><label>Preferred study countries <small>Optional</small></label><input class="input" name="preferredCountries" value="${escapeHTML((passport.preferredCountries || []).join(', '))}" maxlength="500" placeholder="e.g. Germany, Japan, Canada"></div>
            </div>
            <div class="passport-onboarding-privacy">${icon('info',17)}<span>This information stays in your private Student Passport. Tefsen does not publish it to your community profile.</span></div>
          </section>

          <div class="passport-onboarding-error" data-passport-onboarding-error></div>
          <footer class="passport-onboarding-actions">
            <button class="btn btn-ghost" type="button" data-passport-onboarding-skip>Skip for now</button>
            <div>
              <button class="btn btn-secondary" type="button" data-passport-onboarding-back hidden>Back</button>
              <button class="btn btn-primary" type="button" data-passport-onboarding-next>Start</button>
              <button class="btn btn-primary" type="submit" data-passport-onboarding-submit hidden>Create my Student Passport</button>
            </div>
          </footer>
        </form>
      </section>
    </div>`;

  renderShell(content, { wide:true, right:false });
}

function renderPassportOnboardingComplete(passport) {
  const completeness = studentPassportCompleteness(passport);
  const progress = studentPassportOnboardingProgress(passport);
  const content = `${demoBanner()}
    <div class="passport-ready-page">
      <section class="passport-ready-card">
        <div class="passport-ready-mark">${icon('check',30)}</div>
        <span class="opportunity-kicker">YOUR TEFSEN JOURNEY IS READY</span>
        <h1>Start discovering opportunities built around your path.</h1>
        <p>Your essential Student Passport is ready. Tefsen can now use your nationality, study direction and funding preference to improve ranking and explain structured eligibility.</p>
        <div class="passport-ready-stats">
          <div><strong>${progress.completed}/${progress.total}</strong><span>essential fields</span></div>
          <div><strong>${completeness}%</strong><span>full Passport complete</span></div>
          <div><strong>Private</strong><span>default visibility</span></div>
        </div>
        <div class="passport-ready-next">
          <article><span>1</span><div><b>Explore opportunities</b><small>See matches from the global catalogue.</small></div></article>
          <article><span>2</span><div><b>Open a detail page</b><small>Compare structured eligibility with your Passport.</small></div></article>
          <article><span>3</span><div><b>Save and start Journey</b><small>Keep preparation, tasks and progress private.</small></div></article>
        </div>
        <div class="passport-ready-actions">
          <button class="btn btn-primary" type="button" data-route="opportunities">Explore opportunities</button>
          <button class="btn btn-secondary" type="button" data-passport-onboarding-finish>Continue editing Passport</button>
        </div>
      </section>
    </div>`;
  renderShell(content, { wide:true, right:false });
}

function setPassportOnboardingStep(form, nextStep) {
  const step = Math.max(0, Math.min(3, Number(nextStep) || 0));
  form.dataset.currentStep = String(step);
  form.querySelectorAll('[data-passport-onboarding-pane]').forEach(pane => {
    const active = Number(pane.dataset.passportOnboardingPane) === step;
    pane.hidden = !active;
    pane.classList.toggle('active', active);
  });

  const labels = ['Welcome','About you','Your target','Funding & destinations'];
  const widths = [20,45,70,100];
  const label = form.querySelector('[data-passport-onboarding-progress-label]');
  const bar = form.querySelector('[data-passport-onboarding-progress-bar]');
  if (label) label.textContent = labels[step] || labels[0];
  if (bar) bar.style.width = `${widths[step] || 20}%`;

  const back = form.querySelector('[data-passport-onboarding-back]');
  const next = form.querySelector('[data-passport-onboarding-next]');
  const submit = form.querySelector('[data-passport-onboarding-submit]');
  if (back) back.hidden = step === 0;
  if (next) {
    next.hidden = step === 3;
    next.textContent = step === 0 ? 'Start' : 'Continue';
  }
  if (submit) submit.hidden = step !== 3;
  form.querySelector('[data-passport-onboarding-error]')?.replaceChildren();
  form.querySelector('[data-passport-onboarding-pane]:not([hidden]) input, [data-passport-onboarding-pane]:not([hidden]) select, [data-passport-onboarding-pane]:not([hidden]) textarea')?.focus();
}

function validatePassportOnboardingStep(form, step) {
  const pane = form.querySelector(`[data-passport-onboarding-pane="${step}"]`);
  if (!pane || step === 0) return true;
  const required = [...pane.querySelectorAll('[required]')];
  for (const field of required) {
    if (!String(field.value || '').trim()) {
      field.focus();
      const label = field.closest('.field')?.querySelector('label')?.textContent?.replace('Required','').trim() || 'This field';
      const error = form.querySelector('[data-passport-onboarding-error]');
      if (error) error.textContent = `${label} is required to continue.`;
      return false;
    }
  }
  return true;
}

function studentPassportDraftFromForm(form) {
  const fd = new FormData(form);
  const csv = name => String(fd.get(name) || '').split(',').map(item => item.trim()).filter(Boolean);
  return {
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
    onboardingStatus: currentStudentPassport?.onboardingStatus === 'skipped' ? 'skipped' : 'completed',
    documentsReady: {
      passport: fd.get('docPassport') === 'on',
      transcript: fd.get('docTranscript') === 'on',
      englishCertificate: fd.get('docEnglish') === 'on',
      recommendationLetter: fd.get('docRecommendation') === 'on',
      cv: fd.get('docCv') === 'on',
      personalStatement: fd.get('docStatement') === 'on'
    }
  };
}

function passportSectionGuideMarkup(details) {
  const labels = {
    essential:'Essentials',
    academic:'Academic profile',
    preferences:'Preferences',
    documents:'Document readiness'
  };
  return Object.entries(details.sections).map(([key,section]) => `
    <button class="passport-quality-section" type="button" data-passport-jump="passport-${key}">
      <div><b>${labels[key]}</b><span>${section.complete}/${section.total}</span></div>
      <div class="passport-quality-bar"><i style="width:${section.percent}%"></i></div>
    </button>`).join('');
}

function passportNextMarkup(details) {
  if (!details.next.length) {
    return `<div class="passport-quality-done">${icon('check',16)}<span>Your main Passport profile fields are filled. Keep document readiness current as you prepare applications.</span></div>`;
  }
  return details.next.map(item => `<button type="button" data-passport-jump="passport-${item.section}" class="passport-next-item ${item.priority}">
    <span>${item.priority === 'essential' ? 'Essential' : 'Recommended'}</span>
    <b>${escapeHTML(item.label)}</b>
  </button>`).join('');
}

function updateStudentPassportFormQuality(form, { dirty = true } = {}) {
  const draft = studentPassportDraftFromForm(form);
  const details = studentPassportCompletionDetails(draft);
  const validation = validateStudentPassportInput(draft);

  const score = document.querySelector('[data-passport-quality-score]');
  if (score) score.textContent = `${details.percent}%`;
  const guide = document.querySelector('[data-passport-quality-sections]');
  if (guide) guide.innerHTML = passportSectionGuideMarkup(details);
  const next = document.querySelector('[data-passport-quality-next]');
  if (next) next.innerHTML = passportNextMarkup(details);

  form.querySelectorAll('[data-passport-field-error]').forEach(el => {
    el.textContent = '';
    el.hidden = true;
  });
  form.querySelectorAll('.field-error-state').forEach(el => el.classList.remove('field-error-state'));

  for (const error of validation.errors) {
    const field = form.elements.namedItem(error.field);
    const fieldEl = field instanceof RadioNodeList ? field[0] : field;
    if (fieldEl instanceof HTMLElement) {
      fieldEl.classList.add('field-error-state');
      const wrap = fieldEl.closest('.field');
      const errorEl = wrap?.querySelector('[data-passport-field-error]');
      if (errorEl) {
        errorEl.textContent = error.message;
        errorEl.hidden = false;
      }
    }
  }

  const summary = form.querySelector('[data-passport-validation-summary]');
  if (summary) {
    const messages = [
      ...validation.errors.map(item => item.message),
      ...validation.warnings.map(item => item.message)
    ];
    summary.hidden = messages.length === 0;
    summary.classList.toggle('has-error', validation.errors.length > 0);
    summary.innerHTML = messages.length
      ? `${icon(validation.errors.length ? 'info' : 'check',16)}<div><b>${validation.errors.length ? 'Check before saving' : 'Passport can be saved now'}</b><p>${escapeHTML(messages.join(' '))}</p></div>`
      : '';
  }

  const gpa = form.elements.namedItem('gpa');
  const scale = Number(form.elements.namedItem('gpaScale')?.value || 4);
  if (gpa instanceof HTMLInputElement) gpa.max = String(scale);

  const saveState = document.querySelector('[data-passport-save-state]');
  if (saveState && dirty) {
    saveState.textContent = 'Unsaved changes';
    saveState.classList.add('dirty');
  }
  return { draft, details, validation };
}

async function renderStudentPassport() {
  renderShell(`<header class="page-head"><div><h1>Student Passport</h1><p>Preparing your private opportunity profile…</p></div></header><div class="loading-card"></div>`, { wide:true });
  try {
    const passport = await getStudentPassport(state.mode, state.user.uid);
    currentStudentPassport = passport;

    if (passportOnboardingJustCompleted) {
      renderPassportOnboardingComplete(passport);
      return;
    }
    if (shouldShowPassportOnboarding(passport)) {
      renderPassportOnboarding(passport);
      return;
    }

    const completeness = studentPassportCompleteness(passport);
    const details = studentPassportCompletionDetails(passport);
    const levels = ['Secondary school','Diploma','Undergraduate','Master','Doctorate','Other'];
    const funding = ['Fully funded only','Fully or partially funded','Any funding','Undecided'];
    const english = ['Not started','Planning a test','Test booked','Test completed','Waiver / other evidence','Not sure'];
    const docs = passport.documentsReady || {};

    const content = `${demoBanner()}
      <div class="passport-page passport-quality-page">
        <section class="passport-hero passport-quality-hero">
          <div>
            <span class="opportunity-kicker">PRIVATE OPPORTUNITY PROFILE</span>
            <h1>Keep your Student Passport useful.</h1>
            <p>Tefsen uses structured profile data to improve opportunity ranking and explain eligibility comparisons. Completion improves context; it does not guarantee eligibility or selection.</p>
          </div>
          <div class="passport-progress">
            <div><strong data-passport-quality-score>${completeness}%</strong><br><span>Passport complete</span></div>
            <small data-passport-save-state>Saved</small>
          </div>
        </section>

        <div class="passport-private-note">
          <span>${icon('info',18)}</span>
          <div><b>Private by default.</b><br>Your nationality, GPA, preparation status and goals stay separate from your public community profile. Tefsen never assumes a country or nationality for you.</div>
        </div>

        <div class="passport-quality-layout">
          <form class="passport-quality-form" data-student-passport-form novalidate>
            <div class="passport-validation-summary" data-passport-validation-summary hidden></div>

            <section class="passport-edit-section" id="passport-essential">
              <header>
                <div><span>01 · ESSENTIAL</span><h2>Your education direction</h2><p>These fields have the strongest impact on basic opportunity matching.</p></div>
                <span class="passport-section-badge essential">Important</span>
              </header>
              <div class="passport-form-grid">
                <div class="field"><label>Current country <em>Essential</em></label><input class="input" name="currentCountry" value="${escapeHTML(passport.currentCountry)}" maxlength="120" placeholder="Enter your current country" autocomplete="country-name"><small>Where you currently live or study. This is not inferred from your device.</small><span class="field-error" data-passport-field-error hidden></span></div>
                <div class="field"><label>Nationality <em>Essential</em></label><input class="input" name="nationality" value="${escapeHTML(passport.nationality)}" maxlength="120" placeholder="Enter your nationality"><small>Used only when an opportunity has nationality rules.</small><span class="field-error" data-passport-field-error hidden></span></div>
                <div class="field"><label>Current education level <em>Essential</em></label><select class="select" name="currentEducationLevel">${passportSelectOptions(levels, passport.currentEducationLevel)}</select><small>Your current stage of study.</small><span class="field-error" data-passport-field-error hidden></span></div>
                <div class="field"><label>Target education level <em>Essential</em></label><select class="select" name="targetEducationLevel">${passportSelectOptions(levels, passport.targetEducationLevel)}</select><small>The level you want to pursue next.</small><span class="field-error" data-passport-field-error hidden></span></div>
                <div class="field"><label>Main field / subject <em>Essential</em></label><input class="input" name="mainField" value="${escapeHTML(passport.mainField)}" maxlength="120" placeholder="e.g. Computer Science"><small>Use the subject name you would search for in opportunities.</small><span class="field-error" data-passport-field-error hidden></span></div>
                <div class="field"><label>Funding preference <em>Essential</em></label><select class="select" name="fundingPreference">${passportSelectOptions(funding, passport.fundingPreference)}</select><small>Helps rank funding options, but does not hide other opportunities.</small><span class="field-error" data-passport-field-error hidden></span></div>
              </div>
            </section>

            <section class="passport-edit-section" id="passport-academic">
              <header>
                <div><span>02 · ACADEMIC PROFILE</span><h2>Add context for requirement comparisons</h2><p>These fields help when an opportunity stores academic or language requirements.</p></div>
                <span class="passport-section-badge">Recommended</span>
              </header>
              <div class="passport-form-grid">
                <div class="field passport-field-wide"><label>Current institution <small>Optional</small></label><input class="input" name="institution" value="${escapeHTML(passport.institution)}" maxlength="160" placeholder="University, school or institution"><small>Your institution is private Passport data.</small><span class="field-error" data-passport-field-error hidden></span></div>
                <div class="field"><label>GPA <small>Optional</small></label><input class="input" name="gpa" type="number" min="0" max="${Number(passport.gpaScale) === 5 ? 5 : 4}" step="0.01" value="${passport.gpa ?? ''}" placeholder="e.g. 3.67"><small>Leave blank if your system does not use a comparable GPA.</small><span class="field-error" data-passport-field-error hidden></span></div>
                <div class="field"><label>GPA scale</label><select class="select" name="gpaScale"><option value="4" ${Number(passport.gpaScale) === 4 ? 'selected' : ''}>4.0 scale</option><option value="5" ${Number(passport.gpaScale) === 5 ? 'selected' : ''}>5.0 scale</option></select><small>Tefsen does not automatically convert between grading scales.</small><span class="field-error" data-passport-field-error hidden></span></div>
                <div class="field passport-field-wide"><label>English-test status <small>Recommended</small></label><select class="select" name="englishTestStatus">${passportSelectOptions(english, passport.englishTestStatus)}</select><small>This is preparation context, not proof that you meet a provider's exact score.</small><span class="field-error" data-passport-field-error hidden></span></div>
              </div>
            </section>

            <section class="passport-edit-section" id="passport-preferences">
              <header>
                <div><span>03 · PREFERENCES</span><h2>Shape what Tefsen prioritizes</h2><p>These preferences improve ranking without locking you into one country or path.</p></div>
                <span class="passport-section-badge">Recommended</span>
              </header>
              <div class="passport-form-grid">
                <div class="field passport-field-wide"><label>Preferred study countries <small>Optional</small></label><input class="input" name="preferredCountries" value="${escapeHTML((passport.preferredCountries || []).join(', '))}" maxlength="500" placeholder="e.g. Germany, Japan, Canada"><small>Comma-separated, up to 12. Leave blank if you are open globally.</small><span class="field-error" data-passport-field-error hidden></span></div>
                <div class="field passport-field-wide"><label>Languages <small>Optional</small></label><input class="input" name="languages" value="${escapeHTML((passport.languages || []).join(', '))}" maxlength="500" placeholder="e.g. English, Spanish, Arabic"><small>Languages you can study, communicate or work in.</small><span class="field-error" data-passport-field-error hidden></span></div>
                <div class="field passport-field-wide"><label>Skills <small>Optional</small></label><input class="input" name="skills" value="${escapeHTML((passport.skills || []).join(', '))}" maxlength="600" placeholder="e.g. Python, research, graphic design"><small>Use specific skills rather than broad labels.</small><span class="field-error" data-passport-field-error hidden></span></div>
                <div class="field passport-field-wide"><label>Study / career goal <small>Recommended</small></label><textarea class="textarea" name="studyGoal" maxlength="300" placeholder="What opportunity, degree or future direction are you working toward?">${escapeHTML(passport.studyGoal)}</textarea><small>This helps future next-action guidance. It is not shared publicly.</small><span class="field-error" data-passport-field-error hidden></span></div>
              </div>
            </section>

            <section class="passport-edit-section" id="passport-documents">
              <header>
                <div><span>04 · PREPARATION</span><h2>Document readiness</h2><p>Track readiness only. Do not upload sensitive documents here.</p></div>
                <span class="passport-section-badge private">Private status</span>
              </header>
              <div class="passport-doc-grid">
                <label class="passport-doc"><input type="checkbox" name="docPassport" ${checked(docs.passport)}><span><b>Passport</b><small>Ready for applications</small></span></label>
                <label class="passport-doc"><input type="checkbox" name="docTranscript" ${checked(docs.transcript)}><span><b>Academic transcript</b><small>Ready for applications</small></span></label>
                <label class="passport-doc"><input type="checkbox" name="docEnglish" ${checked(docs.englishCertificate)}><span><b>English certificate</b><small>Ready if required</small></span></label>
                <label class="passport-doc"><input type="checkbox" name="docRecommendation" ${checked(docs.recommendationLetter)}><span><b>Recommendation letter</b><small>At least one ready</small></span></label>
                <label class="passport-doc"><input type="checkbox" name="docCv" ${checked(docs.cv)}><span><b>CV / resume</b><small>Current version ready</small></span></label>
                <label class="passport-doc"><input type="checkbox" name="docStatement" ${checked(docs.personalStatement)}><span><b>Personal statement</b><small>Draft or final version ready</small></span></label>
              </div>
            </section>

            <footer class="passport-form-actions">
              <span>Saving updates your private Passport only.</span>
              <div><button class="btn btn-secondary" type="button" data-route="opportunities">View opportunities</button><button class="btn btn-primary" type="submit">Save Student Passport</button></div>
            </footer>
          </form>

          <aside class="passport-quality-aside">
            <section class="passport-quality-card">
              <span class="passport-quality-kicker">COMPLETION GUIDE</span>
              <div class="passport-quality-score"><strong data-passport-quality-score>${details.percent}%</strong><span>Passport complete</span></div>
              <p>This measures profile completeness, not eligibility or acceptance probability.</p>
              <div data-passport-quality-sections>${passportSectionGuideMarkup(details)}</div>
            </section>

            <section class="passport-quality-card">
              <span class="passport-quality-kicker">IMPROVE NEXT</span>
              <div class="passport-next-list" data-passport-quality-next>${passportNextMarkup(details)}</div>
            </section>

            <section class="passport-quality-card passport-quality-trust">
              <span class="passport-quality-kicker">HOW TEFSEN USES THIS</span>
              <ul>
                <li>Rank opportunities using structured profile signals.</li>
                <li>Explain which stored eligibility criteria match or need review.</li>
                <li>Keep Passport data private from your public profile by default.</li>
                <li>Never treat completion as a guarantee of admission or funding.</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>`;

    renderShell(content, { wide:true });
    const form = document.querySelector('[data-student-passport-form]');
    if (form) updateStudentPassportFormQuality(form, { dirty:false });
  } catch (error) {
    console.error(error);
    renderShell(`${demoBanner()}${emptyState('info','Student Passport unavailable','Secure Student Passport access is not configured yet. Review Firestore rules before production use.')}`, { wide:true });
  }
}

function eligibilityCheckMarkup(result, sourceUrl = '') {
  const source = safeUrl(sourceUrl || '');
  const marks = { met:'✓', action:'!', not_met:'×', unknown:'?' };
  const labels = {
    met:'Meets',
    action:'Action needed',
    not_met:'Structured mismatch',
    unknown:'Unknown'
  };
  const order = { not_met:0, action:1, unknown:2, met:3 };
  const checks = [...(result.checks || [])].sort((a,b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

  const actions = (result.nextActions || []).map(action => {
    if (action.type === 'passport') {
      return `<article class="eligibility-next-action passport">
        <span class="eligibility-next-icon">${icon('user',17)}</span>
        <div><b>${escapeHTML(action.label)}</b><p>${escapeHTML(action.detail)}</p></div>
        <button class="btn btn-secondary" type="button" data-route="passport">Open Passport</button>
      </article>`;
    }

    if (action.type === 'official_source') {
      return `<article class="eligibility-next-action source">
        <span class="eligibility-next-icon">${icon('check',17)}</span>
        <div><b>${escapeHTML(action.label)}</b><p>${escapeHTML(action.detail)}</p></div>
        ${source
          ? `<a class="btn btn-secondary" href="${source}" target="_blank" rel="noopener noreferrer">Official source ↗</a>`
          : '<span class="eligibility-action-unavailable">Source URL unavailable</span>'}
      </article>`;
    }

    return '';
  }).join('');

  return `<div class="eligibility-experience">
    <section class="eligibility-outcome ${escapeHTML(result.outcome?.tone || 'unknown')}">
      <div class="eligibility-outcome-icon">
        ${result.outcome?.tone === 'met' ? icon('check',22) : result.outcome?.tone === 'mismatch' ? '×' : result.outcome?.tone === 'action' ? '!' : '?'}
      </div>
      <div>
        <span>TEFSEN STRUCTURED COMPARISON</span>
        <h3>${escapeHTML(result.outcome?.title || result.summary || 'Eligibility comparison')}</h3>
        <p>${escapeHTML(result.outcome?.description || '')}</p>
      </div>
    </section>

    <div class="eligibility-status-strip" aria-label="Eligibility comparison status counts">
      <div class="met"><strong>${Number(result.counts?.met || 0)}</strong><span>Meets</span></div>
      <div class="action"><strong>${Number(result.counts?.action || 0)}</strong><span>Action needed</span></div>
      <div class="not-met"><strong>${Number(result.counts?.not_met || 0)}</strong><span>Mismatch</span></div>
      <div class="unknown"><strong>${Number(result.counts?.unknown || 0)}</strong><span>Unknown</span></div>
    </div>

    ${actions ? `<section class="eligibility-next-actions">
      <div class="eligibility-subhead"><h3>What to do next</h3><p>Actions are based on missing profile data, stored mismatches and requirements Tefsen cannot safely decide.</p></div>
      <div class="eligibility-next-action-list">${actions}</div>
    </section>` : ''}

    <section class="eligibility-criteria">
      <div class="eligibility-subhead"><h3>Requirement-by-requirement explanation</h3><p>A stored mismatch is not the same as a final rejection. Provider rules can change, so verify important decisions at the source.</p></div>
      <div class="eligibility-checks">
        ${checks.map(item => `<article class="eligibility-check ${item.status}">
          <span class="eligibility-mark">${marks[item.status] || '?'}</span>
          <div class="eligibility-check-copy">
            <div class="eligibility-check-title">
              <div><b>${escapeHTML(item.label)}</b><span class="eligibility-status-label">${escapeHTML(labels[item.status] || item.status)}</span></div>
              <span class="eligibility-category">${item.category === 'preparation' ? 'Preparation' : 'Eligibility'}</span>
            </div>
            <p>${escapeHTML(item.message)}</p>
            ${item.basis ? `<details class="eligibility-basis"><summary>Why Tefsen says this</summary><p>${escapeHTML(item.basis)}</p></details>` : ''}
            ${item.requiresOfficialSource
              ? `<div class="eligibility-source-needed">${icon('info',14)}<span>Confirm this criterion on the official provider source.</span>${source ? `<a href="${source}" target="_blank" rel="noopener noreferrer">Open source ↗</a>` : ''}</div>`
              : ''}
          </div>
        </article>`).join('')}
      </div>
    </section>

    <div class="eligibility-disclaimer">
      ${icon('info',16)}
      <p>${escapeHTML(result.disclaimer)}</p>
    </div>
  </div>`;
}

function opportunityAudienceLabel(item = {}) {
  const nationalities = (item.eligibleNationalities || []).filter(Boolean);
  if (!nationalities.length) {
    return {
      label:'Nationality rules not structured',
      detail:'Check the official source for country or nationality eligibility.'
    };
  }

  if (nationalities.some(value => /international|all nationalit|any nationalit/i.test(String(value)))) {
    return {
      label:'International applicants',
      detail:'The stored eligibility indicates broad international access. Confirm programme-specific rules.'
    };
  }

  const first = nationalities.slice(0,3).join(', ');
  return {
    label:nationalities.length === 1 ? first : `${nationalities.length} nationality rules stored`,
    detail:nationalities.length <= 3 ? first : `${first} +${nationalities.length - 3} more`
  };
}

function opportunityDetailList(values = [], fallback = 'No structured information is stored yet.') {
  const cleanValues = (values || []).filter(Boolean);
  return cleanValues.length
    ? `<ul class="opportunity-detail-list">${cleanValues.map(value => `<li><span class="opportunity-detail-list-mark">${icon('check',14)}</span><span>${escapeHTML(value)}</span></li>`).join('')}</ul>`
    : `<div class="opportunity-detail-missing">${icon('info',16)}<span>${escapeHTML(fallback)}</span></div>`;
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
    const eligibility = evaluateEligibility(passport, item);
    const rawMatch = scoreOpportunityMatch(passport, item);
    const matchView = opportunityMatchPresentation(rawMatch);
    const deadline = opportunityDeadlinePresentation(item);
    const trust = opportunityTrustPresentation(item);
    const audience = opportunityAudienceLabel(item);
    const completeness = studentPassportCompleteness(passport);
    const saved = Boolean(journey?.saved);
    const started = Boolean(journey?.started);
    const studyLevels = (item.studyLevels || []).filter(Boolean);
    const subjects = (item.subjects || []).filter(Boolean);
    const sourceChecked = opportunitySourceCheckedLabel(item);

    const knownMatchRate = eligibility.compatibility === null ? '—' : `${eligibility.compatibility}%`;
    const coverage = `${Number(eligibility.coverage || 0)}%`;
    const comparedCriteria = Number(eligibility.comparedCriteria || 0);

    const content = `${demoBanner()}
      <div class="opportunity-detail-page">
        <div class="opportunity-detail-backrow">
          <button class="btn btn-ghost" type="button" data-route="opportunities">${icon('back',17)} Back to opportunities</button>
          <span>Official provider information remains authoritative.</span>
        </div>

        <section class="opportunity-detail-hero">
          <div class="opportunity-detail-hero-main">
            <div class="opportunity-detail-hero-topline">
              <span class="opportunity-type-mark">${icon('compass',15)} ${escapeHTML(item.opportunityType || 'Opportunity')}</span>
              ${started ? '<span class="opportunity-journey-state">In Journey</span>' : saved ? '<span class="opportunity-saved-state">Saved</span>' : ''}
            </div>
            <h1>${escapeHTML(item.title)}</h1>
            <p class="opportunity-detail-provider">${escapeHTML(item.provider || item.university || 'Opportunity provider')}${item.university && item.provider ? ` · ${escapeHTML(item.university)}` : ''}</p>
            <p class="opportunity-detail-summary">${escapeHTML(item.summary || 'Review the structured details and official provider source before deciding whether to apply.')}</p>

            <div class="opportunity-detail-primary-badges">
              <span class="opportunity-funding-badge">${escapeHTML(item.fundingType || 'Funding not specified')}</span>
              <span class="opportunity-location-badge">${escapeHTML(item.country || 'Multiple / global')}</span>
              <span class="opportunity-level-detail">${escapeHTML(studyLevels.join(' · ') || 'Study level varies')}</span>
            </div>
          </div>

          <div class="opportunity-detail-decision-panel">
            <div class="opportunity-detail-match ${matchView.personalized ? 'personalized' : 'incomplete'}">
              <span>YOUR PROFILE</span>
              <strong>${escapeHTML(matchView.label)}</strong>
              <p>${escapeHTML(matchView.detail)}</p>
            </div>
            <div class="opportunity-detail-deadline ${deadline.tone}">
              <span>DEADLINE</span>
              <strong>${escapeHTML(deadline.label)}</strong>
              <p>${escapeHTML(deadline.detail)}</p>
            </div>
          </div>
        </section>

        <section class="opportunity-detail-facts" aria-label="Opportunity key facts">
          <article><span>Destination</span><strong>${escapeHTML(item.country || 'Not specified')}</strong></article>
          <article><span>Funding</span><strong>${escapeHTML(item.fundingType || 'Not specified')}</strong></article>
          <article><span>Study level</span><strong>${escapeHTML(studyLevels.join(', ') || 'Varies')}</strong></article>
          <article><span>Intake</span><strong>${escapeHTML(item.intake || 'Check provider')}</strong></article>
          <article><span>Eligibility scope</span><strong>${escapeHTML(audience.label)}</strong><small>${escapeHTML(audience.detail)}</small></article>
        </section>

        <div class="opportunity-detail-v4-layout">
          <main class="opportunity-detail-main">
            <section class="opportunity-detail-section">
              <header><span>01</span><div><h2>Study areas</h2><p>Subjects or programme areas currently stored for this opportunity.</p></div></header>
              ${opportunityDetailList(subjects, 'Subject coverage is not structured yet. Review the official programme page.')}
            </section>

            <section class="opportunity-detail-section">
              <header><span>02</span><div><h2>Funding & benefits</h2><p>Use this as a summary only; the official funding package may include conditions or exceptions.</p></div></header>
              ${opportunityDetailList(item.benefits, 'Detailed benefits are not structured yet. Check the official source for the current funding package.')}
            </section>

            <section class="opportunity-detail-section">
              <header><span>03</span><div><h2>Who can apply</h2><p>Eligibility can vary by nationality, education level, programme and applicant circumstances.</p></div></header>
              <div class="opportunity-audience-card">
                <div><span>Nationality / country scope</span><strong>${escapeHTML(audience.label)}</strong><p>${escapeHTML(audience.detail)}</p></div>
                <div><span>Target study level</span><strong>${escapeHTML(studyLevels.join(', ') || 'Not structured')}</strong><p>Compare this with your Student Passport and the provider rules.</p></div>
              </div>
              ${opportunityDetailList(item.requirements, 'Structured eligibility requirements are incomplete. Use the official provider source before deciding whether you can apply.')}
            </section>

            <section class="opportunity-detail-section">
              <header><span>04</span><div><h2>Documents & language</h2><p>Preparation requirements vary by programme and applicant.</p></div></header>
              <div class="opportunity-detail-two-col">
                <div>
                  <h3>Required documents</h3>
                  ${opportunityDetailList(item.requiredDocuments, 'No structured document checklist is stored yet.')}
                </div>
                <div>
                  <h3>Language requirements</h3>
                  ${opportunityDetailList(item.languageRequirements, 'No structured language requirement is stored yet.')}
                </div>
              </div>
            </section>

            <section class="opportunity-detail-section opportunity-eligibility-section">
              <header><span>05</span><div><h2>Structured eligibility comparison</h2><p>Tefsen compares only requirements that are structured and available. It does not make an admission decision.</p></div></header>
              <div class="opportunity-eligibility-overview v2">
                <div><span>Comparison coverage</span><strong>${coverage}</strong><small>${comparedCriteria} of ${Number(eligibility.totalCriteria || 0)} criteria safely comparable</small></div>
                <div><span>Known-criteria match rate</span><strong>${knownMatchRate}</strong><small>Not a probability of acceptance</small></div>
                <div><span>Student Passport</span><strong>${completeness}%</strong><small>Profile completeness affects how much Tefsen can compare</small></div>
              </div>
              ${eligibilityCheckMarkup(eligibility, source)}
            </section>
          </main>

          <aside class="opportunity-detail-side">
            <section class="opportunity-side-card source ${trust.tone}">
              <div class="opportunity-side-card-head">
                <span class="opportunity-trust-icon">${icon('check',16)}</span>
                <div><span>SOURCE TRUST</span><strong>${escapeHTML(trust.label)}</strong></div>
              </div>
              <p>${escapeHTML(trust.detail)}</p>
              <dl>
                <div><dt>Provider</dt><dd>${escapeHTML(item.provider || item.university || 'Not specified')}</dd></div>
                <div><dt>Source check</dt><dd>${escapeHTML(sourceChecked)}</dd></div>
                <div><dt>Status</dt><dd>${escapeHTML(item.verificationStatus || 'unverified')}</dd></div>
              </dl>
              <div class="opportunity-source-warning">Tefsen helps you discover and organize information. The provider’s official page controls final eligibility, deadline, funding and application requirements.</div>
              ${source ? `<a class="btn btn-primary btn-block" href="${source}" target="_blank" rel="noopener noreferrer">Open official source ↗</a>` : '<div class="opportunity-detail-missing">No official source URL is available for this record.</div>'}
            </section>

            <section class="opportunity-side-card">
              <span class="opportunity-side-kicker">YOUR NEXT STEP</span>
              <h2>${started ? 'Continue your application journey' : saved ? 'Ready to start preparing?' : 'Keep this opportunity on your path'}</h2>
              <p>${started
                ? `Current stage: ${escapeHTML(JOURNEY_LABELS[journey.status] || journey.status)}. Your Journey is private by default.`
                : saved
                  ? 'This opportunity is saved. Start a private Journey when you want tasks, notes and progress tracking.'
                  : 'Save the opportunity first, or start a private Journey to track preparation and deadlines.'}</p>
              <div class="opportunity-detail-actions">
                <button class="opportunity-save-button ${saved ? 'saved' : ''}" type="button" data-opportunity-save="${escapeHTML(item.id)}" data-opportunity-saved="${saved ? 'true' : 'false'}" aria-pressed="${saved}">
                  ${icon('bookmark',16)} <span>${saved ? 'Saved' : 'Save opportunity'}</span>
                </button>
                <button class="btn btn-primary" type="button" data-start-journey="${escapeHTML(item.id)}">${started ? 'Open Journey' : 'Start Journey'}</button>
              </div>
            </section>

            <section class="opportunity-side-card global-note">
              <span class="opportunity-side-kicker">GLOBAL STUDENT PLATFORM</span>
              <h2>Eligibility follows your profile, not a default country.</h2>
              <p>Tefsen uses the nationality, study level, field and destination preferences you choose in Student Passport. Country-specific opportunities remain clearly scoped to their provider rules.</p>
              <button class="btn btn-secondary btn-block" type="button" data-route="passport">Review Student Passport</button>
            </section>
          </aside>
        </div>
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

function savedOpportunityCardMarkup(row) {
  const journey = row.journey || {};
  const item = row.opportunity || null;
  const opportunityId = String(journey.opportunityId || item?.id || '');
  const title = item?.title || 'Opportunity unavailable';
  const provider = item?.provider || item?.university || 'The original opportunity is not currently public.';
  const selected = savedOpportunityCompareIds.has(opportunityId);
  const expired = row.deadline?.state === 'expired';
  const source = safeUrl(item?.officialSourceUrl || '');

  const matchView = item
    ? opportunityMatchPresentation(scoreOpportunityMatch(currentStudentPassport || {}, item))
    : { personalized:false, score:0, label:'Match unavailable', detail:'The opportunity record is not currently public.' };
  const deadline = item
    ? opportunityDeadlinePresentation(item)
    : { tone:'unknown', label:'Deadline unavailable', detail:'The opportunity record is not currently public.' };
  const trust = item
    ? opportunityTrustPresentation(item)
    : { tone:'unverified', label:'Source unavailable', detail:'Review this saved item before taking action.' };

  return `<article class="saved-opportunity-card ${selected ? 'compare-selected' : ''} ${expired ? 'expired' : ''}" data-saved-card="${escapeHTML(opportunityId)}">
    <div class="saved-opportunity-top">
      <div class="saved-opportunity-type">
        <span>${icon('bookmark',15)} SAVED FOR REVIEW</span>
        ${expired ? '<b class="saved-expired-badge">Expired deadline</b>' : ''}
      </div>
      ${item ? `<button class="saved-compare-toggle ${selected ? 'active' : ''}" type="button" data-saved-compare="${escapeHTML(opportunityId)}" aria-pressed="${selected}" aria-label="${selected ? 'Remove from comparison' : 'Add to comparison'}">${icon('check',14)} <span>${selected ? 'Comparing' : 'Compare'}</span></button>` : ''}
    </div>

    <div class="saved-opportunity-heading">
      <h3>${escapeHTML(title)}</h3>
      <p>${escapeHTML(provider)}</p>
    </div>

    ${item ? `<div class="saved-opportunity-badges">
      <span class="opportunity-funding-badge">${escapeHTML(item.fundingType || 'Funding not specified')}</span>
      <span class="opportunity-location-badge">${escapeHTML(item.country || 'Multiple / global')}</span>
      <span class="saved-study-level">${escapeHTML((item.studyLevels || []).slice(0,2).join(' · ') || 'Study level varies')}</span>
    </div>` : ''}

    <div class="saved-decision-signals">
      <div class="saved-signal ${matchView.personalized ? 'match' : 'neutral'}">
        <span>${icon('user',15)}</span>
        <div><b>${escapeHTML(matchView.label)}</b><small>${escapeHTML(matchView.detail)}</small></div>
      </div>
      <div class="saved-signal deadline ${escapeHTML(deadline.tone)}">
        <span>${icon('info',15)}</span>
        <div><b>${escapeHTML(deadline.label)}</b><small>${escapeHTML(deadline.detail)}</small></div>
      </div>
    </div>

    <div class="saved-trust-row">
      <div class="saved-trust ${escapeHTML(trust.tone)}">
        <span>${icon('check',14)}</span>
        <div><b>${escapeHTML(trust.label)}</b><small>${escapeHTML(trust.detail)}</small></div>
      </div>
      ${source ? `<a href="${source}" target="_blank" rel="noopener noreferrer">Official source ↗</a>` : ''}
    </div>

    ${expired ? `<div class="saved-expired-note">${icon('info',15)}<span>The stored deadline has passed. Keep this only if you want to check whether the provider opens a new cycle; Tefsen will not assume recurrence.</span></div>` : ''}

    <details class="saved-decision-note" ${journey.notes ? 'open' : ''}>
      <summary><span>${icon('info',15)} Private decision note</span><small>${journey.notes ? 'Saved' : 'Optional'}</small></summary>
      <form data-saved-note-form="${escapeHTML(opportunityId)}">
        <textarea class="textarea" name="notes" maxlength="3000" placeholder="Why did you save this? What do you still need to verify?">${escapeHTML(journey.notes || '')}</textarea>
        <div><small>Private to your account. This is not shared with the community.</small><button class="btn btn-secondary" type="submit">Save note</button></div>
      </form>
    </details>

    <div class="saved-opportunity-actions">
      ${item ? `<button class="btn btn-secondary" type="button" data-route="opportunity/${encodeURIComponent(opportunityId)}">Review details</button>` : '<span class="saved-unavailable">Opportunity details unavailable</span>'}
      ${item && !expired ? `<button class="btn btn-primary" type="button" data-start-journey="${escapeHTML(opportunityId)}">Start Journey</button>` : ''}
      <button class="saved-remove-button" type="button" data-saved-remove="${escapeHTML(opportunityId)}" data-saved-title="${escapeHTML(title)}">Remove saved</button>
    </div>
  </article>`;
}

function savedComparisonPanelMarkup() {
  const workspace = currentSavedWorkspace;
  if (!workspace) return '';
  const selectedRows = workspace.savedReview.filter(row => savedOpportunityCompareIds.has(String(row.journey?.opportunityId || '')));
  if (!selectedRows.length) return '';

  const comparison = buildSavedComparison(selectedRows);
  return `<section class="saved-compare-panel">
    <header>
      <div>
        <span class="opportunity-kicker">COMPARE SAVED OPPORTUNITIES</span>
        <h2>${comparison.length} selected</h2>
        <p>Compare structured facts side-by-side. Official provider pages remain authoritative.</p>
      </div>
      <button class="btn btn-ghost" type="button" data-saved-compare-clear>Clear comparison</button>
    </header>
    <div class="saved-compare-grid">
      ${comparison.map(item => {
        const deadline = opportunityDeadlinePresentation({
          deadline:item.deadline,
          deadlineNote:item.deadline ? '' : 'Deadline varies — check official source'
        });
        const source = safeUrl(item.officialSourceUrl || '');
        return `<article class="saved-compare-column">
          <div class="saved-compare-column-head">
            <div><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.provider)}</p></div>
            <button type="button" data-saved-compare="${escapeHTML(item.id)}" aria-label="Remove ${escapeHTML(item.title)} from comparison">×</button>
          </div>
          <dl>
            <div><dt>Funding</dt><dd>${escapeHTML(item.funding)}</dd></div>
            <div><dt>Destination</dt><dd>${escapeHTML(item.country)}</dd></div>
            <div><dt>Study level</dt><dd>${escapeHTML(item.studyLevel)}</dd></div>
            <div><dt>Profile match</dt><dd>${item.profileScore > 0 ? `${item.profileScore}%` : 'Not personalized'}</dd></div>
            <div><dt>Deadline</dt><dd class="${escapeHTML(deadline.tone)}">${escapeHTML(deadline.label)}</dd></div>
            <div><dt>Source status</dt><dd>${escapeHTML(item.verificationStatus)}</dd></div>
          </dl>
          <div class="saved-compare-actions">
            <button class="btn btn-secondary" type="button" data-route="opportunity/${encodeURIComponent(item.id)}">Review details</button>
            ${source ? `<a href="${source}" target="_blank" rel="noopener noreferrer">Official source ↗</a>` : ''}
          </div>
        </article>`;
      }).join('')}
      ${comparison.length < 3 ? `<article class="saved-compare-add"><div>${icon('plus',20)}</div><b>Add up to ${3-comparison.length} more</b><p>Choose Compare on another saved opportunity.</p></article>` : ''}
    </div>
  </section>`;
}

function syncSavedComparisonUI() {
  document.querySelectorAll('[data-saved-compare]').forEach(button => {
    const id = String(button.dataset.savedCompare || '');
    const selected = savedOpportunityCompareIds.has(id);
    button.classList.toggle('active', selected);
    if (button.hasAttribute('aria-pressed')) button.setAttribute('aria-pressed', String(selected));
    const label = button.querySelector('span');
    if (label) label.textContent = selected ? 'Comparing' : 'Compare';
  });
  document.querySelectorAll('[data-saved-card]').forEach(card => {
    card.classList.toggle('compare-selected', savedOpportunityCompareIds.has(String(card.dataset.savedCard || '')));
  });
  const tray = document.querySelector('[data-saved-compare-tray]');
  if (tray) tray.innerHTML = savedComparisonPanelMarkup();
  const count = document.querySelector('[data-saved-compare-count]');
  if (count) count.textContent = String(savedOpportunityCompareIds.size);
}

function toggleSavedComparison(button) {
  const id = String(button?.dataset?.savedCompare || '');
  if (!id || !currentSavedWorkspace?.savedReview?.some(row => String(row.journey?.opportunityId || '') === id)) return;
  if (savedOpportunityCompareIds.has(id)) savedOpportunityCompareIds.delete(id);
  else {
    if (savedOpportunityCompareIds.size >= 3) {
      toast('Compare up to 3 saved opportunities at a time.', 'error');
      return;
    }
    savedOpportunityCompareIds.add(id);
  }
  syncSavedComparisonUI();
}

function openSavedRemoveConfirm(button) {
  const opportunityId = String(button?.dataset?.savedRemove || '');
  if (!opportunityId) return;
  const title = String(button.dataset.savedTitle || 'this opportunity');
  const row = currentSavedWorkspace?.savedReview?.find(item => String(item.journey?.opportunityId || '') === opportunityId);
  const hasNote = Boolean(String(row?.journey?.notes || '').trim());

  modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop>
    <section class="modal saved-remove-modal">
      <header class="modal-head"><h2>Remove saved opportunity?</h2><button class="close-btn" type="button" data-close-modal>${icon('close',19)}</button></header>
      <div class="modal-body">
        <p><b>${escapeHTML(title)}</b> will be removed from your saved review list.</p>
        ${hasNote ? '<p class="saved-remove-warning">Your private decision note for this saved-only item will also be removed.</p>' : ''}
        <p style="color:var(--muted)">This action is available only before the application Journey has started. Started Journey history is never deleted by this control.</p>
        <div class="modal-actions"><button class="btn btn-secondary" type="button" data-close-modal>Keep saved</button><button class="btn btn-danger" type="button" data-confirm-remove-saved="${escapeHTML(opportunityId)}">Remove saved</button></div>
      </div>
    </section>
  </div>`;
}

async function confirmRemoveSaved(button) {
  const opportunityId = String(button?.dataset?.confirmRemoveSaved || '');
  if (!opportunityId) return;
  await withButton(button, async () => {
    try {
      await removeSavedOpportunity(state.mode, state.user.uid, opportunityId);
      currentJourneyStates.delete(opportunityId);
      savedOpportunityCompareIds.delete(opportunityId);
      modalRoot.innerHTML = '';
      toast('Removed from saved opportunities.', 'success');
      await renderJourneys();
    } catch (error) {
      toast(humanError(error), 'error');
    }
  });
}

async function handleSavedDecisionNote(form) {
  const opportunityId = String(form?.dataset?.savedNoteForm || '');
  if (!opportunityId) return;
  const journey = currentJourneyStates.get(opportunityId);
  if (!journey) {
    toast('Saved opportunity state is unavailable.', 'error');
    return;
  }
  const notes = String(new FormData(form).get('notes') || '').trim();
  const submit = form.querySelector('button[type="submit"]');

  await withButton(submit, async () => {
    try {
      const updated = await updateJourneyPlanning(state.mode, state.user.uid, opportunityId, {
        personalTargetDate: journey.personalTargetDate || '',
        notes
      });
      currentJourneyStates.set(opportunityId, updated);
      toast(notes ? 'Private decision note saved.' : 'Private decision note cleared.', 'success');
      await renderJourneys();
    } catch (error) {
      toast(humanError(error), 'error');
    }
  });
}

function journeyPriorityCardMarkup(row) {
  const journey = row.journey || {};
  const opportunity = row.opportunity || null;
  const title = opportunity?.title || 'Opportunity unavailable';
  const provider = opportunity?.provider || opportunity?.university || 'The original opportunity is not currently public.';
  const attention = row.attention || { tone:'active', label:'Active Journey', title:'Continue your Journey', detail:'' };
  const progress = row.progress || { completed:0,total:0,percent:0,nextTask:'' };
  const official = row.preSubmission ? deadlineInfo(opportunity?.deadline || '') : null;
  const personal = row.preSubmission ? deadlineInfo(journey.personalTargetDate || '') : null;
  const lastUpdated = row.updatedAtMillis ? formatHistoryTime(row.updatedAtMillis) : 'Recently';

  return `<article class="journey-priority-card ${escapeHTML(attention.tone)}">
    <div class="journey-priority-card-head">
      <div class="journey-attention-label ${escapeHTML(attention.tone)}"><span></span>${escapeHTML(attention.label)}</div>
      <span class="journey-stage-label">${escapeHTML(JOURNEY_LABELS[journey.status] || journey.status)}</span>
    </div>

    <div class="journey-priority-heading">
      <h3>${escapeHTML(title)}</h3>
      <p>${escapeHTML(provider)}</p>
    </div>

    <section class="journey-priority-action">
      <span>WHAT NEEDS ATTENTION</span>
      <h4>${escapeHTML(attention.title)}</h4>
      <p>${escapeHTML(attention.detail)}</p>
    </section>

    <div class="journey-priority-progress">
      <div><span>Preparation checklist</span><strong>${progress.completed}/${progress.total}</strong></div>
      <div class="journey-progress-bar"><i style="width:${progress.percent}%"></i></div>
      <small>${progress.total ? `${progress.percent}% complete` : 'No structured checklist tasks yet'}${progress.nextTask ? ` · Next: ${escapeHTML(progress.nextTask)}` : ''}</small>
    </div>

    <div class="journey-priority-dates">
      ${row.preSubmission
        ? `<div class="${official?.valid ? deadlineUrgencyClass(official) : ''}"><span>Official deadline</span><b>${escapeHTML(official?.label || 'Deadline not listed')}</b><small>Provider source remains authoritative</small></div>
           <div class="${row.targetAfterOfficial || (personal?.valid && personal.daysRemaining < 0) ? 'warning' : ''}"><span>Personal target</span><b>${personal?.valid ? escapeHTML(personal.label) : 'Not set'}</b><small>${row.targetAfterOfficial ? 'Move this before the official deadline' : 'Your private preparation target'}</small></div>`
        : `<div class="submitted"><span>Application timing</span><b>${journey.status === 'interview' ? 'Review stage' : 'Submitted'}</b><small>The original application deadline is no longer treated as an action alert</small></div>
           <div><span>Last updated</span><b>${escapeHTML(lastUpdated)}</b><small>Update the stage when the provider responds</small></div>`}
    </div>

    <div class="journey-priority-card-foot">
      <span>Private Journey · stage, tasks, targets and notes stay private by default</span>
      <button class="btn btn-primary" type="button" data-route="journey/${encodeURIComponent(journey.opportunityId)}">Open Journey</button>
    </div>
  </article>`;
}

function journeyOutcomeCardMarkup(row) {
  const journey = row.journey || {};
  const opportunity = row.opportunity || null;
  const title = opportunity?.title || 'Opportunity unavailable';
  const provider = opportunity?.provider || opportunity?.university || 'Opportunity provider unavailable.';
  const attention = row.attention || {};
  const updated = row.updatedAtMillis ? formatHistoryTime(row.updatedAtMillis) : 'Recently';
  const tone = journey.status === 'accepted' ? 'accepted' : journey.status === 'rejected' ? 'rejected' : 'withdrawn';

  return `<article class="journey-outcome-card ${tone}">
    <div class="journey-outcome-mark">${journey.status === 'accepted' ? '✓' : journey.status === 'rejected' ? '×' : '—'}</div>
    <div class="journey-outcome-copy">
      <span>${escapeHTML(attention.label || JOURNEY_LABELS[journey.status] || journey.status)}</span>
      <h3>${escapeHTML(title)}</h3>
      <p>${escapeHTML(provider)}</p>
      <small>${escapeHTML(attention.detail || '')} · Updated ${escapeHTML(updated)}</small>
    </div>
    <button class="btn btn-secondary" type="button" data-route="journey/${encodeURIComponent(journey.opportunityId)}">Open record</button>
  </article>`;
}

function journeyAttentionBannerMarkup(row) {
  if (!row) return '';
  const journey = row.journey || {};
  const attention = row.attention || {};
  return `<section class="journey-attention-banner ${escapeHTML(attention.tone || 'active')}">
    <div class="journey-attention-icon">${attention.tone === 'urgent' ? '!' : icon('check',19)}</div>
    <div>
      <span>ATTENTION FIRST</span>
      <h3>${escapeHTML(attention.title || 'Continue your application Journey')}</h3>
      <p>${escapeHTML(attention.detail || '')}</p>
    </div>
    <button class="btn btn-primary" type="button" data-route="journey/${encodeURIComponent(journey.opportunityId)}">Open priority Journey</button>
  </section>`;
}

async function renderJourneys() {
  renderShell(`<header class="page-head"><div><h1>Your Journey</h1><p>Loading saved decisions and application progress…</p></div></header><div class="loading-card"></div>`, { wide:true });
  try {
    const [journeys, initialOpportunities, passport] = await Promise.all([
      listJourneyStates(state.mode, state.user.uid),
      getOpportunities(state.mode).catch(() => []),
      getStudentPassport(state.mode, state.user.uid).catch(() => emptyStudentPassport(state.user.uid))
    ]);

    currentStudentPassport = passport;
    currentJourneyStates = new Map(journeys.map(row => [row.opportunityId, row]));

    const opportunityMap = new Map(initialOpportunities.map(item => [item.id, item]));
    const missingIds = [...new Set(journeys
      .filter(row => row.saved || row.started)
      .map(row => String(row.opportunityId || ''))
      .filter(id => id && !opportunityMap.has(id)))].slice(0,25);

    if (missingIds.length) {
      const recovered = await Promise.all(missingIds.map(id => getOpportunityById(state.mode, id).catch(() => null)));
      recovered.filter(Boolean).forEach(item => opportunityMap.set(item.id, item));
    }

    const opportunities = [...opportunityMap.values()];
    const profileScores = new Map();
    for (const item of opportunities) {
      const view = opportunityMatchPresentation(scoreOpportunityMatch(passport, item));
      profileScores.set(item.id, view.personalized ? view.score : 0);
    }

    const workspace = buildSavedOpportunityWorkspace({
      journeys,
      opportunities,
      profileScores
    });
    currentSavedWorkspace = workspace;
    const journeyPriority = buildJourneyPriorityWorkspace([
      ...workspace.active,
      ...workspace.completed
    ]);

    const validSavedIds = new Set(workspace.savedReview.map(row => String(row.journey?.opportunityId || '')));
    savedOpportunityCompareIds = new Set([...savedOpportunityCompareIds].filter(id => validSavedIds.has(id)));

    const totalPersonal = workspace.counts.savedReview + workspace.counts.active + workspace.counts.completed;
    const content = `${demoBanner()}
      <div class="journey-page saved-workspace-page">
        <section class="saved-workspace-hero">
          <div>
            <span class="opportunity-kicker">PRIVATE DECISION & APPLICATION WORKSPACE</span>
            <h1>Decide what is worth pursuing.</h1>
            <p>Saving is for review. Starting a Journey means you are actively preparing. Tefsen keeps those two decisions separate so your workspace stays useful.</p>
            <div class="saved-workspace-actions">
              <button class="btn btn-primary" type="button" data-route="opportunities">Find opportunities</button>
              <button class="btn btn-secondary" type="button" data-route="passport">Review Student Passport</button>
            </div>
          </div>
          <div class="saved-workspace-stats">
            <div><strong>${workspace.counts.savedReview || '—'}</strong><span>saved for review</span></div>
            <div><strong>${journeyPriority.counts.active || '—'}</strong><span>active applications</span></div>
            <div><strong>${journeyPriority.counts.needsAttention || '—'}</strong><span>applications needing attention</span></div>
          </div>
        </section>

        <div class="passport-private-note"><span>${icon('info',18)}</span><div><b>Private by default.</b><br>Saved decisions, notes, application stages, targets and checklist status are not published to your Tefsen community profile.</div></div>

        ${!totalPersonal ? `<section class="saved-workspace-empty-start">
          <div>${icon('bookmark',25)}</div>
          <h2>Your private opportunity workspace is empty.</h2>
          <p>Explore the global catalogue, save opportunities worth a second look, and start a Journey only when you decide to prepare seriously.</p>
          <button class="btn btn-primary" type="button" data-route="opportunities">Explore opportunities</button>
        </section>` : ''}

        <section class="saved-review-section">
          <header class="saved-section-head">
            <div>
              <span class="opportunity-kicker">SAVED FOR REVIEW</span>
              <h2>Compare before you commit.</h2>
              <p>Saved opportunities have not started an application Journey yet. Review requirements, add a private note, compare up to three, then decide.</p>
            </div>
            <div class="saved-section-tools"><span><b data-saved-compare-count>${savedOpportunityCompareIds.size}</b>/3 comparing</span><button class="btn btn-ghost" type="button" data-route="opportunities">Add more</button></div>
          </header>

          <div data-saved-compare-tray>${savedComparisonPanelMarkup()}</div>

          <div class="saved-opportunity-grid">
            ${workspace.savedReview.length
              ? workspace.savedReview.map(savedOpportunityCardMarkup).join('')
              : `<section class="saved-section-empty">
                  <div>${icon('bookmark',21)}</div>
                  <h3>No opportunities waiting for review.</h3>
                  <p>Save an opportunity from Discovery when you want to compare it before starting a Journey.</p>
                  <button class="btn btn-secondary" type="button" data-route="opportunities">Browse opportunities</button>
                </section>`}
          </div>

          ${workspace.counts.expiredSaved ? `<div class="saved-expired-summary">${icon('info',16)}<span>${workspace.counts.expiredSaved} saved opportunit${workspace.counts.expiredSaved === 1 ? 'y has' : 'ies have'} a passed stored deadline. They remain visible so you can verify a new cycle or remove them manually.</span></div>` : ''}
        </section>

        <section class="journey-active-section">
          <header class="saved-section-head">
            <div>
              <span class="opportunity-kicker">ACTIVE APPLICATIONS</span>
              <h2>Work on what needs attention first.</h2>
              <p>Journeys are ordered by actionable deadline, planning conflicts and current stage—not by a hidden success score.</p>
            </div>
            <div class="journey-active-counts">
              <span><b>${journeyPriority.counts.active}</b> active</span>
              <span class="${journeyPriority.counts.needsAttention ? 'attention' : ''}"><b>${journeyPriority.counts.needsAttention}</b> attention</span>
              <span><b>${journeyPriority.counts.submitted}</b> submitted / review</span>
            </div>
          </header>

          ${journeyPriority.counts.needsAttention ? journeyAttentionBannerMarkup(journeyPriority.primary) : ''}

          <div class="journey-priority-list">
            ${journeyPriority.active.length
              ? journeyPriority.active.map(journeyPriorityCardMarkup).join('')
              : `<section class="saved-section-empty compact"><h3>No active application Journey.</h3><p>When you start preparing a saved opportunity, it will move here automatically.</p></section>`}
          </div>
        </section>

        ${journeyPriority.outcomes.length ? `<section class="journey-outcomes-section">
          <header class="saved-section-head compact">
            <div>
              <span class="opportunity-kicker">OUTCOMES</span>
              <h2>Completed application decisions.</h2>
              <p>Accepted, rejected and withdrawn records stay separate from active deadline priority.</p>
            </div>
            <span class="saved-count-chip">${journeyPriority.counts.outcomes}</span>
          </header>
          <div class="journey-outcome-list">${journeyPriority.outcomes.map(journeyOutcomeCardMarkup).join('')}</div>
        </section>` : ''}
      </div>`;

    renderShell(content, { wide:true });
    requestAnimationFrame(syncSavedComparisonUI);
  } catch (error) {
    console.error(error);
    renderShell(`${demoBanner()}${emptyState('info','Journey unavailable','Secure Journey access is not configured yet. Review Firestore rules before production use.')}`, { wide:true });
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
      renderShell(`<button class="btn btn-ghost" data-route="journeys">${icon('back',17)} Back</button>${emptyState('info','Journey not started','Open the opportunity and choose Start Journey first.')}`, { wide:true });
      return;
    }

    currentJourneyStates.set(opportunityId, journey);

    const model = buildJourneyDetailModel(journey, opportunity);
    const postAcceptance = model.postAcceptance;
    const nextStatuses = allowedJourneyTransitions(journey.status);
    const official = deadlineInfo(opportunity?.deadline || '');
    const personal = deadlineInfo(journey.personalTargetDate || '');
    const officialSource = safeUrl(opportunity?.officialSourceUrl || '');
    const trust = opportunity
      ? opportunityTrustPresentation(opportunity)
      : { tone:'unverified', label:'Source unavailable', detail:'The public opportunity record is not currently available.' };

    const stageOptions = nextStatuses.map(status => `
      <option value="${escapeHTML(status)}">${escapeHTML(JOURNEY_LABELS[status])}</option>`
    ).join('');

    const incompleteTasks = model.tasks.incomplete;
    const completedTasks = model.tasks.completed;
    const nextTask = model.tasks.next;

    const taskMarkup = task => `<div class="journey-detail-task ${task.completed ? 'done' : ''} ${task === nextTask && !model.terminal ? 'next' : ''} ${model.terminal ? 'readonly' : ''}">
      ${model.terminal
        ? `<span class="journey-task-check static" aria-hidden="true">${task.completed ? '✓' : '○'}</span>`
        : `<button class="journey-task-check" type="button" data-journey-task-toggle="${escapeHTML(task.id)}" data-opportunity-id="${escapeHTML(opportunityId)}" aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}">${task.completed ? '✓' : ''}</button>`}
      <div><b>${escapeHTML(task.label)}</b><small>${task.source === 'system' ? 'From structured opportunity requirements' : 'Your private custom task'}</small></div>
      ${!model.terminal && task.source === 'custom' ? `<button class="journey-task-remove" type="button" data-journey-task-delete="${escapeHTML(task.id)}" data-opportunity-id="${escapeHTML(opportunityId)}">Remove</button>` : ''}
    </div>`;

    const deadlinePanel = model.preSubmission
      ? `<section class="journey-detail-card">
          <header class="journey-detail-card-head"><div><span>DATES</span><h2>Official deadline & personal target</h2></div></header>
          <div class="journey-detail-date-grid">
            <div class="${deadlineUrgencyClass(official)}">
              <span>OFFICIAL DEADLINE</span>
              <b>${escapeHTML(official.label)}</b>
              <small>Stored provider deadline. Confirm exact date/time on the official source.</small>
            </div>
            <div class="${model.planning.targetAfterOfficial || (personal.valid && personal.daysRemaining < 0) ? 'warning' : ''}">
              <span>PERSONAL TARGET</span>
              <b>${personal.valid ? escapeHTML(personal.label) : 'Not set'}</b>
              <small>${model.planning.targetAfterOfficial ? 'This must be moved on or before the official deadline.' : 'Private preparation target. It never changes the provider deadline.'}</small>
            </div>
          </div>
        </section>`
      : `<section class="journey-detail-card">
          <header class="journey-detail-card-head"><div><span>APPLICATION TIMING</span><h2>Submission stage context</h2></div></header>
          <div class="journey-postsubmit-note">
            ${icon('check',17)}
            <div><b>${journey.status === 'interview' ? 'Provider review is in progress' : model.terminal ? 'Application outcome recorded' : 'Application marked submitted'}</b>
            <p>The original application deadline is kept as historical context and is not treated as a live action alert at this stage.</p></div>
          </div>
          ${opportunity?.deadline ? `<div class="journey-historical-date"><span>Stored original deadline</span><b>${escapeHTML(String(opportunity.deadline))}</b></div>` : ''}
        </section>`;

    const stagePanel = `<section class="journey-detail-card journey-stage-control">
      <header class="journey-detail-card-head">
        <div><span>CURRENT STAGE</span><h2>${escapeHTML(JOURNEY_LABELS[journey.status] || journey.status)}</h2></div>
        <span class="journey-stage-status ${escapeHTML(model.guidance.tone)}">${escapeHTML(model.guidance.kicker)}</span>
      </header>
      ${journeyStageLine(journey)}
      ${nextStatuses.length ? `<form class="journey-stage-update" data-journey-stage-form="${escapeHTML(opportunityId)}">
        <div>
          <label for="journey-stage-${escapeHTML(opportunityId)}">Update only when this matches your real application</label>
          <select class="select" id="journey-stage-${escapeHTML(opportunityId)}" name="status" required>
            <option value="">Choose an allowed stage</option>
            ${stageOptions}
          </select>
        </div>
        <button class="btn btn-primary" type="submit">Update stage</button>
      </form>`
      : `${journey.status === "accepted" ? `<div class="journey-final-stage-note accepted">${icon("check",16)}<span>The application outcome is final. The application record stays read-only while the separate post-acceptance plan remains editable.</span></div>` : `<div class="journey-final-stage-note">${icon("info",16)}<span>This Journey is in a final outcome stage. Its history remains private and available for reference.</span></div>`}`}
    </section>`;

    const content = `${demoBanner()}
      <div class="journey-detail-page">
        <div class="journey-detail-topbar">
          <button class="btn btn-ghost" data-route="journeys">${icon('back',17)} Back to Journey</button>
          ${opportunity ? `<button class="btn btn-secondary" type="button" data-route="opportunity/${encodeURIComponent(opportunityId)}">Opportunity details</button>` : ''}
        </div>

        <section class="journey-detail-hero ${escapeHTML(model.guidance.tone)}">
          <div class="journey-detail-hero-copy">
            <span class="opportunity-kicker">${escapeHTML(model.guidance.kicker)}</span>
            <h1>${escapeHTML(model.title)}</h1>
            <p class="journey-detail-provider">${escapeHTML(model.provider || 'Opportunity provider unavailable')}</p>
            <div class="journey-detail-guidance">
              <span>WHAT TO FOCUS ON NOW</span>
              <h2>${escapeHTML(model.guidance.title)}</h2>
              <p>${escapeHTML(model.guidance.detail)}</p>
            </div>
          </div>
          <aside class="journey-detail-summary">
            <div><span>Stage</span><strong>${escapeHTML(JOURNEY_LABELS[journey.status] || journey.status)}</strong></div>
            <div><span>${postAcceptance?.active ? "Next-stage plan" : "Checklist"}</span><strong>${postAcceptance?.active ? `${postAcceptance.progress.completed}/${postAcceptance.progress.total}` : `${model.progress.completed}/${model.progress.total}`}</strong><small>${postAcceptance?.active ? `${postAcceptance.progress.percent}% complete` : `${model.progress.percent}% complete`}</small></div>
            <div><span>Next task</span><strong>${postAcceptance?.active ? (postAcceptance.tasks.next ? escapeHTML(postAcceptance.tasks.next.label) : "Review official next steps") : (nextTask ? escapeHTML(nextTask.label) : model.terminal ? "Outcome recorded" : "No open task")}</strong></div>
          </aside>
        </section>

        <div class="journey-detail-layout">
          <main class="journey-detail-main">
            ${stagePanel}

            <section class="journey-detail-card">
              <header class="journey-detail-card-head checklist">
                <div>
                  <span>${model.terminal ? 'APPLICATION CHECKLIST RECORD' : 'PREPARATION CHECKLIST'}</span>
                  <h2>${model.terminal ? 'Read-only application preparation history' : model.progress.remaining ? `${model.progress.remaining} task${model.progress.remaining === 1 ? '' : 's'} remaining` : 'No unfinished tasks'}</h2>
                  <p>${model.terminal ? 'This checklist is preserved as part of the application record and no longer drives next-stage work.' : 'System tasks come from structured opportunity requirements. Custom tasks are private to you.'}</p>
                </div>
                <strong>${model.progress.percent}%</strong>
              </header>
              <div class="journey-progress-bar journey-detail-progress"><i style="width:${model.progress.percent}%"></i></div>

              ${nextTask && !model.terminal ? `<section class="journey-next-task">
                <span>NEXT UNFINISHED TASK</span>
                <h3>${escapeHTML(nextTask.label)}</h3>
                <p>${nextTask.source === 'system' ? 'This task came from the structured opportunity requirements.' : 'This is a private task you added to your Journey.'}</p>
              </section>` : ''}

              <div class="journey-detail-task-list">
                ${incompleteTasks.length
                  ? incompleteTasks.map(taskMarkup).join('')
                  : `<div class="journey-checklist-empty">${icon('check',20)}<div><b>No unfinished checklist tasks.</b><p>${model.terminal ? 'This Journey outcome is already recorded.' : 'Confirm the official source before considering preparation complete.'}</p></div></div>`}
              </div>

              ${!model.terminal ? `<form class="journey-add-task" data-journey-task-form="${escapeHTML(opportunityId)}">
                <input class="input" name="label" maxlength="240" required placeholder="${journey.status === 'interview' ? 'Add interview or review preparation task' : journey.status === 'applied' ? 'Add follow-up or requested document task' : 'Add a private preparation task'}">
                <button class="btn btn-secondary" type="submit">Add task</button>
              </form>` : ''}

              ${completedTasks.length ? `<details class="journey-completed-tasks">
                <summary><span>Completed tasks</span><b>${completedTasks.length}</b></summary>
                <div>${completedTasks.map(taskMarkup).join('')}</div>
              </details>` : ''}
            </section>

            ${postAcceptancePanelMarkup(postAcceptance, opportunityId)}

            <section class="journey-detail-card">
              <header class="journey-detail-card-head">
                <div><span>PRIVATE PLANNING</span><h2>Notes ${model.preSubmission ? '& preparation target' : '& follow-up context'}</h2><p>Planning information stays private to your account.</p></div>
              </header>
              <form class="journey-detail-planning-form" data-journey-planning-form="${escapeHTML(opportunityId)}" data-journey-status="${escapeHTML(journey.status)}" data-official-deadline="${escapeHTML(opportunity?.deadline || '')}">
                ${model.preSubmission
                  ? `<div class="field"><label>Personal preparation target <small>Optional</small></label><input class="input" type="date" name="personalTargetDate" value="${escapeHTML(journey.personalTargetDate || '')}"><small>Must be on or before the stored official deadline when one is available.</small><span class="field-error" data-journey-planning-error="personalTargetDate" hidden></span></div>`
                  : `<input type="hidden" name="personalTargetDate" value="${escapeHTML(journey.personalTargetDate || '')}">
                     ${journey.personalTargetDate ? `<div class="journey-historical-target"><span>Historical preparation target</span><b>${escapeHTML(journey.personalTargetDate)}</b><small>Kept for context; it is no longer an active preparation deadline.</small></div>` : ''}`}
                <div class="field"><label>Private notes</label><textarea class="textarea" name="notes" maxlength="3000" data-journey-notes placeholder="${journey.status === 'applied' ? 'Submission confirmation, reference number, expected response…' : journey.status === 'interview' ? 'Interview topics, requested documents, follow-up reminders…' : journey.status === 'accepted' ? 'Offer acceptance, official next steps, questions to verify…' : 'Questions, reminders, preparation notes…'}">${escapeHTML(journey.notes || '')}</textarea><div class="journey-notes-meta"><small>Private to your account</small><small><span data-journey-notes-count>${String(journey.notes || '').length}</span>/3000</small></div><span class="field-error" data-journey-planning-error="notes" hidden></span></div>
                <div class="journey-planning-summary" data-journey-planning-summary hidden></div>
                <button class="btn btn-primary" type="submit">Save private planning</button>
              </form>
            </section>
          </main>

          <aside class="journey-detail-aside">
            ${deadlinePanel}

            <section class="journey-detail-card">
              <header class="journey-detail-card-head"><div><span>OFFICIAL SOURCE</span><h2>Verify before acting</h2></div></header>
              <div class="journey-source-status ${escapeHTML(trust.tone)}">
                <span>${icon('check',16)}</span>
                <div><b>${escapeHTML(trust.label)}</b><p>${escapeHTML(trust.detail)}</p></div>
              </div>
              ${officialSource
                ? `<a class="btn btn-secondary journey-source-link" href="${officialSource}" target="_blank" rel="noopener noreferrer">Open official provider source ↗</a>`
                : '<p class="journey-source-missing">No official source link is available in this stored opportunity record. Do not rely on Tefsen alone for submission requirements.</p>'}
            </section>

            <section class="journey-detail-card">
              <header class="journey-detail-card-head"><div><span>STAGE HISTORY</span><h2>Your Journey timeline</h2></div></header>
              <div class="journey-detail-history">
                ${model.history.length
                  ? model.history.map((item,index) => `<div class="journey-detail-history-item ${index === 0 ? 'latest' : ''}"><span></span><div><b>${escapeHTML(JOURNEY_LABELS[item.status] || item.status)}</b><small>${escapeHTML(formatHistoryTime(item.atMillis))}</small></div></div>`).join('')
                  : '<p>No stage history recorded yet.</p>'}
              </div>
            </section>

            <section class="journey-detail-privacy">
              ${icon('info',16)}
              <div><b>Private Journey</b><p>Your stage, checklist, targets and notes are not automatically published to your community profile.</p></div>
            </section>
          </aside>
        </div>
      </div>`;

    renderShell(content, { wide:true });
  } catch (error) {
    console.error(error);
    renderShell(`<button class="btn btn-ghost" data-route="journeys">${icon('back',17)} Back</button>${emptyState('info','Could not load Journey','Please try again.')}`, { wide:true });
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
  const posts = state.posts.filter(p =>
    postBelongsToUser(p, profile?.uid || '') && isPublicProfileActivity(p)
  );

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

  const model = buildPublicProfileModel({
    profile,
    own,
    posts,
    passportCompleteness:completeness,
    activeJourneys:activeJourneys.length,
    savedOpportunities
  });

  const ownActions = `<div class="profile13-actions">
    <button class="btn btn-primary" type="button" data-edit-profile>${icon('edit',17)} Edit public profile</button>
    <button class="btn btn-secondary" type="button" data-route="passport">Student Passport</button>
  </div>`;

  const otherActions = `<div class="profile13-actions profile14-visitor-actions">
    <button class="btn btn-primary" type="button" data-profile-activity-jump>${icon('comment',17)} View public activity</button>
  </div>`;

  const photo = own
    ? `<div class="profile13-photo-block">
        <button class="profile13-photo-button" type="button" data-profile-photo-edit aria-label="${model.hasPhoto ? 'Change profile photo' : 'Add profile photo'}">
          <span class="profile13-avatar">${avatar(profile,'lg')}</span>
          <span class="profile13-photo-edit">${icon('edit',15)}</span>
        </button>
        <div class="profile13-photo-links">
          <button type="button" data-profile-photo-edit>${model.hasPhoto ? 'Change photo' : 'Add photo'}</button>
          ${model.hasPhoto ? '<button class="danger" type="button" data-profile-photo-remove>Remove</button>' : ''}
        </div>
      </div>`
    : `<div class="profile13-photo-block public"><span class="profile13-avatar">${avatar(profile,'lg')}</span></div>`;

  const publicStats = `<div class="profile13-public-stats profile14-public-stats">
    <div><strong>${formatCount(model.publicStats.posts)}</strong><span>Public posts</span></div>
    <div><strong>${escapeHTML(normalizeRole(profile?.role || 'Student'))}</strong><span>Community role</span></div>
  </div>`;

  const identityGuide = own ? `<section class="profile13-completion">
    <div class="profile13-completion-head">
      <div><span>PUBLIC PROFILE QUALITY</span><strong>${model.identity.percent}%</strong></div>
      <div class="profile13-completion-track"><i style="width:${model.identity.percent}%"></i></div>
    </div>
    <div class="profile13-completion-items">
      ${model.identity.checks.map(item => `<button type="button" class="${item.complete ? 'complete' : ''}" data-edit-profile>
        <span>${item.complete ? '✓' : '+'}</span><b>${escapeHTML(item.label)}</b>
      </button>`).join('')}
    </div>
    <p>This score only reflects your public profile completeness. It is not an eligibility, admission or reputation score.</p>
  </section>` : '';

  const privateWorkspace = own ? `<section class="profile13-private-workspace">
    <header>
      <div><span class="opportunity-kicker">PRIVATE WORKSPACE</span><h2>Your student planning stays separate from your public identity.</h2><p>Student Passport, saved opportunities and application Journeys are private account data unless you explicitly publish a community story.</p></div>
      <span class="profile13-private-chip">${icon('check',14)} Private to you</span>
    </header>
    <div class="profile13-private-grid">
      <button type="button" data-route="passport">
        <span class="profile13-private-icon">${icon('user',18)}</span>
        <div><small>STUDENT PASSPORT</small><strong>${model.privateWorkspace.passportCompleteness}% complete</strong><p>Improve the private profile used for opportunity matching.</p></div>
        <span>→</span>
      </button>
      <button type="button" data-route="journeys">
        <span class="profile13-private-icon">${icon('check',18)}</span>
        <div><small>ACTIVE JOURNEYS</small><strong>${model.privateWorkspace.activeJourneys || 'No active application'}</strong><p>${model.privateWorkspace.activeJourneys ? 'Continue application preparation and next steps.' : 'Start from a saved opportunity when you are ready.'}</p></div>
        <span>→</span>
      </button>
      <button type="button" data-route="opportunities">
        <span class="profile13-private-icon">${icon('bookmark',18)}</span>
        <div><small>SAVED OPPORTUNITIES</small><strong>${model.privateWorkspace.savedOpportunities || 'Nothing saved yet'}</strong><p>Review opportunities privately before starting an application Journey.</p></div>
        <span>→</span>
      </button>
    </div>
  </section>` : `<section class="profile13-public-privacy-note">
    ${icon('info',16)}
    <div><b>Public community profile</b><p>Only profile information and community activity this student chooses to make public appear here. Student Passport and private application planning are not shown.</p></div>
  </section>`;

  const activity = posts.length
    ? posts.map(postCard).join('')
    : `<section class="profile13-empty">
        <div class="profile13-empty-mark">${icon('comment',22)}</div>
        <h3>${own ? 'No public activity yet.' : 'No public posts yet.'}</h3>
        <p>${own ? 'Your profile does not need filler content. Share only useful discussions, success stories or selected Journey experiences when you want them public.' : 'This student has not shared any public community posts yet.'}</p>
        ${own ? '<div><button class="btn btn-primary" type="button" data-route="explore">Open Community</button><button class="btn btn-secondary" type="button" data-share-success>Share a success</button></div>' : ''}
      </section>`;

  const content = `${demoBanner()}<div class="profile13-page">
    <section class="profile13-hero">
      <div class="profile13-hero-glow"></div>
      <div class="profile13-identity">
        ${photo}
        <div class="profile13-copy">
          <div class="profile13-eyebrow">
            <span>${escapeHTML(normalizeRole(profile?.role || 'Student'))}</span>
            ${profile?.verified ? '<span class="profile13-verified">Verified</span>' : ''}
          </div>
          <h1>${escapeHTML(model.fullName)} ${verifiedMark(profile?.verified, profile?.role)}</h1>
          <button class="profile13-handle ${model.username ? '' : 'missing'}" type="button" ${own ? 'data-edit-profile' : 'disabled'}>${escapeHTML(model.handleLabel)}</button>
          <p class="profile13-bio ${model.bio ? '' : 'missing'}">${escapeHTML(model.bioLabel)}</p>
          ${own ? ownActions : otherActions}
          ${publicStats}
        </div>
      </div>
      ${identityGuide}
    </section>

    ${privateWorkspace}

    <section class="profile13-activity">
      <header class="profile13-section-head">
        <div><span class="opportunity-kicker">COMMUNITY</span><h2>${own ? 'Your public activity' : 'Public activity'}</h2><p>${own ? 'Only things you intentionally share with the Tefsen community appear here.' : 'Public discussions and outcomes shared by this student.'}</p></div>
        ${own ? '<button class="btn btn-secondary" type="button" data-route="explore">Open Community</button>' : ''}
      </header>
      <div class="feed-list">${activity}</div>
    </section>
  </div>`;

  renderShell(content,{wide:true,right:false});
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
    <section class="modal v4-profile-modal profile13-editor-modal" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
      <header class="modal-head"><div><span class="profile13-modal-kicker">PUBLIC PROFILE</span><h2 id="edit-profile-title">Edit how students see you</h2></div><button class="close-btn" data-close-modal aria-label="Close">${icon('close',19)}</button></header>
      <div class="modal-body">
        <form class="form-grid profile13-editor-form" data-profile-form data-profile-modal>
          <section class="v4-photo-editor profile13-photo-editor">
            <div class="v4-photo-preview" data-profile-photo-preview>${avatar(p,'lg')}</div>
            <div class="v4-photo-editor-copy">
              <b>Profile photo</b>
              <p>This image is public. Choose JPG, PNG or WebP up to 5 MB. A selected image stays a preview until you save.</p>
              <input class="sr-only" type="file" name="profileImage" accept="image/jpeg,image/png,image/webp" data-profile-photo-input>
              <div class="v4-photo-editor-actions">
                <button class="btn btn-secondary" type="button" data-profile-photo-choose>${hasPhoto ? 'Choose a new photo' : 'Choose photo'}</button>
                ${hasPhoto ? '<button class="btn btn-ghost v4-remove-photo" type="button" data-profile-photo-remove>Remove current photo</button>' : ''}
              </div>
              <small class="profile13-photo-state" data-profile-photo-state>${hasPhoto ? 'Current public photo' : 'No public photo yet'}</small>
            </div>
          </section>

          <section class="profile13-public-fields">
            <div class="profile13-editor-note">${icon('info',16)}<p><b>These fields are public.</b> Your Student Passport, saved opportunities and Journey planning are not edited here and remain private.</p></div>

            <div class="field">
              <label>Public name</label>
              <input class="input" name="fullName" value="${escapeHTML(p.fullName || '')}" required maxlength="80" autocomplete="name">
              <small>The name shown on posts and your profile.</small>
              <span class="field-error" data-profile-error="fullName" hidden></span>
            </div>

            <div class="field">
              <label>Username <small>Optional</small></label>
              <div class="profile13-username-input"><span>@</span><input class="input" name="username" value="${escapeHTML(p.username || '')}" maxlength="40" autocomplete="off" placeholder="yourname"></div>
              <small>Letters, numbers, dots, underscores and hyphens only.</small>
              <span class="field-error" data-profile-error="username" hidden></span>
            </div>

            <div class="field">
              <div class="profile13-field-label"><label>Bio <small>Optional</small></label><small><span data-profile-bio-count>${String(p.bio || '').length}</span>/500</small></div>
              <textarea class="textarea" name="bio" maxlength="500" placeholder="What do you study, care about, or share with the community?">${escapeHTML(p.bio || '')}</textarea>
              <span class="field-error" data-profile-error="bio" hidden></span>
            </div>

            <div class="journey-planning-summary profile13-editor-summary" data-profile-summary hidden></div>
          </section>

          <div class="v4-profile-modal-footer">
            <button class="btn btn-ghost" type="button" data-close-modal>Cancel</button>
            <button class="btn btn-primary" type="submit">Save public profile</button>
          </div>
        </form>
      </div>
    </section>
  </div>`;
  const form = modalRoot.querySelector('[data-profile-form]');
  if (form) updatePublicProfileValidation(form);
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
  const passportJump = event.target.closest('[data-passport-jump]');
  if (passportJump) {
    const target = document.getElementById(passportJump.dataset.passportJump || '');
    if (target) {
      target.scrollIntoView({ behavior:'smooth', block:'start' });
      target.querySelector('input, select, textarea')?.focus({ preventScroll:true });
    }
    return;
  }

  const onboardingForm = event.target.closest('[data-passport-onboarding-form]');
  if (event.target.closest('[data-passport-onboarding-next]') && onboardingForm) {
    const step = Number(onboardingForm.dataset.currentStep || 0);
    if (validatePassportOnboardingStep(onboardingForm, step)) setPassportOnboardingStep(onboardingForm, step + 1);
    return;
  }
  if (event.target.closest('[data-passport-onboarding-back]') && onboardingForm) {
    setPassportOnboardingStep(onboardingForm, Number(onboardingForm.dataset.currentStep || 0) - 1);
    return;
  }
  const onboardingSkip = event.target.closest('[data-passport-onboarding-skip]');
  if (onboardingSkip) {
    await handlePassportOnboardingSkip(onboardingSkip, onboardingForm);
    return;
  }
  if (event.target.closest('[data-passport-onboarding-finish]')) {
    passportOnboardingJustCompleted = false;
    await renderStudentPassport();
    return;
  }

  const routeEl = event.target.closest('[data-route]');
  const syncSubscription = event.target.closest('[data-sync-subscription]');
  if (syncSubscription) {
    try { const profile = await getProfile(state.mode, state.user); state.profile = profile; toast('Subscription status synced.', 'success'); renderSubscription(); }
    catch (error) { toast(humanError(error), 'error'); }
    return;
  }
  if (routeEl) {
    event.preventDefault();
    if (passportOnboardingJustCompleted && routeEl.dataset.route !== 'passport') passportOnboardingJustCompleted = false;
    state.ui.profileMenu = false;
    document.documentElement.classList.remove('profile-menu-open');
    document.querySelectorAll('.profile-menu-backdrop, .profile-dropdown').forEach(el => el.remove());
    go(routeEl.dataset.route);
    return;
  }
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
  const savedCompare = event.target.closest('[data-saved-compare]');
  if (savedCompare) { toggleSavedComparison(savedCompare); return; }
  if (event.target.closest('[data-saved-compare-clear]')) {
    savedOpportunityCompareIds.clear();
    syncSavedComparisonUI();
    return;
  }
  const savedRemove = event.target.closest('[data-saved-remove]');
  if (savedRemove) { openSavedRemoveConfirm(savedRemove); return; }
  const confirmSavedRemove = event.target.closest('[data-confirm-remove-saved]');
  if (confirmSavedRemove) { await confirmRemoveSaved(confirmSavedRemove); return; }
  const confirmJourneyStage = event.target.closest('[data-confirm-journey-stage]');
  if (confirmJourneyStage) { await confirmJourneyStageUpdate(confirmJourneyStage); return; }

  const opportunityView = event.target.closest('[data-opportunity-view]');
  if (opportunityView) {
    opportunityDiscoveryFilters.view = opportunityView.dataset.opportunityView || 'all';
    applyOpportunityDiscoveryFilters();
    return;
  }
  const clearOpportunityFilter = event.target.closest('[data-opportunity-clear-filter]');
  if (clearOpportunityFilter) {
    const key = clearOpportunityFilter.dataset.opportunityClearFilter;
    if (key && key in opportunityDiscoveryFilters) {
      opportunityDiscoveryFilters[key] = key === 'query' ? '' : 'all';
      applyOpportunityDiscoveryFilters();
    }
    return;
  }
  if (event.target.closest('[data-opportunity-clear-all]')) {
    opportunityDiscoveryFilters = { ...DEFAULT_OPPORTUNITY_FILTERS };
    applyOpportunityDiscoveryFilters();
    return;
  }
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
  const postAcceptanceToggle = event.target.closest('[data-post-acceptance-task-toggle]');
  if (postAcceptanceToggle) { await handlePostAcceptanceTaskToggle(postAcceptanceToggle); return; }
  const postAcceptanceDelete = event.target.closest('[data-post-acceptance-task-delete]');
  if (postAcceptanceDelete) { await handlePostAcceptanceTaskDelete(postAcceptanceDelete); return; }
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
    document.querySelector('[data-profile-photo-input]')?.click();
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
  if (form.matches('[data-passport-onboarding-form]')) { event.preventDefault(); await handlePassportOnboardingSave(form); return; }
  if (form.matches('[data-student-passport-form]')) { event.preventDefault(); await handleStudentPassportSave(form); return; }
  if (form.matches('[data-success-story-form]')) { event.preventDefault(); await handleSuccessStorySubmit(form); return; }
  if (form.matches('[data-journey-story-form]')) { event.preventDefault(); await handleJourneyStorySubmit(form); return; }
  if (form.matches('[data-community-post-form]')) { event.preventDefault(); await handleCommunityPostSubmit(form); return; }
  if (form.matches('[data-saved-note-form]')) { event.preventDefault(); await handleSavedDecisionNote(form); return; }
  if (form.matches('[data-journey-stage-form]')) { event.preventDefault(); await handleJourneyStageSave(form); return; }
  if (form.matches('[data-journey-planning-form]')) { event.preventDefault(); await handleJourneyPlanningSave(form); return; }
  if (form.matches('[data-journey-task-form]')) { event.preventDefault(); await handleJourneyTaskAdd(form); return; }
  if (form.matches('[data-post-acceptance-plan-form]')) { event.preventDefault(); await handlePostAcceptancePlanningSave(form); return; }
  if (form.matches('[data-post-acceptance-task-form]')) { event.preventDefault(); await handlePostAcceptanceTaskAdd(form); return; }
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
      if (isSaved) {
        const journey = await removeSavedOpportunity(state.mode, state.user.uid, opportunityId);
        if (journey) currentJourneyStates.set(opportunityId, journey);
        else currentJourneyStates.delete(opportunityId);
      } else {
        const journey = await setOpportunitySaved(state.mode, state.user.uid, opportunity, true);
        if (journey) currentJourneyStates.set(opportunityId, journey);
      }
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

function journeyStageConfirmCopy(status) {
  if (status === 'applied') {
    return {
      title:'Confirm application submitted?',
      detail:'Only mark Applied after you actually submitted the application to the provider. Tefsen does not submit it for you.'
    };
  }
  if (status === 'interview') {
    return {
      title:'Confirm interview / review stage?',
      detail:'Use this only after the provider has moved your application into an interview, review or equivalent evaluation stage.'
    };
  }
  if (status === 'accepted') {
    return {
      title:'Confirm accepted outcome?',
      detail:'Only record Accepted after the provider has officially communicated the acceptance or offer.'
    };
  }
  if (status === 'rejected') {
    return {
      title:'Confirm rejected outcome?',
      detail:'Only record Rejected after the provider has communicated that outcome.'
    };
  }
  if (status === 'withdrawn') {
    return {
      title:'Confirm Journey withdrawn?',
      detail:'Use Withdrawn only when you have chosen not to continue this application.'
    };
  }
  return {
    title:`Change Journey stage to ${JOURNEY_LABELS[status] || status}?`,
    detail:'This should reflect what has actually happened in your application. You can use only the allowed Journey transitions.'
  };
}

async function handleJourneyStageSave(form) {
  const opportunityId = form.dataset.journeyStageForm || '';
  const status = String(new FormData(form).get('status') || '');
  if (!opportunityId || !status) return;

  const copy = journeyStageConfirmCopy(status);
  modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop>
    <section class="modal journey-stage-confirm-modal">
      <header class="modal-head"><h2>${escapeHTML(copy.title)}</h2><button class="close-btn" type="button" data-close-modal>${icon('close',19)}</button></header>
      <div class="modal-body">
        <p>${escapeHTML(copy.detail)}</p>
        <div class="journey-stage-confirm-note">${icon('info',16)}<span>Tefsen never changes your real application status automatically. This update records your manual confirmation only.</span></div>
        <div class="modal-actions">
          <button class="btn btn-secondary" type="button" data-close-modal>Cancel</button>
          <button class="btn btn-primary" type="button" data-confirm-journey-stage="${escapeHTML(status)}" data-opportunity-id="${escapeHTML(opportunityId)}">Confirm ${escapeHTML(JOURNEY_LABELS[status] || status)}</button>
        </div>
      </div>
    </section>
  </div>`;
}

async function confirmJourneyStageUpdate(button) {
  const opportunityId = String(button?.dataset?.opportunityId || '');
  const status = String(button?.dataset?.confirmJourneyStage || '');
  if (!opportunityId || !status) return;

  await withButton(button, async () => {
    try {
      await updateJourneyStage(state.mode, state.user.uid, opportunityId, status);
      modalRoot.innerHTML = '';
      toast('Journey stage updated.', 'success');
      await renderJourneyDetail(opportunityId);
    } catch (error) {
      toast(humanError(error), 'error');
    }
  });
}

function updateJourneyPlanningValidation(form) {
  const fd = new FormData(form);
  const draft = {
    status:String(form.dataset.journeyStatus || 'interested'),
    personalTargetDate:String(fd.get('personalTargetDate') || ''),
    officialDeadline:String(form.dataset.officialDeadline || ''),
    notes:String(fd.get('notes') || '')
  };
  const validation = validateJourneyPlanningDraft(draft);

  form.querySelectorAll('[data-journey-planning-error]').forEach(el => {
    el.hidden = true;
    el.textContent = '';
  });
  form.querySelectorAll('.field-error-state').forEach(el => el.classList.remove('field-error-state'));

  for (const error of validation.errors) {
    const field = form.elements.namedItem(error.field);
    if (field instanceof HTMLElement) field.classList.add('field-error-state');
    const errorEl = form.querySelector(`[data-journey-planning-error="${error.field}"]`);
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = error.message;
    }
  }

  const summary = form.querySelector('[data-journey-planning-summary]');
  if (summary) {
    const messages = [
      ...validation.errors.map(item => item.message),
      ...validation.warnings.map(item => item.message)
    ];
    summary.hidden = messages.length === 0;
    summary.classList.toggle('has-error', validation.errors.length > 0);
    summary.textContent = messages.join(' ');
  }

  const count = form.querySelector('[data-journey-notes-count]');
  const notes = form.elements.namedItem('notes');
  if (count && notes instanceof HTMLTextAreaElement) count.textContent = String(notes.value.length);

  return { draft, validation };
}

async function handleJourneyPlanningSave(form) {
  const opportunityId = form.dataset.journeyPlanningForm || '';
  const { draft, validation } = updateJourneyPlanningValidation(form);

  if (!validation.valid) {
    const firstError = validation.errors[0];
    const field = form.elements.namedItem(firstError?.field || '');
    if (field instanceof HTMLElement) field.focus();
    toast('Check the highlighted Journey planning field before saving.', 'error');
    return;
  }

  const submit = form.querySelector('button[type="submit"]');
  await withButton(submit, async () => {
    try {
      await updateJourneyPlanning(state.mode, state.user.uid, opportunityId, {
        personalTargetDate: draft.personalTargetDate,
        notes: draft.notes,
        officialDeadline: draft.officialDeadline
      });
      toast('Private Journey planning saved.', 'success');
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

function updatePostAcceptanceValidation(form) {
  const fd = new FormData(form);
  const draft = {
    offerDecision: String(fd.get('offerDecision') || 'reviewing'),
    offerResponseDate: String(fd.get('offerResponseDate') || ''),
    enrollmentDate: String(fd.get('enrollmentDate') || '')
  };
  const validation = validatePostAcceptanceDraft(draft);

  form.querySelectorAll('[data-post-acceptance-error]').forEach(el => {
    el.hidden = true;
    el.textContent = '';
  });
  form.querySelectorAll('.field-error-state').forEach(el => el.classList.remove('field-error-state'));

  for (const error of validation.errors) {
    const field = form.elements.namedItem(error.field);
    if (field instanceof HTMLElement) field.classList.add('field-error-state');
    const errorEl = form.querySelector('[data-post-acceptance-error="' + error.field + '"]');
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = error.message;
    }
  }

  const summary = form.querySelector('[data-post-acceptance-summary]');
  if (summary) {
    const messages = [
      ...validation.errors.map(item => item.message),
      ...validation.warnings.map(item => item.message)
    ];
    summary.hidden = messages.length === 0;
    summary.classList.toggle('has-error', validation.errors.length > 0);
    summary.textContent = messages.join(' ');
  }

  return { draft, validation };
}

async function handlePostAcceptancePlanningSave(form) {
  const opportunityId = form.dataset.postAcceptancePlanForm || '';
  const { draft, validation } = updatePostAcceptanceValidation(form);
  if (!opportunityId) return;

  if (!validation.valid) {
    const firstError = validation.errors[0];
    const field = form.elements.namedItem(firstError?.field || '');
    if (field instanceof HTMLElement) field.focus();
    toast('Check the highlighted next-stage planning field before saving.', 'error');
    return;
  }

  const submit = form.querySelector('button[type="submit"]');
  await withButton(submit, async () => {
    try {
      await updatePostAcceptancePlanning(state.mode, state.user.uid, opportunityId, draft);
      toast('Post-acceptance plan saved.', 'success');
      await renderJourneyDetail(opportunityId);
    } catch (error) {
      toast(humanError(error), 'error');
    }
  });
}

async function handlePostAcceptanceTaskToggle(button) {
  const opportunityId = String(button?.dataset?.opportunityId || '');
  const taskId = String(button?.dataset?.postAcceptanceTaskToggle || '');
  if (!opportunityId || !taskId) return;

  try {
    await togglePostAcceptanceTask(state.mode, state.user.uid, opportunityId, taskId);
    await renderJourneyDetail(opportunityId);
  } catch (error) {
    toast(humanError(error), 'error');
  }
}

async function handlePostAcceptanceTaskDelete(button) {
  const opportunityId = String(button?.dataset?.opportunityId || '');
  const taskId = String(button?.dataset?.postAcceptanceTaskDelete || '');
  if (!opportunityId || !taskId) return;

  try {
    await deletePostAcceptanceTask(state.mode, state.user.uid, opportunityId, taskId);
    toast('Next-stage task removed.', 'success');
    await renderJourneyDetail(opportunityId);
  } catch (error) {
    toast(humanError(error), 'error');
  }
}

async function handlePostAcceptanceTaskAdd(form) {
  const opportunityId = form.dataset.postAcceptanceTaskForm || '';
  const fd = new FormData(form);
  const label = String(fd.get('label') || '').trim();
  const category = String(fd.get('category') || 'custom');
  if (!opportunityId || !label) return;

  const submit = form.querySelector('button[type="submit"]');
  await withButton(submit, async () => {
    try {
      await addPostAcceptanceTask(state.mode, state.user.uid, opportunityId, label, category);
      toast('Next-stage task added.', 'success');
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
function updatePublicProfileValidation(form) {
  const fd = new FormData(form);
  const draft = {
    fullName:String(fd.get('fullName') || ''),
    username:String(fd.get('username') || ''),
    bio:String(fd.get('bio') || '')
  };
  const validation = validatePublicProfileDraft(draft);

  form.querySelectorAll('[data-profile-error]').forEach(el => {
    el.hidden = true;
    el.textContent = '';
  });
  form.querySelectorAll('.field-error-state').forEach(el => el.classList.remove('field-error-state'));

  for (const error of validation.errors) {
    const field = form.elements.namedItem(error.field);
    if (field instanceof HTMLElement) field.classList.add('field-error-state');
    const errorEl = form.querySelector('[data-profile-error="' + error.field + '"]');
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = error.message;
    }
  }

  const bioCount = form.querySelector('[data-profile-bio-count]');
  const bio = form.elements.namedItem('bio');
  if (bioCount && bio instanceof HTMLTextAreaElement) bioCount.textContent = String(bio.value.length);

  const summary = form.querySelector('[data-profile-summary]');
  if (summary) {
    const messages = [
      ...validation.errors.map(item => item.message),
      ...validation.warnings.map(item => item.message)
    ];
    summary.hidden = messages.length === 0;
    summary.classList.toggle('has-error', validation.errors.length > 0);
    summary.textContent = messages.join(' ');
  }

  return { draft:validation.value, validation };
}

async function handleProfileSave(form) {
  const fd = new FormData(form);
  const { draft, validation } = updatePublicProfileValidation(form);
  if (!validation.valid) {
    const first = validation.errors[0];
    const field = form.elements.namedItem(first?.field || '');
    if (field instanceof HTMLElement) field.focus();
    toast('Check the highlighted public profile field before saving.', 'error');
    return;
  }

  const submit = form.querySelector('button[type="submit"]');
  const selectedPhoto = fd.get('profileImage');
  await withButton(submit, async () => {
    try {
      const profile = await updateUserProfile(state.mode, state.user.uid, {
        fullName:draft.fullName,
        username:draft.username,
        bio:draft.bio,
        profileImageFile:selectedPhoto instanceof File && selectedPhoto.size ? selectedPhoto : null
      });
      state.profile = { ...state.profile, ...profile };
      state.posts = state.posts.map(post => post.authorId === state.user.uid
        ? { ...post, authorName:profile.fullName, authorPhotoUrl:profile.photoUrl || '' }
        : post);
      const input = form.querySelector('[data-profile-photo-input]');
      if (input?.dataset?.previewUrl) URL.revokeObjectURL(input.dataset.previewUrl);
      modalRoot.innerHTML = '';
      toast(selectedPhoto instanceof File && selectedPhoto.size ? 'Public profile and photo updated.' : 'Public profile updated.', 'success');
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
async function handlePassportOnboardingSave(form) {
  const step = Number(form.dataset.currentStep || 0);
  if (!validatePassportOnboardingStep(form, step)) return;

  const fd = new FormData(form);
  const submit = form.querySelector('[data-passport-onboarding-submit]');
  const preferredCountries = String(fd.get('preferredCountries') || '').split(',').map(value => value.trim()).filter(Boolean);
  const base = currentStudentPassport || emptyStudentPassport(state.user.uid);
  const input = {
    ...base,
    currentCountry: String(fd.get('currentCountry') || '').trim(),
    nationality: String(fd.get('nationality') || '').trim(),
    currentEducationLevel: String(fd.get('currentEducationLevel') || '').trim(),
    targetEducationLevel: String(fd.get('targetEducationLevel') || '').trim(),
    mainField: String(fd.get('mainField') || '').trim(),
    studyGoal: String(fd.get('studyGoal') || '').trim(),
    fundingPreference: String(fd.get('fundingPreference') || '').trim(),
    preferredCountries,
    onboardingStatus: 'completed'
  };

  await withButton(submit, async () => {
    try {
      currentStudentPassport = await saveStudentPassport(state.mode, state.user.uid, input);
      passportOnboardingJustCompleted = true;
      toast('Your Student Passport is ready.', 'success');
      await renderStudentPassport();
    } catch (error) {
      const errorEl = form.querySelector('[data-passport-onboarding-error]');
      if (errorEl) errorEl.textContent = humanError(error);
      else toast(humanError(error), 'error');
    }
  });
}

async function handlePassportOnboardingSkip(button, form = null) {
  const current = currentStudentPassport || emptyStudentPassport(state.user.uid);
  const fd = form ? new FormData(form) : null;
  const preferredCountries = fd
    ? String(fd.get('preferredCountries') || '').split(',').map(value => value.trim()).filter(Boolean)
    : current.preferredCountries;

  const partial = fd ? {
    currentCountry: String(fd.get('currentCountry') || current.currentCountry || '').trim(),
    nationality: String(fd.get('nationality') || current.nationality || '').trim(),
    currentEducationLevel: String(fd.get('currentEducationLevel') || current.currentEducationLevel || '').trim(),
    targetEducationLevel: String(fd.get('targetEducationLevel') || current.targetEducationLevel || '').trim(),
    mainField: String(fd.get('mainField') || current.mainField || '').trim(),
    studyGoal: String(fd.get('studyGoal') || current.studyGoal || '').trim(),
    fundingPreference: String(fd.get('fundingPreference') || current.fundingPreference || '').trim(),
    preferredCountries
  } : {};

  await withButton(button, async () => {
    try {
      currentStudentPassport = await saveStudentPassport(state.mode, state.user.uid, {
        ...current,
        ...partial,
        onboardingStatus: 'skipped'
      });
      passportOnboardingJustCompleted = false;
      toast('Your progress is saved. You can finish Student Passport anytime.', 'success');
      go('opportunities');
    } catch (error) {
      toast(humanError(error), 'error');
    }
  });
}

async function handleStudentPassportSave(form) {
  const submit = form.querySelector('button[type="submit"]');
  const { draft, validation } = updateStudentPassportFormQuality(form, { dirty:false });

  if (!validation.valid) {
    const firstError = validation.errors[0];
    const field = form.elements.namedItem(firstError.field);
    const fieldEl = field instanceof RadioNodeList ? field[0] : field;
    fieldEl?.focus?.();
    toast('Check the highlighted Student Passport field before saving.', 'error');
    return;
  }

  await withButton(submit, async () => {
    try {
      currentStudentPassport = await saveStudentPassport(state.mode, state.user.uid, draft);
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
  const passportForm = event.target.closest?.('[data-student-passport-form]');
  if (passportForm) {
    updateStudentPassportFormQuality(passportForm);
    return;
  }

  if (event.target.matches('[data-opportunity-filter]')) {
    const key = event.target.dataset.opportunityFilter;
    if (key && key in opportunityDiscoveryFilters) {
      opportunityDiscoveryFilters[key] = String(event.target.value || 'all');
      applyOpportunityDiscoveryFilters();
    }
    return;
  }

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
    const stateEl = input.form?.querySelector('[data-profile-photo-state]');
    if (stateEl) stateEl.textContent = 'Preview selected — save profile to publish this photo';
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
document.addEventListener('input', event => {
  if (event.target.matches('[data-opportunity-search]')) {
    opportunityDiscoveryFilters.query = String(event.target.value || '').trim();
    applyOpportunitySearchDebounced();
    return;
  }
  const passportForm = event.target.closest?.('[data-student-passport-form]');
  if (passportForm) {
    updateStudentPassportFormQuality(passportForm);
    return;
  }
  const journeyPlanningForm = event.target.closest?.('[data-journey-planning-form]');
  if (journeyPlanningForm) {
    updateJourneyPlanningValidation(journeyPlanningForm);
    return;
  }
  const postAcceptanceForm = event.target.closest?.('[data-post-acceptance-plan-form]');
  if (postAcceptanceForm) {
    updatePostAcceptanceValidation(postAcceptanceForm);
    return;
  }
  const profileForm = event.target.closest?.('[data-profile-form]');
  if (profileForm) updatePublicProfileValidation(profileForm);
});
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==='k') { event.preventDefault(); document.querySelector('[data-global-search-form] input')?.focus(); }
  if (event.key==='Escape' && modalRoot.innerHTML) modalRoot.innerHTML='';
  if (event.key==='Escape' && state.ui.profileMenu) { state.ui.profileMenu = false; syncProfileMenu(); }
});

if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

boot();
