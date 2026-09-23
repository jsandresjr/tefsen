import { initFirebase, appCheck } from './firebase-client.js';
import { state, setState } from './store.js';
import { observeAuth, signIn, register, signInGoogle, resetPassword, logout } from './services/auth-service.js';
import {
  getProfile, subscribePosts, createPost, deletePost, getPost, getReactionIds, getSavedCommunityPosts, toggleLike, toggleSave,
  subscribeComments, addComment, getNotifications, getNotificationReadIds, getSyncedNotificationReadIds, markNotificationRead, markNotificationsRead,
  getUserSettings, saveUserSettings,
  searchAll, updateUserProfile, removeProfilePhoto,
  normalizeUser, getUserById, getWebPostingPolicy, getDailyPostUsage,
  hydratePostLikeState
} from './services/data-service.js';
import { getOpportunities, getOpportunityById, getOpportunitySearchCorpus } from './services/opportunity-service.js';
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
import { buildSuccessStoryModel, validateSuccessStoryDraft } from './services/success-story-service.js';
import { buildJourneyStoryModel, validateJourneyStoryDraft } from './services/journey-story-service.js';
import { buildGlobalSearchModel, mergeSearchPublicPosts } from './services/global-search-service.js';
import { buildNotificationCenterModel } from './services/notification-service.js';
import { buildSavedCommunityModel } from './services/saved-community-service.js';
import { buildAppCheckReadiness } from './services/app-check-readiness-service.js';
import { buildPrivacyRequestMailto } from './services/privacy-request-service.js';
import {
  defaultUserSettings, normalizeUserSettings, buildSettingsModel,
  applyNotificationPreferences, applyRuntimeSettings
} from './services/settings-service.js';
import { postAcceptancePanelMarkup } from './post-acceptance-view.js';
import {
  buildCommunityHomeModel, buildIntakeCommunityModel, buildSubjectCommunities, buildSubjectCommunityModel,
  buildUniversityCommunities, buildUniversityCommunityModel,
  subjectCommunityData, universityCommunityData, intakeCommunityData
} from './services/community-service.js';
import {
  getAdminCapability, opportunityFreshness, parseOpportunityImport,
  markImportDuplicates, listAdminOpportunities, reviewOpportunity,
  importOpportunityRecords
} from './services/opportunity-admin-service.js';
import { REPORT_REASONS, buildModerationQueue } from './services/moderation-model.js';
import { submitPostReport, listAdminReports, reviewReport } from './services/moderation-service.js';
import {
  icon, escapeHTML, nl2br, initials, safeUrl, relativeTime, formatCount, debounce,
  routeParts, go, toast, copyText, roleClass, normalizeRole
} from './utils.js';

const root = document.getElementById('app-root');
const modalRoot = document.getElementById('modal-root');
const skipLink = document.querySelector('.skip-link');
const DIALOG_FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let modalReturnFocus = null;
let modalActive = false;
let modalHeadingCounter = 0;

function currentDialog() {
  return modalRoot.querySelector('.modal');
}

let accessibleFieldCounter = 0;

function normalizeRenderedAccessibility(scope) {
  if (!scope?.querySelectorAll) return;

  scope.querySelectorAll('.field').forEach(field => {
    const label = field.querySelector('label');
    const control = field.querySelector('input:not([type="hidden"]), select, textarea');
    if (!label || !control) return;

    if (!control.id) control.id = `tefsen-field-${++accessibleFieldCounter}`;
    if (!label.hasAttribute('for')) label.setAttribute('for', control.id);
  });

  scope.querySelectorAll('.form-error, .field-error').forEach(error => {
    if (!error.hasAttribute('role')) error.setAttribute('role','status');
    if (!error.hasAttribute('aria-live')) error.setAttribute('aria-live','polite');
  });
}

function dialogFocusableElements(dialog = currentDialog()) {
  if (!dialog) return [];
  return [...dialog.querySelectorAll(DIALOG_FOCUSABLE_SELECTOR)]
    .filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
}

function normalizeDialogAccessibility(dialog) {
  if (!dialog) return;
  dialog.setAttribute('role','dialog');
  dialog.setAttribute('aria-modal','true');

  const heading = dialog.querySelector('h1, h2, h3');
  if (!dialog.hasAttribute('aria-label') && !dialog.hasAttribute('aria-labelledby') && heading) {
    if (!heading.id) heading.id = `tefsen-dialog-title-${++modalHeadingCounter}`;
    dialog.setAttribute('aria-labelledby', heading.id);
  }

  dialog.querySelectorAll('[data-close-modal]').forEach(button => {
    if (button.tagName === 'BUTTON' && !button.hasAttribute('type')) button.setAttribute('type','button');
    if (button.classList.contains('close-btn') && !button.hasAttribute('aria-label')) {
      button.setAttribute('aria-label','Close dialog');
    }
  });

  if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex','-1');
}

function activateModalAccessibility() {
  const dialog = currentDialog();
  if (!dialog) return;
  if (!modalActive) {
    modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modalActive = true;
  }
  root.inert = true;
  if (skipLink) skipLink.inert = true;
  normalizeDialogAccessibility(dialog);
  normalizeRenderedAccessibility(dialog);

  queueMicrotask(() => {
    const activeDialog = currentDialog();
    if (!activeDialog) return;
    const preferred = activeDialog.querySelector('[autofocus], input:not([type="hidden"]), select, textarea, button, a[href]');
    (preferred || activeDialog).focus({ preventScroll:true });
  });
}

function deactivateModalAccessibility() {
  if (!modalActive) return;
  modalActive = false;
  root.inert = false;
  if (skipLink) skipLink.inert = false;
  const returnTarget = modalReturnFocus;
  modalReturnFocus = null;
  queueMicrotask(() => {
    if (returnTarget instanceof HTMLElement && returnTarget.isConnected) {
      returnTarget.focus({ preventScroll:true });
    }
  });
}

function trapModalKeyboard(event) {
  const dialog = currentDialog();
  if (!dialog) return false;

  if (event.key === 'Escape') {
    event.preventDefault();
    modalRoot.innerHTML = '';
    return true;
  }

  if (event.key !== 'Tab') return false;
  const focusable = dialogFocusableElements(dialog);
  if (!focusable.length) {
    event.preventDefault();
    dialog.focus();
    return true;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && (active === first || !dialog.contains(active))) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && (active === last || !dialog.contains(active))) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

const modalAccessibilityObserver = new MutationObserver(() => {
  currentDialog() ? activateModalAccessibility() : deactivateModalAccessibility();
});
modalAccessibilityObserver.observe(modalRoot,{ childList:true });
let stopAuth = null;
let stopPosts = null;
let stopComments = null;
let reactionState = { saved: new Set(), liked: new Set() };
let currentComments = [];
let currentSearch = { users: [], posts: [] };
const likeRequests = new Set();
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
let currentAdminReports = [];
let adminPreviewRows = [];
let adminImportSource = '';
let adminTab = 'review';
let settingsTab = 'overview';
let currentUserSettings = defaultUserSettings();
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
  ['saved', 'Saved community', 'bookmark'],
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

function browserTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; }
  catch { return ''; }
}

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
  reactionState = { saved: new Set(), liked: new Set() };
  currentStudentPassport = null;
  passportOnboardingJustCompleted = false;
  currentSavedWorkspace = null;
  savedOpportunityCompareIds = new Set();
  adminCapability = false;
  currentAdminOpportunities = [];
  currentAdminReports = [];
  adminPreviewRows = [];
  adminImportSource = '';
  currentUserSettings = defaultUserSettings({ timeZone: browserTimeZone() });
  applyRuntimeSettings(currentUserSettings);
  setState({ user, profile: null, posts: [], notifications: [], unreadCount: 0 });

  if (!user) {
    renderAuth('login');
    return;
  }

  root.innerHTML = loadingScreen('Loading your Tefsen space…');
  try {
    const [profile, userSettings, reactions, activityNotifications, notificationReadIds, passport, notificationJourneys, notificationOpportunities] = await Promise.all([
      getProfile(state.mode, user).catch(() => normalizeUser({ uid: user.uid, fullName: user.displayName || user.email || 'Tefsen User', email: user.email || '' }, user.uid)),
      getUserSettings(state.mode, user.uid).catch(() => defaultUserSettings({ timeZone: browserTimeZone() })),
      getReactionIds(state.mode, user.uid).catch(() => ({ saved: new Set(), liked: new Set() })),
      getNotifications(state.mode, user.uid).catch(() => []),
      getSyncedNotificationReadIds(state.mode, user.uid).catch(() => getNotificationReadIds(user.uid)),
      getStudentPassport(state.mode, user.uid).catch(() => emptyStudentPassport(user.uid)),
      listJourneyStates(state.mode, user.uid).catch(() => []),
      getOpportunities(state.mode).catch(() => [])
    ]);
    currentUserSettings = normalizeUserSettings(userSettings, { timeZone: browserTimeZone() });
    applyRuntimeSettings(currentUserSettings);
    const notificationModel = applyNotificationPreferences(buildNotificationCenterModel({
      activityNotifications,
      journeys:notificationJourneys,
      opportunities:notificationOpportunities,
      readIds:notificationReadIds,
      now:new Date()
    }), currentUserSettings);
    currentStudentPassport = passport;
    reactionState = reactions;
    setState({
      profile,
      notifications:notificationModel.items,
      unreadCount:notificationModel.unreadCount
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
  return `<main id="app-main" tabindex="-1" style="min-height:100vh;display:grid;place-items:center;padding:24px"><div style="text-align:center;color:#9fb1c6"><img src="assets/tefsen-logo.png" alt="Tefsen" style="width:86px;height:86px;object-fit:contain;border-radius:24px;margin-bottom:16px"><div>${escapeHTML(text)}</div></div></main>`;
}

function renderAuth(mode = 'login') {
  const isRegister = mode === 'register';
  root.innerHTML = `
    <main id="app-main" class="auth-page" tabindex="-1">
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
  normalizeRenderedAccessibility(root);
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
            <input name="q" value="${escapeHTML(state.searchQuery)}" placeholder="Search students, stories and community…" aria-label="Search Tefsen" aria-keyshortcuts="Control+K Meta+K">
            <span class="search-kbd" aria-hidden="true">Ctrl/⌘ K</span>
          </form>
        </div>
        <div class="topbar-actions">
          ${quickThemeButtonMarkup()}
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
        <nav class="nav-list" aria-label="Account and saved navigation">
          ${navItems.filter(([id]) => ['saved','notifications','profile','settings'].includes(id)).map(([id,label,ic]) => navButton(id,label,ic,route)).join('')}${adminCapability ? navButton('admin','Admin review','settings',route) : ''}
        </nav>
        <button class="sidebar-profile" type="button" data-route="profile">
          ${avatar(p,'sm')}
          <span style="min-width:0;text-align:left"><b>${escapeHTML(p.fullName || 'Tefsen User')}</b><small>${escapeHTML(normalizeRole(p.role || 'Student'))}</small></span>
        </button>
      </aside>

      ${rightContent ? `<aside class="rightbar">${rightContent}</aside>` : ''}

      <main id="app-main" class="main-area" tabindex="-1"><div class="content-wrap ${options.wide ? 'wide' : ''}">${content}</div></main>

      <nav class="mobile-bottom" aria-label="Mobile navigation">
        ${mobileNavButton('home','home',route,'Home')}
        ${mobileNavButton('opportunities','compass',route,'Opportunities')}
        ${mobileNavButton('passport','user',route,'Student Passport')}
        ${mobileNavButton('journeys','check',route,'Journey')}
        ${mobileNavButton('explore','compass',route,'Community')}
      </nav>
    </div>
    ${state.ui.profileMenu ? renderProfileDropdown() : ''}`;
  normalizeRenderedAccessibility(root);
}

function navButton(id, label, ic, route) {
  const active = id === route || (id === 'saved' && state.activeFeedTab === 'saved' && route === 'home');
  return `<button class="nav-item ${active ? 'active' : ''}" type="button" data-route="${id}"${active ? ' aria-current="page"' : ''}><span class="nav-icon">${icon(ic,20)}</span><span>${escapeHTML(label)}</span>${id === 'notifications' && state.unreadCount ? `<span class="badge-dot" style="position:static;margin-left:auto;border:0">${Math.min(99,state.unreadCount)}</span>` : ''}</button>`;
}

function mobileNavButton(id, ic, route, label) {
  const active = route === id;
  return `<button class="${active ? 'active' : ''}" type="button" data-route="${id}" aria-label="${label}"${active ? ' aria-current="page"' : ''}>${icon(ic,21)}</button>`;
}

function renderProfileDropdown() {
  const p = state.profile || {};
  const rawRole = String(p.role || 'Student');
  const isAdmin = adminCapability === true;
  const role = isAdmin ? 'Admin' : (rawRole.trim().toLowerCase() === 'admin' ? 'Student' : normalizeRole(rawRole));
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
      <button type="button" data-route="settings" role="menuitem">${icon('settings',17)} <span>Settings</span><small>Account, privacy and preferences</small></button>
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
    <div class="footer-mini"><a href="../privacy-policy/">Privacy</a> · <a href="../terms.html">Terms</a> · <a href="../delete-account/">Delete account</a><br>© ${new Date().getFullYear()} Tefsen</div>`;
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
    const model=buildSuccessStoryModel(post);
    const previewFacts=(model?.facts || [])
      .filter(([label])=>['University','Scholarship / program / offer','Funding','Intake / year'].includes(label))
      .slice(0,4);
    return `
      <div class="success18-card-top">${postTypeBadgeMarkup(post)}<span>Student-shared outcome</span></div>
      ${previewFacts.length ? `<div class="success18-card-facts">${previewFacts.map(([label,value]) => `<div><small>${escapeHTML(label)}</small><b>${escapeHTML(value)}</b></div>`).join('')}</div>` : ''}
      <div class="success18-card-note">Personal experience · open the story for full context and verification guidance.</div>`;
  }
  if (post.postType === 'journey_story') {
    const model=buildJourneyStoryModel(post);
    const milestones=(model?.milestones || []).slice(0,3);
    return `
      <div class="journey19-card-top">${postTypeBadgeMarkup(post)}<span>Selected public milestones</span></div>
      ${milestones.length ? `<div class="journey19-card-timeline">${milestones.map(item => `<div><span></span><p><b>${escapeHTML(item.stage || 'Milestone')}</b>${item.month ? `<small>${escapeHTML(item.month)}</small>` : ''}</p></div>`).join('')}</div>` : ''}
      <div class="journey19-card-note">Public story only · private Tefsen Journey data is not shown automatically.</div>`;
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

async function renderSavedCommunity() {
  renderShell(`<div class="saved24-page"><section class="saved24-hero loading"><span class="opportunity-kicker">SAVED COMMUNITY</span><h1>Loading your saved posts…</h1><p>Checking your private saved list independently of the current Community feed.</p></section></div>`,{wide:true,right:false});

  try{
    const loaded=await getSavedCommunityPosts(state.mode,state.user.uid,state.posts);
    reactionState.saved=new Set(loaded.savedIds||[]);
    const model=buildSavedCommunityModel({
      posts:loaded.posts,
      referenceCount:loaded.referenceCount,
      staleCount:loaded.staleCount
    });

    const section=(title,eyebrow,posts,description)=>posts.length ? `<section class="saved24-section">
      <header class="saved24-section-head">
        <div><span class="opportunity-kicker">${escapeHTML(eyebrow)}</span><h2>${escapeHTML(title)}</h2><p>${escapeHTML(description)}</p></div>
        <span>${posts.length}</span>
      </header>
      <div class="saved24-list">${posts.map(postCard).join('')}</div>
    </section>` : '';

    const content=`${demoBanner()}
      <div class="saved24-page">
        <section class="saved24-hero">
          <div>
            <span class="opportunity-kicker">PRIVATE COMMUNITY LIBRARY</span>
            <h1>Keep useful Community posts without losing them in the feed.</h1>
            <p>Save public discussions, Success stories and Journey stories for your own later review. Your saved list is private account data and is separate from saved opportunities.</p>
            <div class="saved24-hero-actions">
              <button class="btn btn-primary" type="button" data-route="explore">${icon('compass',17)} Explore Community</button>
              <button class="btn btn-secondary" type="button" data-route="journeys">Saved opportunities & Journeys</button>
            </div>
          </div>
          <aside class="saved24-scope">
            <span>WHAT SAVING MEANS</span>
            <div><b>Private to your account</b><small>${escapeHTML(model.privacyNote)}</small></div>
            <div><b>Separate from applications</b><small>${escapeHTML(model.distinctionNote)}</small></div>
            <div><b>Public content can change</b><small>If a post is hidden or deleted later, Tefsen will not expose it just because you saved it earlier.</small></div>
          </aside>
        </section>

        <section class="saved24-stats" aria-label="Saved Community summary">
          <article><strong>${model.counts.saved}</strong><span>Available saved posts</span></article>
          <article><strong>${model.counts.discussions}</strong><span>Discussions</span></article>
          <article><strong>${model.counts.successStories}</strong><span>Success stories</span></article>
          <article><strong>${model.counts.journeyStories}</strong><span>Journey stories</span></article>
        </section>

        ${model.staleCount ? `<section class="saved24-unavailable">${icon('info',16)}<span>${model.staleCount} saved reference${model.staleCount===1?' is':'s are'} unavailable because the post no longer resolves as public content.</span></section>` : ''}

        ${model.empty ? `<section class="saved24-empty">
          <div>${icon('bookmark',25)}</div>
          <h2>No saved Community posts yet</h2>
          <p>Use Save on a useful public discussion, Success story or Journey story. Saved Opportunities remain in your separate Journey workspace.</p>
          <button class="btn btn-primary" type="button" data-route="explore">Find useful Community posts</button>
        </section>` : `
          ${section('Saved discussions','LEARNING & QUESTIONS',model.discussions,'Public discussions you chose to keep for later review.')}
          ${section('Saved student outcomes','STUDENT EXPERIENCES',model.outcomes,'Success and Journey stories add context, but they do not replace official provider information.')}
        `}
      </div>`;

    renderShell(content,{wide:true,right:false});
  }catch(error){
    console.error(error);
    renderShell(`${demoBanner()}${emptyState('info','Saved Community unavailable','Please try again.')}`,{wide:true,right:false});
  }
}

async function renderExplore() {
  renderShell(`<div class="community15-page"><section class="community15-hero loading"><div><span class="opportunity-kicker">STUDENT COMMUNITY</span><h1>Loading useful discussions…</h1><p>Preparing public discussions, communities and student outcomes.</p></div></section></div>`, { wide:true, right:false });
  try {
    const opportunities = await getOpportunities(state.mode).catch(() => []);
    const model = buildCommunityHomeModel(state.posts, opportunities);

    const discussionCards = model.discussions.length
      ? model.discussions.map(post => postCard(post)).join('')
      : `<section class="community15-empty"><div>${icon('comment',22)}</div><h3>No public discussions yet.</h3><p>Start with a real question, explanation or study insight that could help another student.</p><button class="btn btn-primary" type="button" data-action="compose">Start a discussion</button></section>`;

    const unanswered = model.unanswered.length
      ? `<section class="community15-response-panel">
          <header><div><span class="opportunity-kicker">NEEDS A RESPONSE</span><h2>Questions with no public replies yet</h2><p>Help another student if you genuinely know something useful.</p></div></header>
          <div class="community15-response-list">
            ${model.unanswered.map(post => `<button type="button" data-route="post/${encodeURIComponent(post.id)}">
              <span>${escapeHTML(post.subject || 'General')}</span>
              <strong>${escapeHTML(post.title || (post.content || '').slice(0,110) || 'Student question')}</strong>
              <small>Open discussion →</small>
            </button>`).join('')}
          </div>
        </section>`
      : '';

    const subjectCards = model.subjects.length
      ? model.subjects.map(row => `<button class="community15-topic-card" type="button" data-route="subject/${encodeURIComponent(row.name)}">
          <span class="community15-topic-icon">${icon('compass',18)}</span>
          <div><h3>${escapeHTML(row.name)}</h3><p>${row.postCount} public post${row.postCount===1?'':'s'} · ${row.opportunityCount} linked opportunit${row.opportunityCount===1?'y':'ies'}</p></div>
          <span>→</span>
        </button>`).join('')
      : `<div class="community15-inline-empty">Subject spaces will appear as public discussions and verified opportunities grow.</div>`;

    const universityCards = model.universities.length
      ? model.universities.map(row => `<button class="community15-university-card" type="button" data-route="university/${encodeURIComponent(row.name)}">
          <div><span>UNIVERSITY COMMUNITY</span><h3>${escapeHTML(row.name)}</h3><p>${row.countries.length ? escapeHTML(row.countries.join(', ')) : 'Global student community'}</p></div>
          <small>${row.postCount} posts · ${row.opportunityCount} opportunities →</small>
        </button>`).join('')
      : `<div class="community15-inline-empty">University spaces appear when verified opportunity or public student data links to them.</div>`;

    const outcomes = model.outcomes.length
      ? model.outcomes.map(post => `<button class="community15-outcome-card" type="button" data-route="post/${encodeURIComponent(post.id)}">
          <span>${post.postType === 'success_story' ? 'SUCCESS STORY' : 'JOURNEY STORY'}</span>
          <h3>${escapeHTML(post.title || 'Student experience')}</h3>
          <p>${escapeHTML((post.content || '').slice(0,170))}</p>
          <small>Shared voluntarily by a student →</small>
        </button>`).join('')
      : `<section class="community15-inline-empty"><b>No public outcome stories yet.</b><span>Students can choose to share success stories or selected Journey milestones.</span></section>`;

    const content = `${demoBanner()}
      <div class="community15-page">
        <section class="community15-hero">
          <div class="community15-hero-copy">
            <span class="opportunity-kicker">STUDENT COMMUNITY</span>
            <h1>Ask better questions. Share what actually helps.</h1>
            <p>Tefsen Community connects student discussions, subject spaces, university communities and voluntarily shared outcomes. Experiences add context; official provider sources still control requirements, deadlines and eligibility.</p>
            <div class="community15-hero-actions">
              <button class="btn btn-primary" type="button" data-action="compose">${icon('plus',16)} Ask or share knowledge</button>
              <button class="btn btn-secondary" type="button" data-share-success>Share a success</button>
              <button class="btn btn-ghost" type="button" data-share-journey-story>Share selected Journey milestones</button>
            </div>
          </div>
          <aside class="community15-purpose">
            <span>WHAT BELONGS HERE</span>
            <div><b>Questions</b><small>Specific things you are trying to understand.</small></div>
            <div><b>Explanations</b><small>Useful knowledge, study methods and lessons learned.</small></div>
            <div><b>Student experiences</b><small>Voluntary outcomes and selected Journey stories—not official guidance.</small></div>
          </aside>
        </section>

        <section class="community15-stats" aria-label="Community summary">
          <article><strong>${model.counts.discussions || '—'}</strong><span>Public discussions</span></article>
          <article><strong>${model.counts.subjectCommunities || '—'}</strong><span>Subject spaces</span></article>
          <article><strong>${model.counts.universityCommunities || '—'}</strong><span>University spaces</span></article>
          <article><strong>${model.counts.outcomes || '—'}</strong><span>Shared outcomes</span></article>
        </section>

        <section class="community15-section">
          <header class="community15-section-head">
            <div><span class="opportunity-kicker">DISCUSSIONS</span><h2>Active student conversations</h2><p>Ordered using public engagement signals such as replies, saves and likes—not an accuracy or quality score.</p></div>
            <button class="btn btn-secondary" type="button" data-action="compose">Start discussion</button>
          </header>
          <div class="community15-feed">${discussionCards}</div>
        </section>

        ${unanswered}

        <section class="community15-section">
          <header class="community15-section-head">
            <div><span class="opportunity-kicker">EXPLORE BY SUBJECT</span><h2>Find the field you care about</h2><p>Subject spaces connect student conversations with relevant verified-source opportunities.</p></div>
          </header>
          <div class="community15-topic-grid">${subjectCards}</div>
        </section>

        <section class="community15-section">
          <header class="community15-section-head">
            <div><span class="opportunity-kicker">UNIVERSITY SPACES</span><h2>Explore student context around institutions</h2><p>See public conversations and linked opportunities without treating community posts as official university information.</p></div>
          </header>
          <div class="community15-university-grid">${universityCards}</div>
        </section>

        <section class="community15-section">
          <header class="community15-section-head">
            <div><span class="opportunity-kicker">STUDENT OUTCOMES</span><h2>Experiences, not promises</h2><p>Success and Journey stories are voluntarily shared by students. They do not prove current eligibility, funding or admission requirements.</p></div>
            <div class="community15-outcome-actions"><button class="btn btn-secondary" type="button" data-share-success>Share success</button><button class="btn btn-ghost" type="button" data-share-journey-story>Share Journey story</button></div>
          </header>
          <div class="community15-outcome-grid">${outcomes}</div>
        </section>
      </div>`;
    renderShell(content, { wide:true, right:false });
  } catch (error) {
    console.error(error);
    renderShell(`${demoBanner()}${emptyState('info','Community unavailable','Please try again.')}`, { wide:true, right:false });
  }
}

function communityOpportunityList(items = []) {
  return items.length ? `<div class="community-compact-list">${items.slice(0,8).map(item => `<button class="community-compact-item" style="text-align:left;color:inherit;cursor:pointer" type="button" data-route="opportunity/${encodeURIComponent(item.id)}"><h4>${escapeHTML(item.title)}</h4><p>${escapeHTML(item.fundingType)} · ${escapeHTML(item.country)}${item.intake ? ` · ${escapeHTML(item.intake)}` : ''}</p></button>`).join('')}</div>` : '<p style="color:var(--muted)">No linked opportunities yet.</p>';
}

async function renderSubjectCommunity(subjectName) {
  const subject = String(subjectName || '').trim();
  renderShell(`<div class="community16-page"><section class="community16-hero loading"><span class="opportunity-kicker">SUBJECT COMMUNITY</span><h1>${escapeHTML(subject || 'Subject')}</h1><p>Loading public discussions and linked opportunities…</p></section></div>`, { wide:true, right:false });

  try {
    const opportunities = await getOpportunities(state.mode).catch(() => []);
    const data = buildSubjectCommunityModel(subject, state.posts, opportunities);

    const discussions = data.discussions.length
      ? data.discussions.map(postCard).join('')
      : `<section class="community16-empty"><div>${icon('comment',22)}</div><h3>No public discussions in ${escapeHTML(data.name)} yet.</h3><p>Start with a specific question, explanation or study insight that could help another student in this field.</p><button class="btn btn-primary" type="button" data-community-discussion data-community-subject="${escapeHTML(data.name)}">Start a subject discussion</button></section>`;

    const unanswered = data.unanswered.length
      ? `<section class="community16-unanswered">
          <header><div><span class="opportunity-kicker">NEEDS A RESPONSE</span><h2>Help with an unanswered ${escapeHTML(data.name)} question</h2><p>Reply only when you can add useful knowledge or a clear learning path.</p></div><span>${data.counts.unanswered}</span></header>
          <div>
            ${data.unanswered.slice(0,4).map(post => `<button type="button" data-route="post/${encodeURIComponent(post.id)}">
              <strong>${escapeHTML(post.title || (post.content || '').slice(0,120) || 'Student question')}</strong>
              <small>${formatCount(post.likeCount || 0)} likes · ${formatCount(post.saveCount || 0)} saves · no public replies</small>
              <span>Open →</span>
            </button>`).join('')}
          </div>
        </section>`
      : `<section class="community16-calm-note">${icon('check',17)} <span>There are no unanswered public discussions in this subject right now.</span></section>`;

    const opportunityCards = data.opportunities.length
      ? data.opportunities.slice(0,8).map(item => `<button class="community16-opportunity-card" type="button" data-route="opportunity/${encodeURIComponent(item.id)}">
          <div class="community16-opportunity-top">
            <span>LINKED OPPORTUNITY</span>
            <small>${escapeHTML(item.fundingType || 'Funding varies')}</small>
          </div>
          <h3>${escapeHTML(item.title || 'Opportunity')}</h3>
          <p>${escapeHTML(item.provider || item.providerName || item.university || 'Provider')}</p>
          <div class="community16-opportunity-meta">
            ${item.country ? `<span>${escapeHTML(item.country)}</span>` : ''}
            ${item.studyLevel ? `<span>${escapeHTML(item.studyLevel)}</span>` : ''}
            ${item.intake ? `<span>${escapeHTML(item.intake)}</span>` : ''}
          </div>
          <small class="community16-open">Review opportunity →</small>
        </button>`).join('')
      : `<section class="community16-inline-empty"><b>No linked opportunities yet.</b><span>You can still use this subject space for useful public discussion. Open the global catalogue to explore broader options.</span><button class="btn btn-secondary" type="button" data-route="opportunities">Explore opportunities</button></section>`;

    const outcomes = data.outcomes.length
      ? data.outcomes.slice(0,6).map(post => `<button class="community16-outcome-card" type="button" data-route="post/${encodeURIComponent(post.id)}">
          <span>${post.postType === 'success_story' ? 'SUCCESS STORY' : 'JOURNEY STORY'}</span>
          <h3>${escapeHTML(post.title || 'Student experience')}</h3>
          <p>${escapeHTML((post.content || '').slice(0,150))}</p>
          <small>Student-shared experience →</small>
        </button>`).join('')
      : `<section class="community16-inline-empty"><b>No public outcomes for this subject yet.</b><span>Outcome stories appear only when students choose to publish them.</span></section>`;

    const universityLinks = data.universities.length
      ? data.universities.map(name => `<button type="button" data-route="university/${encodeURIComponent(name)}">${escapeHTML(name)} <span>→</span></button>`).join('')
      : '<p>No linked universities yet.</p>';

    const destinationChips = data.destinations.length
      ? data.destinations.map(country => `<span>${escapeHTML(country)}</span>`).join('')
      : '<small>No destination data yet.</small>';

    const fundingChips = data.fundingTypes.length
      ? data.fundingTypes.map(value => `<span>${escapeHTML(value)}</span>`).join('')
      : '<small>Funding varies by opportunity.</small>';

    const content = `${demoBanner()}
      <div class="community16-page">
        <button class="btn btn-ghost community16-back" type="button" data-route="explore">${icon('back',17)} Community</button>

        <section class="community16-hero">
          <div class="community16-hero-copy">
            <span class="opportunity-kicker">SUBJECT COMMUNITY</span>
            <h1>${escapeHTML(data.name)}</h1>
            <p>A public learning space for questions, explanations, student experiences and opportunity discovery in ${escapeHTML(data.name)}. Community posts add context; they do not replace official academic, scholarship or admissions information.</p>
            <div class="community16-actions">
              <button class="btn btn-primary" type="button" data-community-discussion data-community-subject="${escapeHTML(data.name)}">${icon('plus',16)} Ask or share in ${escapeHTML(data.name)}</button>
              <button class="btn btn-secondary" type="button" data-share-success data-prefill-subject="${escapeHTML(data.name)}">Share a success</button>
              <button class="btn btn-ghost" type="button" data-share-journey-story data-prefill-subject="${escapeHTML(data.name)}">Share selected Journey milestones</button>
            </div>
          </div>
          <aside class="community16-scope">
            <span>PUBLIC SUBJECT SPACE</span>
            <div><b>Discuss the subject</b><small>Questions, explanations, study methods and useful learning resources.</small></div>
            <div><b>Discover paths</b><small>See linked opportunities and institutions without treating community posts as official requirements.</small></div>
            <div><b>Protect private data</b><small>Keep application IDs, identity documents, addresses and private Journey details out of posts.</small></div>
          </aside>
        </section>

        <section class="community16-stats" aria-label="${escapeHTML(data.name)} community summary">
          <article><strong>${data.counts.discussions || '—'}</strong><span>Public discussions</span></article>
          <article><strong>${data.counts.opportunities || '—'}</strong><span>Linked opportunities</span></article>
          <article><strong>${data.counts.universities || '—'}</strong><span>Linked universities</span></article>
          <article><strong>${data.counts.outcomes || '—'}</strong><span>Shared outcomes</span></article>
        </section>

        <div class="community16-layout">
          <main class="community16-main">
            <section class="community16-section">
              <header class="community16-section-head">
                <div><span class="opportunity-kicker">DISCUSSIONS</span><h2>Learn with other students</h2><p>${escapeHTML(data.rankingNote)}</p></div>
                <button class="btn btn-secondary" type="button" data-community-discussion data-community-subject="${escapeHTML(data.name)}">Start discussion</button>
              </header>
              <div class="community16-feed">${discussions}</div>
            </section>

            ${unanswered}

            <section class="community16-section">
              <header class="community16-section-head">
                <div><span class="opportunity-kicker">STUDENT OUTCOMES</span><h2>Experiences in ${escapeHTML(data.name)}</h2><p>Useful context from students, not evidence that the same result or requirements apply to someone else.</p></div>
              </header>
              <div class="community16-outcomes">${outcomes}</div>
            </section>
          </main>

          <aside class="community16-side">
            <section class="community16-side-card">
              <span class="opportunity-kicker">DISCOVERY CONTEXT</span>
              <h2>Where this subject connects</h2>
              <div class="community16-side-group"><b>Destinations</b><div class="community16-chips">${destinationChips}</div></div>
              <div class="community16-side-group"><b>Funding types</b><div class="community16-chips">${fundingChips}</div></div>
            </section>

            <section class="community16-side-card">
              <span class="opportunity-kicker">UNIVERSITIES</span>
              <h2>Linked institutions</h2>
              <div class="community16-university-links">${universityLinks}</div>
              <p class="community16-side-note">University pages here are community discovery spaces. Official institution sources remain authoritative.</p>
            </section>

            <section class="community16-trust">
              ${icon('info',17)}
              <div><b>Official sources control requirements</b><p>${escapeHTML(data.sourceNote)}</p></div>
            </section>
          </aside>
        </div>

        <section class="community16-section">
          <header class="community16-section-head">
            <div><span class="opportunity-kicker">OPPORTUNITIES</span><h2>Paths linked to ${escapeHTML(data.name)}</h2><p>Use these listings for discovery, then verify current eligibility, funding, deadlines and application steps on the official provider source.</p></div>
            <button class="btn btn-secondary" type="button" data-route="opportunities">Open full catalogue</button>
          </header>
          <div class="community16-opportunities">${opportunityCards}</div>
        </section>
      </div>`;

    renderShell(content, { wide:true, right:false });
  } catch (error) {
    console.error(error);
    renderShell(`${demoBanner()}${emptyState('info','Subject community unavailable','Please try again.')}`, { wide:true, right:false });
  }
}

function community17OpportunityCard(item, label='LINKED OPPORTUNITY') {
  const levels = Array.isArray(item.studyLevels) ? item.studyLevels : (item.studyLevel ? [item.studyLevel] : []);
  return `<button class="community17-opportunity-card" type="button" data-route="opportunity/${encodeURIComponent(item.id)}">
    <div class="community17-opportunity-top"><span>${escapeHTML(label)}</span><small>${escapeHTML(item.fundingType || 'Funding varies')}</small></div>
    <h3>${escapeHTML(item.title || 'Opportunity')}</h3>
    <p>${escapeHTML(item.provider || item.providerName || item.university || 'Provider')}</p>
    <div class="community17-opportunity-meta">
      ${item.country ? `<span>${escapeHTML(item.country)}</span>` : ''}
      ${levels.slice(0,2).map(level => `<span>${escapeHTML(level)}</span>`).join('')}
      ${item.intake ? `<span>${escapeHTML(item.intake)}</span>` : ''}
    </div>
    <small class="community17-open">Review opportunity →</small>
  </button>`;
}

function community17OutcomeCard(post) {
  return `<button class="community17-outcome-card" type="button" data-route="post/${encodeURIComponent(post.id)}">
    <span>${post.postType === 'success_story' ? 'SUCCESS STORY' : 'JOURNEY STORY'}</span>
    <h3>${escapeHTML(post.title || 'Student experience')}</h3>
    <p>${escapeHTML((post.content || '').slice(0,160))}</p>
    <small>Student-shared experience →</small>
  </button>`;
}

function community17UnansweredMarkup(data, contextLabel) {
  if (!data.unanswered.length) {
    return `<section class="community17-calm-note">${icon('check',17)} <span>No unanswered public discussions in this ${escapeHTML(contextLabel)} right now.</span></section>`;
  }
  return `<section class="community17-unanswered">
    <header><div><span class="opportunity-kicker">NEEDS A RESPONSE</span><h2>Questions with no public replies yet</h2><p>Help when you can add useful, grounded knowledge—not guesses.</p></div><span>${data.counts.unanswered}</span></header>
    <div>
      ${data.unanswered.slice(0,4).map(post => `<button type="button" data-route="post/${encodeURIComponent(post.id)}">
        <strong>${escapeHTML(post.title || (post.content || '').slice(0,120) || 'Student question')}</strong>
        <small>${formatCount(post.likeCount || 0)} likes · ${formatCount(post.saveCount || 0)} saves · no public replies</small>
        <span>Open →</span>
      </button>`).join('')}
    </div>
  </section>`;
}

async function renderUniversityCommunity(universityName) {
  const university = String(universityName || '').trim();
  renderShell(`<div class="community17-page"><section class="community17-hero loading"><span class="opportunity-kicker">UNIVERSITY COMMUNITY</span><h1>${escapeHTML(university || 'University')}</h1><p>Loading public discussions, intakes and linked opportunities…</p></section></div>`, { wide:true, right:false });

  try {
    const opportunities = await getOpportunities(state.mode).catch(() => []);
    const data = buildUniversityCommunityModel(university, state.posts, opportunities);

    const discussions = data.discussions.length
      ? data.discussions.map(postCard).join('')
      : `<section class="community17-empty"><div>${icon('comment',22)}</div><h3>No public university discussions yet.</h3><p>Start with a useful question about study, campus preparation, programs or student experience without posting private application details.</p><button class="btn btn-primary" type="button" data-community-discussion data-community-university="${escapeHTML(data.name)}">Start a university discussion</button></section>`;

    const outcomes = data.outcomes.length
      ? data.outcomes.slice(0,6).map(community17OutcomeCard).join('')
      : `<section class="community17-inline-empty"><b>No public outcomes for this university yet.</b><span>Outcome stories appear only when students choose to publish them.</span></section>`;

    const intakeCards = data.intakeSummaries.length
      ? data.intakeSummaries.map(row => `<button class="community17-intake-card" type="button" data-route="intake/${encodeURIComponent(data.name)}/${encodeURIComponent(row.name)}">
          <div><span>INTAKE SPACE</span><h3>${escapeHTML(row.name)}</h3><p>${row.discussionCount} discussion${row.discussionCount===1?'':'s'} · ${row.outcomeCount} outcome${row.outcomeCount===1?'':'s'}</p></div>
          <div><strong>${row.opportunityCount || '—'}</strong><small>intake-linked opportunities</small></div>
        </button>`).join('')
      : `<section class="community17-inline-empty"><b>No intake spaces yet.</b><span>Intake communities appear when public student posts or linked opportunity data identifies an intake.</span></section>`;

    const subjectLinks = data.subjects.length
      ? data.subjects.map(subject => `<button type="button" data-route="subject/${encodeURIComponent(subject)}">${escapeHTML(subject)} <span>→</span></button>`).join('')
      : '<p>No linked subject data yet.</p>';

    const countryChips = data.countries.length
      ? data.countries.map(country => `<span>${escapeHTML(country)}</span>`).join('')
      : '<small>No destination data yet.</small>';

    const fundingChips = data.fundingTypes.length
      ? data.fundingTypes.map(value => `<span>${escapeHTML(value)}</span>`).join('')
      : '<small>Funding varies by opportunity.</small>';

    const opportunityCards = data.opportunities.length
      ? data.opportunities.slice(0,8).map(item => community17OpportunityCard(item)).join('')
      : `<section class="community17-inline-empty"><b>No linked opportunities yet.</b><span>Use this community for public student context, and explore the global opportunity catalogue separately.</span><button class="btn btn-secondary" type="button" data-route="opportunities">Explore opportunities</button></section>`;

    const content = `${demoBanner()}
      <div class="community17-page">
        <button class="btn btn-ghost community17-back" type="button" data-route="explore">${icon('back',17)} Community</button>

        <section class="community17-hero">
          <div class="community17-hero-copy">
            <span class="opportunity-kicker">UNIVERSITY COMMUNITY</span>
            <h1>${escapeHTML(data.name)}</h1>
            <p>A public student space around ${escapeHTML(data.name)} for questions, study context, intake conversations and voluntarily shared outcomes. This is not an official university channel.</p>
            <div class="community17-actions">
              <button class="btn btn-primary" type="button" data-community-discussion data-community-university="${escapeHTML(data.name)}">${icon('plus',16)} Ask this community</button>
              <button class="btn btn-secondary" type="button" data-share-success data-prefill-university="${escapeHTML(data.name)}">Share a success</button>
              <button class="btn btn-ghost" type="button" data-share-journey-story data-prefill-university="${escapeHTML(data.name)}">Share selected Journey milestones</button>
            </div>
          </div>
          <aside class="community17-scope">
            <span>PUBLIC STUDENT SPACE</span>
            <div><b>Student context</b><small>Questions, study experiences, preparation and useful peer knowledge.</small></div>
            <div><b>Not an official channel</b><small>Admissions, fees, funding, visa and enrollment requirements must be confirmed with official sources.</small></div>
            <div><b>Keep applications private</b><small>Do not post application IDs, passport/visa details, addresses, booking references or private documents.</small></div>
          </aside>
        </section>

        <section class="community17-stats" aria-label="${escapeHTML(data.name)} community summary">
          <article><strong>${data.counts.discussions || '—'}</strong><span>Public discussions</span></article>
          <article><strong>${data.counts.opportunities || '—'}</strong><span>Linked opportunities</span></article>
          <article><strong>${data.counts.intakes || '—'}</strong><span>Intake spaces</span></article>
          <article><strong>${data.counts.outcomes || '—'}</strong><span>Shared outcomes</span></article>
        </section>

        <div class="community17-layout">
          <main class="community17-main">
            <section class="community17-section">
              <header class="community17-section-head">
                <div><span class="opportunity-kicker">DISCUSSIONS</span><h2>Student conversations</h2><p>${escapeHTML(data.rankingNote)}</p></div>
                <button class="btn btn-secondary" type="button" data-community-discussion data-community-university="${escapeHTML(data.name)}">Start discussion</button>
              </header>
              <div class="community17-feed">${discussions}</div>
            </section>

            ${community17UnansweredMarkup(data,'university community')}

            <section class="community17-section">
              <header class="community17-section-head">
                <div><span class="opportunity-kicker">INTAKES</span><h2>Find your intake space</h2><p>Intake pages narrow public student discussion to a specific intake without exposing private application or travel records.</p></div>
              </header>
              <div class="community17-intakes">${intakeCards}</div>
            </section>

            <section class="community17-section">
              <header class="community17-section-head">
                <div><span class="opportunity-kicker">STUDENT OUTCOMES</span><h2>Experiences around ${escapeHTML(data.name)}</h2><p>Student stories provide context, not proof of current admission, funding or visa requirements.</p></div>
              </header>
              <div class="community17-outcomes">${outcomes}</div>
            </section>
          </main>

          <aside class="community17-side">
            <section class="community17-side-card">
              <span class="opportunity-kicker">DISCOVERY CONTEXT</span>
              <h2>What connects here</h2>
              <div class="community17-side-group"><b>Countries</b><div class="community17-chips">${countryChips}</div></div>
              <div class="community17-side-group"><b>Funding types</b><div class="community17-chips">${fundingChips}</div></div>
            </section>

            <section class="community17-side-card">
              <span class="opportunity-kicker">SUBJECTS</span>
              <h2>Linked study areas</h2>
              <div class="community17-link-list">${subjectLinks}</div>
            </section>

            <section class="community17-trust">
              ${icon('info',17)}
              <div><b>Official sources remain authoritative</b><p>${escapeHTML(data.sourceNote)}</p></div>
            </section>
          </aside>
        </div>

        <section class="community17-section">
          <header class="community17-section-head">
            <div><span class="opportunity-kicker">OPPORTUNITIES</span><h2>Paths linked to ${escapeHTML(data.name)}</h2><p>Use these for discovery, then verify current requirements on the official provider or university source.</p></div>
            <button class="btn btn-secondary" type="button" data-route="opportunities">Open full catalogue</button>
          </header>
          <div class="community17-opportunities">${opportunityCards}</div>
        </section>
      </div>`;

    renderShell(content, { wide:true, right:false });
  } catch (error) {
    console.error(error);
    renderShell(`${demoBanner()}${emptyState('info','University community unavailable','Please try again.')}`, { wide:true, right:false });
  }
}

async function renderIntakeCommunity(universityName, intakeName) {
  const university=String(universityName||'').trim();
  const intake=String(intakeName||'').trim();
  renderShell(`<div class="community17-page"><section class="community17-hero loading intake"><span class="opportunity-kicker">INTAKE COMMUNITY</span><h1>${escapeHTML(intake || 'Intake')}</h1><p>Loading public intake context for ${escapeHTML(university || 'University')}…</p></section></div>`, { wide:true, right:false });

  try {
    const opportunities = await getOpportunities(state.mode).catch(() => []);
    const data = buildIntakeCommunityModel(university,intake,state.posts,opportunities);

    const discussions = data.discussions.length
      ? data.discussions.map(postCard).join('')
      : `<section class="community17-empty"><div>${icon('comment',22)}</div><h3>No public intake discussions yet.</h3><p>Start a useful discussion for this intake without sharing private application, identity, booking or travel details.</p><button class="btn btn-primary" type="button" data-community-discussion data-community-university="${escapeHTML(data.university)}" data-community-intake="${escapeHTML(data.intake)}">Start intake discussion</button></section>`;

    const outcomes = data.outcomes.length
      ? data.outcomes.slice(0,6).map(community17OutcomeCard).join('')
      : `<section class="community17-inline-empty"><b>No public outcomes for this intake yet.</b><span>Stories appear only when students choose to publish intake-specific experiences.</span></section>`;

    const subjectLinks = data.subjects.length
      ? data.subjects.map(subject => `<button type="button" data-route="subject/${encodeURIComponent(subject)}">${escapeHTML(subject)} <span>→</span></button>`).join('')
      : '<p>No intake-specific subject data yet.</p>';

    const exactOpportunities = data.opportunities.length
      ? data.opportunities.slice(0,8).map(item => community17OpportunityCard(item,'INTAKE-LINKED OPPORTUNITY')).join('')
      : `<section class="community17-inline-empty"><b>No opportunity is explicitly linked to this intake yet.</b><span>Do not assume a general university opportunity applies to this intake. Verify the current intake on the official provider source.</span></section>`;

    const generalOpportunities = data.generalUniversityOpportunities.length
      ? data.generalUniversityOpportunities.slice(0,6).map(item => community17OpportunityCard(item,'UNIVERSITY OPPORTUNITY · INTAKE NOT SPECIFIED')).join('')
      : `<section class="community17-inline-empty"><b>No general university opportunities without an intake label.</b><span>Only exact intake matches are treated as intake-linked above.</span></section>`;

    const countryChips = data.countries.length
      ? data.countries.map(country => `<span>${escapeHTML(country)}</span>`).join('')
      : '<small>No country context stored yet.</small>';

    const content = `${demoBanner()}
      <div class="community17-page community17-intake-page">
        <button class="btn btn-ghost community17-back" type="button" data-route="university/${encodeURIComponent(data.university)}">${icon('back',17)} ${escapeHTML(data.university)}</button>

        <section class="community17-hero intake">
          <div class="community17-hero-copy">
            <span class="opportunity-kicker">INTAKE COMMUNITY</span>
            <h1>${escapeHTML(data.intake)}</h1>
            <p>${escapeHTML(data.university)} · a public student space for intake-specific questions, preparation context and voluntarily shared experiences. It does not expose or import anyone’s private Tefsen Journey.</p>
            <div class="community17-actions">
              <button class="btn btn-primary" type="button" data-community-discussion data-community-university="${escapeHTML(data.university)}" data-community-intake="${escapeHTML(data.intake)}">${icon('plus',16)} Ask or share in this intake</button>
              <button class="btn btn-secondary" type="button" data-share-success data-prefill-university="${escapeHTML(data.university)}" data-prefill-intake="${escapeHTML(data.intake)}">Share a success</button>
              <button class="btn btn-ghost" type="button" data-share-journey-story data-prefill-university="${escapeHTML(data.university)}" data-prefill-intake="${escapeHTML(data.intake)}">Share selected Journey milestones</button>
            </div>
          </div>
          <aside class="community17-scope">
            <span>INTAKE-SPECIFIC · PUBLIC</span>
            <div><b>Discuss public preparation</b><small>Orientation, study planning, program questions and student context.</small></div>
            <div><b>Exact intake matching</b><small>Only opportunities carrying this intake label appear as intake-linked opportunities.</small></div>
            <div><b>Protect sensitive data</b><small>${escapeHTML(data.privacyNote)}</small></div>
          </aside>
        </section>

        <section class="community17-stats" aria-label="${escapeHTML(data.intake)} intake community summary">
          <article><strong>${data.counts.discussions || '—'}</strong><span>Public discussions</span></article>
          <article><strong>${data.counts.opportunities || '—'}</strong><span>Exact intake opportunities</span></article>
          <article><strong>${data.counts.subjects || '—'}</strong><span>Linked subjects</span></article>
          <article><strong>${data.counts.outcomes || '—'}</strong><span>Shared outcomes</span></article>
        </section>

        <div class="community17-layout">
          <main class="community17-main">
            <section class="community17-section">
              <header class="community17-section-head">
                <div><span class="opportunity-kicker">DISCUSSIONS</span><h2>${escapeHTML(data.intake)} conversations</h2><p>${escapeHTML(data.rankingNote)}</p></div>
                <button class="btn btn-secondary" type="button" data-community-discussion data-community-university="${escapeHTML(data.university)}" data-community-intake="${escapeHTML(data.intake)}">Start discussion</button>
              </header>
              <div class="community17-feed">${discussions}</div>
            </section>

            ${community17UnansweredMarkup(data,'intake')}

            <section class="community17-section">
              <header class="community17-section-head">
                <div><span class="opportunity-kicker">STUDENT OUTCOMES</span><h2>Experiences from this intake</h2><p>Voluntary public stories only. They do not establish current requirements or predict another student's result.</p></div>
              </header>
              <div class="community17-outcomes">${outcomes}</div>
            </section>
          </main>

          <aside class="community17-side">
            <section class="community17-side-card">
              <span class="opportunity-kicker">INTAKE CONTEXT</span>
              <h2>Stored public context</h2>
              <div class="community17-side-group"><b>Countries</b><div class="community17-chips">${countryChips}</div></div>
            </section>

            <section class="community17-side-card">
              <span class="opportunity-kicker">SUBJECTS</span>
              <h2>Linked study areas</h2>
              <div class="community17-link-list">${subjectLinks}</div>
            </section>

            <section class="community17-trust">
              ${icon('info',17)}
              <div><b>Verify every intake detail</b><p>${escapeHTML(data.sourceNote)}</p></div>
            </section>
          </aside>
        </div>

        <section class="community17-section">
          <header class="community17-section-head">
            <div><span class="opportunity-kicker">EXACT INTAKE MATCHES</span><h2>Opportunities explicitly linked to ${escapeHTML(data.intake)}</h2><p>These records carry this intake label, but the official provider source still controls current dates, eligibility, funding and application requirements.</p></div>
          </header>
          <div class="community17-opportunities">${exactOpportunities}</div>
        </section>

        <section class="community17-section">
          <header class="community17-section-head">
            <div><span class="opportunity-kicker">UNIVERSITY-WIDE OPPORTUNITIES</span><h2>Intake not specified</h2><p>These are linked to ${escapeHTML(data.university)} but do not carry an intake value. They are intentionally not treated as ${escapeHTML(data.intake)} opportunities.</p></div>
            <button class="btn btn-secondary" type="button" data-route="university/${encodeURIComponent(data.university)}">University community</button>
          </header>
          <div class="community17-opportunities">${generalOpportunities}</div>
        </section>
      </div>`;

    renderShell(content,{wide:true,right:false});
  } catch (error) {
    console.error(error);
    renderShell(`${demoBanner()}${emptyState('info','Intake community unavailable','Please try again.')}`, { wide:true, right:false });
  }
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

function success18ContextLinks(model) {
  const links=[];
  if(model.subject) links.push(`<button type="button" data-route="subject/${encodeURIComponent(model.subject)}"><span>Subject</span><b>${escapeHTML(model.subject)}</b><small>Open subject community →</small></button>`);
  if(model.university) links.push(`<button type="button" data-route="university/${encodeURIComponent(model.university)}"><span>University</span><b>${escapeHTML(model.university)}</b><small>Open university community →</small></button>`);
  if(model.university && model.intake) links.push(`<button type="button" data-route="intake/${encodeURIComponent(model.university)}/${encodeURIComponent(model.intake)}"><span>Intake</span><b>${escapeHTML(model.intake)}</b><small>Open intake community →</small></button>`);
  return links.join('');
}

function success18DetailMarkup(post, model, comments) {
  const liked=reactionState.liked.has(post.id);
  const saved=reactionState.saved.has(post.id);
  const facts=model.facts.length
    ? model.facts.map(([label,value])=>`<div class="success18-fact"><small>${escapeHTML(label)}</small><b>${escapeHTML(value)}</b></div>`).join('')
    : '<div class="success18-fact empty"><small>Outcome details</small><b>No structured facts were provided.</b></div>';
  const contextLinks=success18ContextLinks(model);

  return `<div class="success18-reader">
    <button class="btn btn-ghost success18-back" type="button" data-back>${icon('back',17)} Back</button>

    <article class="success18-detail">
      <header class="success18-hero">
        <div class="success18-hero-main">
          <span class="story-type success">✓ Student success story</span>
          <h1>${escapeHTML(model.title)}</h1>
          <p>Shared voluntarily by a student as personal experience. It is not an official decision notice or current admissions guidance.</p>
          <div class="success18-author">
            <button class="avatar-route-button" type="button" data-route="profile/${encodeURIComponent(model.authorId)}">${avatar({fullName:model.authorName,photoUrl:model.authorPhotoUrl})}</button>
            <div><button class="user-name-link" type="button" data-route="profile/${encodeURIComponent(model.authorId)}"><b>${escapeHTML(model.authorName)} ${verifiedMark(model.verified, model.role)}</b></button><small>${rolePill(model.role)} &nbsp; ${relativeTime(model.createdAt)}</small></div>
          </div>
        </div>
        <aside class="success18-hero-aside">
          <span>HOW TO READ THIS</span>
          <div><b>Personal outcome</b><small>This describes what happened to this student.</small></div>
          <div><b>Not a guarantee</b><small>Another student may face different requirements, timelines or results.</small></div>
          <div><b>Verify officially</b><small>Use the university/provider source before making application decisions.</small></div>
        </aside>
      </header>

      <section class="success18-facts" aria-label="Success story facts">${facts}</section>

      <div class="success18-body-layout">
        <main class="success18-story">
          <span class="opportunity-kicker">THE STUDENT'S STORY</span>
          <div class="success18-story-copy">${nl2br(model.content || 'This student did not add a longer story.')}</div>
          ${model.tags.length ? `<div class="tag-row">${model.tags.map(tag=>`<span class="tag">#${escapeHTML(tag)}</span>`).join('')}</div>` : ''}
        </main>

        <aside class="success18-reader-side">
          <section class="success18-trust-card">
            ${icon('info',17)}
            <div><b>Experience, not requirements</b><p>${escapeHTML(model.trustNotice)}</p></div>
          </section>
          <section class="success18-trust-card official">
            ${icon('check',17)}
            <div><b>Verify current information</b><p>${escapeHTML(model.sourceNotice)}</p></div>
          </section>
          <section class="success18-trust-card privacy">
            ${icon('user',17)}
            <div><b>Public by choice</b><p>${escapeHTML(model.privacyNotice)}</p></div>
          </section>
        </aside>
      </div>

      ${contextLinks ? `<section class="success18-context">
        <header><span class="opportunity-kicker">EXPLORE THE CONTEXT</span><h2>Continue from this story</h2><p>Use Tefsen community spaces for student context, then verify formal requirements on official sources.</p></header>
        <div>${contextLinks}</div>
      </section>` : ''}

      <footer class="post-actions success18-actions">
        <button class="action-btn like ${liked?'active':''}" data-like="${escapeHTML(post.id)}" aria-label="Like success story" aria-pressed="${liked}"><span class="action-icon">${icon('heart',17)}</span><span class="action-count">${formatCount(post.likeCount)}</span></button>
        <button class="action-btn" aria-label="Replies"><span class="action-icon">${icon('comment',17)}</span><span class="action-count">${formatCount(comments.length || post.commentCount)}</span></button>
        <button class="action-btn ${saved?'active':''}" data-save="${escapeHTML(post.id)}"><span>${icon('bookmark',17)}</span>${saved?'Saved':'Save'}</button>
        <button class="action-btn" data-share="${escapeHTML(post.id)}"><span>${icon('share',17)}</span>Share</button>
        <button class="action-btn" data-post-menu="${escapeHTML(post.id)}"><span>${icon('more',17)}</span>Options</button>
      </footer>
    </article>

    <section class="success18-replies">
      <header><div><span class="opportunity-kicker">COMMUNITY REPLIES</span><h2>${comments.length} ${comments.length===1?'reply':'replies'}</h2><p>Add helpful context, encouragement or a relevant question. Do not treat the story as official admissions advice.</p></div></header>
      <form class="success18-reply-form" data-comment-form="${escapeHTML(post.id)}">
        <textarea class="textarea" name="content" placeholder="Write a helpful public reply…" required maxlength="5000"></textarea>
        <div><button class="btn btn-primary" type="submit">Publish reply</button></div>
      </form>
      <div class="success18-reply-list">${comments.length ? comments.map(answerCard).join('') : emptyState('comment','No replies yet','Add a thoughtful public reply if you can contribute something useful.')}</div>
    </section>
  </div>`;
}

function journey19ContextLinks(model) {
  const links=[];
  if(model.subject) links.push(`<button type="button" data-route="subject/${encodeURIComponent(model.subject)}"><span>Subject</span><b>${escapeHTML(model.subject)}</b><small>Open subject community →</small></button>`);
  if(model.university) links.push(`<button type="button" data-route="university/${encodeURIComponent(model.university)}"><span>University</span><b>${escapeHTML(model.university)}</b><small>Open university community →</small></button>`);
  if(model.university && model.intake) links.push(`<button type="button" data-route="intake/${encodeURIComponent(model.university)}/${encodeURIComponent(model.intake)}"><span>Intake</span><b>${escapeHTML(model.intake)}</b><small>Open intake community →</small></button>`);
  return links.join('');
}

function journey19MonthLabel(value) {
  const match=/^(\d{4})-(\d{2})$/.exec(String(value||''));
  if(!match) return String(value||'');
  const date=new Date(Number(match[1]),Number(match[2])-1,1);
  return date.toLocaleDateString(undefined,{year:'numeric',month:'short'});
}

function journey19DetailMarkup(post,model,comments) {
  const liked=reactionState.liked.has(post.id);
  const saved=reactionState.saved.has(post.id);
  const contextLinks=journey19ContextLinks(model);

  const timeline=model.milestones.length
    ? model.milestones.map((item,index)=>`<article class="journey19-timeline-item">
        <div class="journey19-timeline-rail"><span></span>${index<model.milestones.length-1?'<i></i>':''}</div>
        <div class="journey19-timeline-content">
          <small>${item.month ? escapeHTML(journey19MonthLabel(item.month)) : 'Month not shared'}</small>
          <h3>${escapeHTML(item.stage || 'Milestone')}</h3>
          ${item.note ? `<p>${nl2br(item.note)}</p>` : '<p class="muted">No additional public note.</p>'}
        </div>
      </article>`).join('')
    : '<div class="journey19-no-milestones">No public milestones were included in this story.</div>';

  return `<div class="journey19-reader">
    <button class="btn btn-ghost journey19-back" type="button" data-back>${icon('back',17)} Back</button>

    <article class="journey19-detail">
      <header class="journey19-hero">
        <div class="journey19-hero-main">
          <span class="story-type journey">Journey story</span>
          <h1>${escapeHTML(model.title)}</h1>
          <p>A student-selected public timeline. It is not the student's private Tefsen Journey record, official admissions guidance or a recommended path for someone else.</p>
          <div class="journey19-author">
            <button class="avatar-route-button" type="button" data-route="profile/${encodeURIComponent(model.authorId)}">${avatar({fullName:model.authorName,photoUrl:model.authorPhotoUrl})}</button>
            <div><button class="user-name-link" type="button" data-route="profile/${encodeURIComponent(model.authorId)}"><b>${escapeHTML(model.authorName)} ${verifiedMark(model.verified,model.role)}</b></button><small>${rolePill(model.role)} &nbsp; ${relativeTime(model.createdAt)}</small></div>
          </div>
        </div>
        <aside class="journey19-hero-aside">
          <span>WHAT THIS SHOWS</span>
          <div><b>Selected milestones only</b><small>The student chose which milestones and notes to publish.</small></div>
          <div><b>Month-level timing</b><small>Exact private dates are not requested by the public Journey-story form.</small></div>
          <div><b>Not a blueprint</b><small>Timelines and requirements can differ by student, provider, country and intake.</small></div>
        </aside>
      </header>

      <section class="journey19-context-strip">
        <div><small>Subject</small><b>${escapeHTML(model.subject || 'Not specified')}</b></div>
        <div><small>University</small><b>${escapeHTML(model.university || 'Not specified')}</b></div>
        <div><small>Intake</small><b>${escapeHTML(model.intake || 'Not specified')}</b></div>
        <div><small>Public milestones</small><b>${model.milestones.length}</b></div>
      </section>

      <div class="journey19-body-layout">
        <main class="journey19-main">
          <section class="journey19-intro">
            <span class="opportunity-kicker">STORY CONTEXT</span>
            <div class="journey19-intro-copy">${nl2br(model.content || 'This student did not add a longer introduction.')}</div>
          </section>

          <section class="journey19-timeline-section">
            <header><span class="opportunity-kicker">PUBLIC TIMELINE</span><h2>Milestones this student chose to share</h2><p>These entries are a public story, not a live view of the student's private Journey workspace.</p></header>
            <div class="journey19-timeline">${timeline}</div>
          </section>

          ${model.tags.length ? `<div class="tag-row journey19-tags">${model.tags.map(tag=>`<span class="tag">#${escapeHTML(tag)}</span>`).join('')}</div>` : ''}
        </main>

        <aside class="journey19-reader-side">
          <section class="journey19-trust-card privacy">
            ${icon('user',17)}
            <div><b>Private Journey stays private</b><p>${escapeHTML(model.privacyNotice)}</p></div>
          </section>
          <section class="journey19-trust-card">
            ${icon('info',17)}
            <div><b>Personal timeline, not a recommendation</b><p>${escapeHTML(model.trustNotice)}</p></div>
          </section>
          <section class="journey19-trust-card official">
            ${icon('check',17)}
            <div><b>Verify current requirements</b><p>${escapeHTML(model.sourceNotice)}</p></div>
          </section>
        </aside>
      </div>

      ${contextLinks ? `<section class="journey19-context-links">
        <header><span class="opportunity-kicker">EXPLORE THE CONTEXT</span><h2>Continue from this public story</h2><p>Community spaces provide student context. Official institution/provider sources control formal requirements.</p></header>
        <div>${contextLinks}</div>
      </section>` : ''}

      <footer class="post-actions journey19-actions">
        <button class="action-btn like ${liked?'active':''}" data-like="${escapeHTML(post.id)}" aria-label="Like Journey story" aria-pressed="${liked}"><span class="action-icon">${icon('heart',17)}</span><span class="action-count">${formatCount(post.likeCount)}</span></button>
        <button class="action-btn" aria-label="Replies"><span class="action-icon">${icon('comment',17)}</span><span class="action-count">${formatCount(comments.length || post.commentCount)}</span></button>
        <button class="action-btn ${saved?'active':''}" data-save="${escapeHTML(post.id)}"><span>${icon('bookmark',17)}</span>${saved?'Saved':'Save'}</button>
        <button class="action-btn" data-share="${escapeHTML(post.id)}"><span>${icon('share',17)}</span>Share</button>
        <button class="action-btn" data-post-menu="${escapeHTML(post.id)}"><span>${icon('more',17)}</span>Options</button>
      </footer>
    </article>

    <section class="journey19-replies">
      <header><div><span class="opportunity-kicker">COMMUNITY REPLIES</span><h2>${comments.length} ${comments.length===1?'reply':'replies'}</h2><p>Ask about the public story or add helpful context. Do not request private application, identity, visa, travel or financial details.</p></div></header>
      <form class="journey19-reply-form" data-comment-form="${escapeHTML(post.id)}">
        <textarea class="textarea" name="content" placeholder="Write a helpful public reply…" required maxlength="5000"></textarea>
        <div><button class="btn btn-primary" type="submit">Publish reply</button></div>
      </form>
      <div class="journey19-reply-list">${comments.length ? comments.map(answerCard).join('') : emptyState('comment','No replies yet','Add a thoughtful public reply if you can contribute something useful.')}</div>
    </section>
  </div>`;
}

async function renderPostDetail(postId) {
  stopComments?.(); stopComments = null;
  let post = state.posts.find(p => p.id === postId);
  if (!post) {
    renderShell(`<div class="loading-card"></div>`);
    post = await getPost(state.mode, postId).catch(() => null);
  }
  if (!post) {
    renderShell(emptyState('info','Post not found','It may have been removed or you may not have permission to view it.'));
    return;
  }

  if (post.postType === 'success_story') {
    const model=buildSuccessStoryModel(post);
    const own=String(post.authorId || '')===String(state.user?.uid || '');
    const admin=adminCapability === true;
    if (!model || (!model.isPublic && !own && !admin)) {
      renderShell(emptyState('info','Success story unavailable','This story is not publicly available.'));
      return;
    }

    currentComments=[];
    const drawSuccess=()=>{
      renderShell(success18DetailMarkup(post,model,currentComments),{wide:true,right:false});
    };
    drawSuccess();
    stopComments=subscribeComments(state.mode,postId,comments=>{
      currentComments=comments;
      drawSuccess();
    },e=>toast(humanError(e),'error'));
    return;
  }

  if (post.postType === 'journey_story') {
    const model=buildJourneyStoryModel(post);
    const own=String(post.authorId || '')===String(state.user?.uid || '');
    const admin=adminCapability === true;
    if (!model || (!model.isPublic && !own && !admin)) {
      renderShell(emptyState('info','Journey story unavailable','This story is not publicly available.'));
      return;
    }

    currentComments=[];
    const drawJourney=()=>{
      renderShell(journey19DetailMarkup(post,model,currentComments),{wide:true,right:false});
    };
    drawJourney();
    stopComments=subscribeComments(state.mode,postId,comments=>{
      currentComments=comments;
      drawJourney();
    },e=>toast(humanError(e),'error'));
    return;
  }

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

async function refreshNotificationCenterData() {
  if(!state.user?.uid) return buildNotificationCenterModel();
  const [activityNotifications,journeys,opportunities,readIds]=await Promise.all([
    getNotifications(state.mode,state.user.uid).catch(()=>[]),
    listJourneyStates(state.mode,state.user.uid).catch(()=>[]),
    getOpportunities(state.mode).catch(()=>[]),
    getSyncedNotificationReadIds(state.mode,state.user.uid).catch(()=>getNotificationReadIds(state.user.uid))
  ]);
  const model=applyNotificationPreferences(buildNotificationCenterModel({
    activityNotifications,
    journeys,
    opportunities,
    readIds,
    now:new Date()
  }), currentUserSettings);
  setState({notifications:model.items,unreadCount:model.unreadCount});
  return model;
}

function notificationIconName(n) {
  if(n.type==='deadline') return 'clock';
  if(n.type==='post_acceptance') return 'check';
  if(n.type==='journey') return 'compass';
  if(n.type==='reply') return 'comment';
  if(n.type==='like') return 'heart';
  return 'bell';
}

function notification21Item(n) {
  const time=n.timeLabel || (n.createdAt ? relativeTime(n.createdAt) : '');
  return `<button class="notification21-item ${n.read?'read':'unread'} priority-${escapeHTML(n.priority||'info')}" type="button"
    data-notification="${escapeHTML(n.id)}" data-notification-route="${escapeHTML(n.route||'')}">
    <span class="notification21-icon">${icon(notificationIconName(n),18)}</span>
    <span class="notification21-copy">
      <span class="notification21-meta"><b>${escapeHTML(n.category==='attention'?'Needs attention':n.category==='planning'?'Your plan':'Community update')}</b>${time?`<small>${escapeHTML(time)}</small>`:''}</span>
      <strong>${escapeHTML(n.title||'Tefsen update')}</strong>
      <p>${escapeHTML(n.message||'')}</p>
      <small class="notification21-action">${escapeHTML(n.actionLabel||'Open')} →</small>
    </span>
    ${n.read?'':'<span class="notification21-dot" aria-label="Unread"></span>'}
  </button>`;
}

function notification21Section(title,eyebrow,rows,description='') {
  if(!rows?.length) return '';
  const unreadCount=rows.filter(row=>!row.read).length;
  const category=String(rows[0]?.category||'');
  return `<section class="notification21-section">
    <header class="notification21-section-head">
      <div><span class="opportunity-kicker">${escapeHTML(eyebrow)}</span><h2>${escapeHTML(title)}</h2>${description?`<p>${escapeHTML(description)}</p>`:''}</div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end"><span>${unreadCount} unread</span>${unreadCount&&category?`<button class="btn btn-ghost" type="button" data-notifications-mark-section="${escapeHTML(category)}">Mark section read</button>`:''}</div>
    </header>
    <div class="notification21-list">${rows.map(notification21Item).join('')}</div>
  </section>`;
}

async function renderNotifications() {
  renderShell(`<div class="notification21-page"><section class="notification21-hero loading"><span class="opportunity-kicker">NOTIFICATIONS</span><h1>Loading what needs your attention…</h1><p>Checking your Journey dates, opportunity deadlines and Community activity.</p></section></div>`,{wide:true,right:false});

  try{
    const model=await refreshNotificationCenterData();
    const content=`${demoBanner()}
      <div class="notification21-page">
        <section class="notification21-hero">
          <div>
            <span class="opportunity-kicker">YOUR NEXT ACTIONS</span>
            <h1>Notifications that help you move forward</h1>
            <p>Tefsen prioritizes deadlines, private Journey planning dates, accepted-offer actions and useful Community activity instead of filling this page with generic engagement noise.</p>
            <div class="notification21-hero-actions">
              ${model.unreadCount ? '<button class="btn btn-secondary" type="button" data-notifications-mark-all>Mark all as read</button>' : '<span class="notification21-calm">✓ No unread notifications</span>'}
              <button class="btn btn-ghost" type="button" data-route="journeys">Open Journey workspace</button><button class="btn btn-ghost" type="button" data-route="settings/notifications">Manage alerts</button>
            </div>
          </div>
          <aside class="notification21-scope">
            <span>HOW THIS WORKS</span>
            <div><b>Private planning stays private</b><small>Journey-derived alerts are calculated for you; they are not public Community posts.</small></div>
            <div><b>Official sources still control dates</b><small>A stored deadline is a planning aid. Verify current dates and requirements on the provider source.</small></div>
            <div><b>Read state is account-scoped</b><small>Acknowledged items sync through your private notification state when available, with a per-account browser fallback.</small></div>
          </aside>
        </section>

        <section class="notification21-stats" aria-label="Notification summary">
          <article><strong>${model.counts.unread}</strong><span>Unread</span></article>
          <article><strong>${model.counts.attention}</strong><span>Needs attention</span></article>
          <article><strong>${model.counts.planning}</strong><span>Planning</span></article>
          <article><strong>${model.counts.activity}</strong><span>Community updates</span></article>
        </section>

        <section class="notification21-source-note">${icon('info',16)}<span>${escapeHTML(model.sourceNote)}</span></section>

        ${model.empty ? `<section class="notification21-empty"><div>${icon('bell',24)}</div><h2>Nothing needs your attention right now</h2><p>Deadline, Journey and supported Community activity notifications will appear here when there is something useful to review.</p><div><button class="btn btn-primary" type="button" data-route="opportunities">Explore opportunities</button><button class="btn btn-secondary" type="button" data-route="journeys">Open Journeys</button></div></section>` : `
          ${notification21Section('Deadlines and time-sensitive actions','NEEDS ATTENTION',model.sections.attention,'Stored dates that are close, today or overdue. Verify official deadlines before acting.')}
          ${notification21Section('Continue your plan','JOURNEY PLANNING',model.sections.planning,'Useful next actions from your private Journey and accepted-offer workspace.')}
          ${notification21Section('Community activity','PUBLIC ACTIVITY',model.sections.activity,'Replies and supported activity records from the Community notification collection.')}
        `}
      </div>`;
    renderShell(content,{wide:true,right:false});
  }catch(error){
    console.error(error);
    renderShell(`${demoBanner()}${emptyState('info','Notifications unavailable','Please try again.')}`,{wide:true,right:false});
  }
}

function renderPrivateMessagingUnavailable() {
  const content=`${demoBanner()}
    <section class="messages22-retired">
      <div class="messages22-icon">${icon('message',24)}</div>
      <span class="opportunity-kicker">PRIVATE MESSAGING</span>
      <h1>Private messages are not available on Tefsen Web</h1>
      <p>The unfinished chat screen was removed rather than presenting a feature that cannot securely send or receive messages. Use Community for public learning discussions and keep application, identity, financial, visa and travel details private.</p>
      <div class="messages22-actions">
        <button class="btn btn-primary" type="button" data-route="explore">Open Community</button>
        <button class="btn btn-secondary" type="button" data-route="notifications">Open Notifications</button>
      </div>
      <aside>
        <b>Why this route still exists</b>
        <span>Old bookmarks may still point to <code>#/messages</code>. This compatibility page prevents a broken route without exposing a fake chat feature.</span>
      </aside>
    </section>`;
  renderShell(content,{wide:true,right:false});
}

function renderLeaderboardRetired() {
  const content=`${demoBanner()}<div class="recognition28-page">
    <section class="recognition28-hero">
      <div class="recognition28-mark">${icon('trophy',22)}</div>
      <span class="opportunity-kicker">COMMUNITY RECOGNITION</span>
      <h1>Tefsen does not rank students with unverified points.</h1>
      <p>The old leaderboard used a client-side points field and a limited user sample, which could not guarantee a fair or globally correct ranking. That surface has been retired until Tefsen has server-authoritative scoring, anti-abuse controls and a transparent contribution model.</p>
    </section>
    <section class="recognition28-grid">
      <article class="recognition28-card"><span>DISCUSSIONS</span><strong>Help with useful questions and answers</strong><p>Community value should come from helpful learning contributions, not from chasing a score.</p><button class="btn btn-secondary" type="button" data-route="explore">Open Community</button></article>
      <article class="recognition28-card"><span>STUDENT OUTCOMES</span><strong>Share real success or Journey context</strong><p>Publish only experiences you intentionally want public and that could help another student.</p><button class="btn btn-secondary" type="button" data-share-success>Share a success</button></article>
      <article class="recognition28-card"><span>YOUR IDENTITY</span><strong>Build a useful public profile</strong><p>Your public profile can show what you study and contribute without assigning you a reputation score.</p><button class="btn btn-secondary" type="button" data-route="profile">Open profile</button></article>
    </section>
    <section class="recognition28-principles">
      <h2>What a future recognition system must guarantee</h2>
      <ul>
        <li>Scores are calculated by trusted backend logic, not editable client profile fields.</li>
        <li>Ranking uses the complete eligible population or a clearly defined cohort—not an arbitrary first-page sample.</li>
        <li>Students can understand what actions count and how abuse, spam and deleted content affect recognition.</li>
        <li>Recognition does not expose private Student Passport, Journey, saved-content or account data.</li>
      </ul>
    </section>
  </div>`;
  renderShell(content,{wide:true,right:false});
}

async function renderProfile(userId = '') {
  let profile = state.profile;
  if (userId && userId !== state.user.uid) {
    profile = await getUserById(state.mode, userId).catch(() => null);
    profile = profile || { uid:userId, fullName:'Tefsen User', role:'Student' };
  }

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
  </section>` : `<section class="profile13-public-privacy-note profile14-public-boundary">
    ${icon('info',16)}
    <div><b>Public information only</b><p>This view contains public name, username, bio, photo, role and explicitly public community posts. Email, subscription details, Student Passport, saved opportunities, Journeys and private planning are not part of this profile view.</p></div>
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

    <section class="profile13-activity" id="profile-public-activity">
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
  const policy = getWebPostingPolicy(p, { admin:adminCapability });
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
    : `<div class="lux-price"><strong>Google Play</strong><span>price & offers</span></div>`;
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
            <div><span class="lux-card-kicker">STUDENT PLUS</span><h3>Student Plus <small>Price shown in Google Play</small></h3><p>Designed for students who contribute more. Exact price, taxes and promotional eligibility are shown by Google Play for your account and region.</p></div>
            <ul><li>${icon('check',16)} Unlimited text posts</li><li>${icon('check',16)} 6 image posts per day</li><li>${icon('check',16)} 2 images per post</li><li>${icon('check',16)} Up to 6 MB total</li></ul>
            ${isPlus ? '<span class="lux-current-pill">Active plan</span>' : `<a class="lux-card-cta" href="${GOOGLE_PLAY_APP_URL}" target="_blank" rel="noopener noreferrer">Upgrade with Google Play →</a>`}
          </article>
        </div>
      </section>

      <section class="lux-billing-card">
        <div class="lux-billing-mark">G</div>
        <div><span class="lux-card-kicker">GOOGLE PLAY</span><h3>Billing stays with your Android subscription.</h3><p>Purchase or manage Student Plus through the Tefsen Android app, then sync the same Tefsen account here. Google Play is the authority for current price, taxes, trial or promotional eligibility, renewal and cancellation terms.</p></div>
        ${isAdmin ? '' : (isPlus ? `<a class="btn lux-secondary" href="${GOOGLE_PLAY_SUBSCRIPTIONS_URL}" target="_blank" rel="noopener noreferrer">Manage subscription</a>` : `<a class="btn lux-primary" href="${GOOGLE_PLAY_APP_URL}" target="_blank" rel="noopener noreferrer">Open Google Play</a>`)}
      </section>
    </div>`;
  renderShell(content, { wide: true });
}

function settingsToggleMarkup(key, checked, label) {
  return `<button class="settings25-toggle ${checked ? 'active' : ''}" type="button" data-settings-toggle="${key}" aria-label="${escapeHTML(label)}" aria-pressed="${checked}"></button>`;
}

function settingsThemeMarkup(selected = 'system') {
  const options = [
    ['light','Light','Bright white interface'],
    ['dark','Dark','Low-light interface'],
    ['system','System','Follow this device']
  ];
  return `<div class="settings25-theme-options" role="radiogroup" aria-label="Appearance">
    ${options.map(([value,label,detail]) => `<button class="settings25-theme-choice ${selected === value ? 'active' : ''}" type="button" data-settings-theme="${value}" role="radio" aria-checked="${selected === value}">
      <span class="settings25-theme-preview ${value}" aria-hidden="true"><i></i><i></i><i></i></span>
      <span><b>${label}</b><small>${detail}</small></span>
    </button>`).join('')}
  </div>`;
}

function quickThemeButtonMarkup() {
  const selected = currentUserSettings?.theme || 'system';
  const resolved = document.documentElement.dataset.appearance || (selected === 'light' ? 'light' : 'dark');
  const next = selected === 'dark' ? 'light' : selected === 'light' ? 'system' : 'dark';
  const symbol = resolved === 'light' ? '☀' : '☾';
  return `<button class="icon-button theme-quick-button" type="button" data-theme-cycle data-theme-next="${next}" aria-label="Appearance: ${escapeHTML(selected)}. Change appearance" title="Appearance: ${escapeHTML(selected)}"><span aria-hidden="true">${symbol}</span></button>`;
}

async function persistCurrentSettings(patch = {}) {
  const next = normalizeUserSettings(
    { ...currentUserSettings, ...patch },
    { timeZone: browserTimeZone() }
  );
  const saved = await saveUserSettings(state.mode, state.user.uid, next);
  const localOnly = saved?.__localOnly === true;
  currentUserSettings = normalizeUserSettings(saved, { timeZone: browserTimeZone() });
  applyRuntimeSettings(currentUserSettings);
  return { ...currentUserSettings, __localOnly:localOnly };
}

async function handleSettingsPreferencesSave(form) {
  const fd = new FormData(form);
  const submit = form.querySelector('button[type="submit"]');
  const status = form.querySelector('[data-settings-save-state]');
  if (status) status.textContent = 'Saving…';
  await withButton(submit, async () => {
    try {
      await persistCurrentSettings({
        region:String(fd.get('region') || '').trim(),
        timeZone:String(fd.get('timeZone') || browserTimeZone()).trim()
      });
      if (status) status.textContent = 'Saved';
      toast('Preferences saved.', 'success');
      renderSettings();
    } catch (error) {
      if (status) status.textContent = 'Couldn’t save';
      toast(humanError(error), 'error');
    }
  });
}

function renderSettings() {
  const p = state.profile || {};
  const model = buildSettingsModel({ profile:p, user:state.user || {}, settings:currentUserSettings, adminAuthorized:adminCapability });
  const s = model.settings;
  const privacyIdentity = {
    fullName:model.identity.name,
    email:model.identity.email,
    username:p.username || ''
  };
  const deletionRequestHref = buildPrivacyRequestMailto('deletion', privacyIdentity);
  const accessRequestHref = buildPrivacyRequestMailto('access', privacyIdentity);
  const portabilityRequestHref = buildPrivacyRequestMailto('portability', privacyIdentity);
  const tabButton = (id, label) => `<button class="${settingsTab === id ? 'active' : ''}" type="button" data-settings-tab="${id}" role="tab" aria-selected="${settingsTab === id}">${label}</button>`;
  const panelClass = id => `settings25-panel ${settingsTab === id ? 'active' : ''}`;
  const providerIsPassword = model.identity.provider === 'Email and password';

  const overview = `
    <section class="${panelClass('overview')}" data-settings-panel="overview" role="tabpanel">
      <article class="settings25-card">
        <div class="settings25-card-head"><div><h2>Account overview</h2><p>Your private account controls are kept separate from your public student profile.</p></div><button class="btn btn-secondary" type="button" data-route="profile">Open public profile</button></div>
        <div class="settings25-identity">
          <div class="settings25-fact"><small>Primary email</small><strong>${escapeHTML(model.identity.email || 'No email available')}</strong></div>
          <div class="settings25-fact"><small>Sign-in provider</small><strong>${escapeHTML(model.identity.provider)}</strong></div>
          <div class="settings25-fact"><small>Email status</small><strong>${model.identity.emailVerified ? 'Verified' : 'Not verified / provider managed'}</strong></div>
          <div class="settings25-fact"><small>Current plan</small><strong>${escapeHTML(model.plan.label)}</strong></div>
        </div>
      </article>
      <article class="settings25-card">
        <div class="settings25-plan"><div><span class="opportunity-kicker">PLAN & BILLING</span><strong>${escapeHTML(model.plan.label)}</strong><p>${model.plan.admin ? 'Administrative access is controlled by Tefsen authorization.' : model.plan.subscribed ? 'Your existing Tefsen subscription is active on this account.' : 'Your account currently uses the free student plan.'}</p></div><button class="btn btn-secondary" type="button" data-route="subscription">View subscription</button></div>
      </article>
      <article class="settings25-card">
        <div class="settings25-card-head"><div><h2>Public profile is edited separately</h2><p>Name, username, bio and profile photo belong to your public identity. Student Passport, Journeys, saved content and these settings remain private.</p></div><button class="btn btn-primary" type="button" data-edit-profile>Edit public profile</button></div>
      </article>
    </section>`;

  const preferences = `
    <section class="${panelClass('preferences')}" data-settings-panel="preferences" role="tabpanel">
      <article class="settings25-card">
        <div class="settings25-card-head"><div><h2>Web experience</h2><p>These preferences are saved to your private Tefsen account and restored only for you.</p></div></div>
        <div class="settings25-row"><div class="settings25-row-copy"><b>Compact Community cards</b><p>Reduce vertical spacing in public Community discussions.</p></div>${settingsToggleMarkup('compactFeed',s.compactFeed,'Compact Community cards')}</div>
        <div class="settings25-row"><div class="settings25-row-copy"><b>Reduced motion</b><p>Minimize nonessential animations and transitions across Tefsen Web.</p></div>${settingsToggleMarkup('reducedMotion',s.reducedMotion,'Reduced motion')}</div>
      </article>
      <article class="settings25-card">
        <div class="settings25-card-head"><div><h2>Appearance & language</h2><p>Choose Light, Dark, or follow your device. Your choice is saved to this Tefsen account.</p></div></div>
        ${settingsThemeMarkup(s.theme)}
        <div class="settings25-identity settings25-language-fact">
          <div class="settings25-fact"><small>Current appearance</small><strong>${escapeHTML(s.theme === 'light' ? 'Light' : s.theme === 'dark' ? 'Dark' : 'System')}</strong></div>
          <div class="settings25-fact"><small>Interface language</small><strong>English</strong></div>
        </div>
      </article>
      <article class="settings25-card">
        <div class="settings25-card-head"><div><h2>Region & time zone</h2><p>Tefsen is global. Region context is optional; deadline dates still need verification on each official provider source.</p></div></div>
        <form class="settings25-form" data-settings-preferences-form>
          <div class="settings25-form-grid">
            <div class="field"><label for="settings-region">Country / region</label><input id="settings-region" class="input" name="region" maxlength="80" value="${escapeHTML(s.region)}" placeholder="Optional"><small>Used only as your private preference context.</small></div>
            <div class="field"><label for="settings-timezone">Time zone</label><input id="settings-timezone" class="input" name="timeZone" maxlength="100" value="${escapeHTML(s.timeZone || browserTimeZone())}"><small>Example: Asia/Colombo, Europe/London, America/New_York.</small></div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><button class="btn btn-primary" type="submit">Save region settings</button><span class="settings25-saved" data-settings-save-state></span></div>
        </form>
      </article>
    </section>`;

  const notifications = `
    <section class="${panelClass('notifications')}" data-settings-panel="notifications" role="tabpanel">
      <article class="settings25-card">
        <div class="settings25-card-head"><div><h2>Notification preferences</h2><p>These controls affect the real Tefsen notification center. Turning a category off removes those supported alerts from your notification view.</p></div><button class="btn btn-secondary" type="button" data-route="notifications">Open Notifications</button></div>
        <div class="settings25-row"><div class="settings25-row-copy"><b>Opportunity deadline alerts</b><p>Stored public opportunity deadlines that are close enough to need attention.</p></div>${settingsToggleMarkup('notificationOpportunityDeadlines',s.notificationOpportunityDeadlines,'Opportunity deadline alerts')}</div>
        <div class="settings25-row"><div class="settings25-row-copy"><b>Journey planning reminders</b><p>Private preparation targets, next Journey tasks and accepted-offer planning reminders.</p></div>${settingsToggleMarkup('notificationJourneyReminders',s.notificationJourneyReminders,'Journey planning reminders')}</div>
        <div class="settings25-row"><div class="settings25-row-copy"><b>Community activity</b><p>Supported replies, likes and public Community activity records for your posts.</p></div>${settingsToggleMarkup('notificationCommunityActivity',s.notificationCommunityActivity,'Community activity notifications')}</div>
      </article>
      <article class="settings25-card"><div class="settings25-security-note"><b>Essential account and security messages are not disabled here.</b> If Tefsen needs to communicate an important account or safety issue, it should not be hidden behind an engagement preference.</div></article>
    </section>`;

  const privacy = `
    <section class="${panelClass('privacy')}" data-settings-panel="privacy" role="tabpanel">
      <article class="settings25-card">
        <div class="settings25-card-head"><div><h2>Privacy boundaries</h2><p>A simple view of what stays in your account and what can be visible when you deliberately publish it.</p></div></div>
        <div class="settings25-privacy-grid">
          <div class="settings25-privacy-box"><span>PRIVATE TO YOUR ACCOUNT</span><ul class="settings25-list">${model.privacy.privateItems.map(item=>`<li>${escapeHTML(item)}</li>`).join('')}</ul></div>
          <div class="settings25-privacy-box"><span>POTENTIALLY PUBLIC</span><ul class="settings25-list">${model.privacy.publicItems.map(item=>`<li>${escapeHTML(item)}</li>`).join('')}</ul></div>
        </div>
      </article>
      <article class="settings25-card">
        <div class="settings25-card-head"><div><h2>Privacy documents & requests</h2><p>Read Tefsen’s published privacy information or start a privacy request from your signed-in account. Requests open your email app; nothing is sent automatically.</p></div></div>
        <div class="account-actions">
          <a class="btn btn-secondary" href="../privacy-policy/">Privacy policy</a>
          <a class="btn btn-secondary" href="${escapeHTML(accessRequestHref)}">Request access to my data</a>
          <a class="btn btn-secondary" href="${escapeHTML(portabilityRequestHref)}">Request portable data</a>
          <a class="btn btn-secondary" href="../delete-account/">Account deletion information</a>
        </div>
      </article>
    </section>`;

  const security = `
    <section class="${panelClass('security')}" data-settings-panel="security" role="tabpanel">
      <article class="settings25-card">
        <div class="settings25-card-head"><div><h2>Sign-in & security</h2><p>Tefsen shows the authentication method attached to this session without exposing internal Firebase identifiers.</p></div></div>
        <div class="settings25-identity">
          <div class="settings25-fact"><small>Provider</small><strong>${escapeHTML(model.identity.provider)}</strong></div>
          <div class="settings25-fact"><small>Email</small><strong>${escapeHTML(model.identity.email || 'Unavailable')}</strong></div>
        </div>
        <div class="settings25-row"><div class="settings25-row-copy"><b>Password management</b><p>${providerIsPassword ? 'This account uses email/password authentication. Tefsen can send a secure password-reset email.' : `Your password is managed by ${escapeHTML(model.identity.provider)}. Tefsen does not have access to that provider password.`}</p></div>${providerIsPassword ? '<button class="btn btn-secondary" type="button" data-settings-reset-password>Send reset email</button>' : '<span class="settings25-status good">Provider managed</span>'}</div>
        <div class="settings25-row"><div class="settings25-row-copy"><b>Current session</b><p>Signing out removes this authenticated session. Private caches are keyed by account so another signed-in student does not inherit your settings.</p></div><button class="btn btn-secondary" type="button" data-logout>Sign out</button></div>
      </article>
      <article class="settings25-card settings25-danger">
        <div class="settings25-card-head"><div><h2>Account deletion</h2><p>Tefsen Web does not delete the account immediately from this browser. You can review the deletion scope and timeline, then send a verified deletion request to Tefsen support.</p></div></div>
        <div class="settings25-security-note"><b>Google Play subscriptions are separate.</b> Deleting your Tefsen account does not automatically cancel a Google Play subscription. Cancel it in Google Play if you no longer want renewal charges.</div>
        <div class="account-actions">
          <a class="btn btn-secondary" href="../delete-account/">Review deletion details</a>
          <a class="btn btn-danger" href="${escapeHTML(deletionRequestHref)}">Request account deletion</a>
        </div>
      </article>
    </section>`;

  const content = `${demoBanner()}<div class="settings25-page">
    <section class="settings25-hero">
      <div class="settings25-hero-main">${avatar(p,'lg')}<div class="settings25-hero-copy"><span>ACCOUNT CONTROL CENTER</span><h1>${escapeHTML(model.identity.name)}</h1><p>Manage private preferences, notifications, privacy, security and your Tefsen plan from one place.</p></div></div>
      <div class="settings25-hero-actions"><button class="btn btn-secondary" type="button" data-route="profile">Public profile</button><button class="btn btn-primary" type="button" data-route="subscription">Plan & billing</button></div>
    </section>
    <div class="settings25-grid">
      <aside class="settings25-nav" role="tablist" aria-label="Settings sections">${tabButton('overview','Overview')}${tabButton('preferences','Preferences')}${tabButton('notifications','Notifications')}${tabButton('privacy','Privacy')}${tabButton('security','Security')}</aside>
      <div>${overview}${preferences}${notifications}${privacy}${security}</div>
    </div>
  </div>`;
  renderShell(content,{wide:true,right:false});
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

function adminReportCard(report) {
  const active=['open','in_review'].includes(report.status);
  const sourceLabel=report.source==='support_requests'?'Legacy report':'Canonical report';
  const created=report.createdAt ? relativeTime(report.createdAt) : '';
  return `<article class="admin-row moderation27-row">
    <div>
      <div class="moderation27-meta">
        <span class="admin-status ${report.status==='open'?'pending':report.status==='in_review'?'stale':'fresh'}">${escapeHTML(report.status.replace('_',' '))}</span>
        <span class="opportunity-chip">${escapeHTML(sourceLabel)}</span>
        <span class="opportunity-chip">${escapeHTML(report.reason)}</span>
        ${created?`<small>${escapeHTML(created)}</small>`:''}
      </div>
      <h3>${escapeHTML(report.targetTitle||'Reported Community post')}</h3>
      ${report.targetExcerpt?`<p class="moderation27-excerpt">${escapeHTML(report.targetExcerpt)}</p>`:''}
      ${report.details?`<div class="moderation27-details"><b>Reporter context</b><span>${escapeHTML(report.details)}</span></div>`:''}
      ${!active&&report.resolution?`<p class="moderation27-resolution">Outcome: ${escapeHTML(report.resolution.replaceAll('_',' '))}</p>`:''}
    </div>
    <div class="admin-row-actions">
      <button class="btn btn-secondary" type="button" data-route="post/${encodeURIComponent(report.postId)}">Review post</button>
      ${active?`<button class="btn btn-danger" type="button" data-admin-moderation-action="hide_post" data-admin-report-id="${escapeHTML(report.id)}" data-admin-report-source="${escapeHTML(report.source)}">Hide post</button>
      <button class="btn btn-secondary" type="button" data-admin-moderation-action="resolve" data-admin-report-id="${escapeHTML(report.id)}" data-admin-report-source="${escapeHTML(report.source)}">Resolve</button>
      <button class="btn btn-ghost" type="button" data-admin-moderation-action="dismiss" data-admin-report-id="${escapeHTML(report.id)}" data-admin-report-source="${escapeHTML(report.source)}">Dismiss</button>`:''}
    </div>
  </article>`;
}

async function renderAdmin() {
  if (!adminCapability) {
    const adminUid = escapeHTML(state.user?.uid || 'Unavailable');
    renderShell(`
      ${emptyState('info','Admin authorization required','Tefsen protects publishing and moderation with a Firebase Auth custom claim. Your public username or profile role cannot grant admin access by itself.')}
      <section class="panel section-card" style="margin-top:16px">
        <div class="panel-title"><div><h2>Secure admin setup</h2><small>Firebase Auth custom claim required</small></div></div>
        <div class="community-banner" style="margin-bottom:14px">
          <b>Signed-in Firebase UID</b><br>
          <code style="display:block;margin-top:8px;word-break:break-all;user-select:all">${adminUid}</code>
        </div>
        <p style="color:var(--muted);line-height:1.7;margin:0">
          Grant this exact Firebase Authentication user the custom claim <code>admin: true</code> from a trusted Firebase Admin SDK environment, then sign out and sign back in so the ID token refreshes. Do not grant admin by matching the username <b>JsJr</b> in browser code.
        </p>
      </section>`, { wide:true, right:false });
    return;
  }

  renderShell(`<header class="page-head"><div><h1>Admin review</h1><p>Loading authorized review queues…</p></div></header><div class="loading-card"></div>`, { wide:true, right:false });
  try {
    currentAdminOpportunities = await listAdminOpportunities(state.mode, state.user, state.profile);
    if(adminTab==='reports'){
      currentAdminReports = await listAdminReports(state.mode,state.user,state.profile);
    }

    const withFreshness = currentAdminOpportunities.map(item => ({ item, freshness: opportunityFreshness(item) }));
    const pending = withFreshness.filter(x => ['pending','unverified'].includes(x.freshness.state)).length;
    const needsReview = withFreshness.filter(x => x.freshness.needsReview).length;
    const verified = currentAdminOpportunities.filter(x => x.verificationStatus === 'verified').length;
    const reviewRows = withFreshness
      .filter(x => x.freshness.needsReview || x.item.verificationStatus !== 'verified')
      .sort((x,y) => Number(y.freshness.needsReview) - Number(x.freshness.needsReview));

    const reviewPanel = `<section class="admin-list">${reviewRows.length ? reviewRows.map(({item}) => `<article class="admin-row">
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

    const moderationModel=buildModerationQueue(currentAdminReports);
    const reportsPanel=`<div class="moderation27-panel">
      <section class="moderation27-note">${icon('info',16)}<span>Reports are private moderation signals, not proof that content violates policy. Review the post and context before taking action.</span></section>
      <section class="admin-list">${moderationModel.active.length?moderationModel.active.map(adminReportCard).join(''):'<div class="panel opportunity-empty">No active Community reports need review.</div>'}</section>
      ${moderationModel.resolved.length?`<section class="moderation27-history"><header><span class="opportunity-kicker">RECENT OUTCOMES</span><h2>Reviewed reports</h2></header><div class="admin-list">${moderationModel.resolved.slice(0,30).map(adminReportCard).join('')}</div></section>`:''}
    </div>`;

    const appCheckReadiness=buildAppCheckReadiness({
      mode:state.mode,
      siteKey:window.TEFSEN_APPCHECK_SITE_KEY,
      initialized:Boolean(appCheck)
    });
    const reportStats=buildModerationQueue(currentAdminReports);
    const hero=adminTab==='reports'
      ? `<section class="admin-hero moderation27-hero"><div><span class="opportunity-kicker">TRUST & SAFETY</span><h1>Community moderation</h1><p>Review private student reports, inspect the reported public post, and record every admin action in an append-only audit trail.</p></div><div class="admin-stat"><strong>${reportStats.counts.open}</strong><span>open reports</span></div><div class="admin-stat"><strong>${reportStats.counts.inReview}</strong><span>in review</span></div><div class="admin-stat"><strong>${reportStats.counts.legacy}</strong><span>legacy reports</span></div></section>`
      : `<section class="admin-hero"><div><span class="opportunity-kicker">TRUST & DATA QUALITY</span><h1>Opportunity review</h1><p>Verification requires a real official source. Imported records stay private until an authorized admin reviews and publishes them.</p></div><div class="admin-stat"><strong>${pending}</strong><span>pending / unverified</span></div><div class="admin-stat"><strong>${needsReview}</strong><span>need review now</span></div><div class="admin-stat"><strong>${verified}</strong><span>verified records</span></div></section>`;

    const content = `${demoBanner()}<div class="admin-shell">
      ${state.mode === 'firebase' && appCheckReadiness.state==='missing-key' ? '<div class="community-banner"><b>Launch blocker:</b> Web App Check site key is missing. Configure the reCAPTCHA v3 App Check key, validate real traffic, then enable enforcement service-by-service in Firebase Console.</div>' : ''}
      ${state.mode === 'firebase' && appCheckReadiness.state==='initialization-failed' ? '<div class="community-banner"><b>Launch blocker:</b> An App Check key is configured, but App Check did not initialize in this session. Fix initialization before considering enforcement.</div>' : ''}
      ${state.mode === 'firebase' && appCheckReadiness.state==='client-ready' ? '<div class="community-banner"><b>App Check client initialized.</b> This does not prove enforcement is enabled. Verify valid traffic first, then confirm enforcement separately for Firestore, Storage and other protected Firebase services in Firebase Console.</div>' : ''}
      ${hero}
      <div class="admin-tabs"><button class="btn ${adminTab==='review'?'btn-primary':'btn-secondary'}" data-admin-tab="review">Opportunity review</button><button class="btn ${adminTab==='import'?'btn-primary':'btn-secondary'}" data-admin-tab="import">Opportunity import</button><button class="btn ${adminTab==='reports'?'btn-primary':'btn-secondary'}" data-admin-tab="reports">Community reports</button></div>
      ${adminTab==='reports'?reportsPanel:adminTab==='import'?importPanel:reviewPanel}
    </div>`;
    renderShell(content,{wide:true,right:false});
  } catch (error) {
    console.error(error);
    renderShell(`${emptyState('info','Admin tools unavailable',humanError(error))}`,{wide:true,right:false});
  }
}

function global20KindLabel(kind='') {
  return ({
    person:'Student',
    discussion:'Discussion',
    success:'Success story',
    journey:'Journey story',
    opportunity:'Opportunity',
    subject:'Subject',
    university:'University',
    intake:'Intake'
  })[kind] || 'Result';
}

function global20ResultMarkup(result) {
  const person=result.kind==='person';
  const badge=person
    ? avatar({fullName:result.title,photoUrl:result.photoUrl},'sm')
    : `<span class="global20-result-mark ${escapeHTML(result.kind)}">${escapeHTML(global20KindLabel(result.kind).slice(0,3).toUpperCase())}</span>`;
  const verification=result.kind==='opportunity' && result.verified
    ? '<span class="global20-verified">Verified source record</span>'
    : '';
  return `<button class="global20-result" type="button" data-route="${escapeHTML(result.route)}">
    <span class="global20-result-visual">${badge}</span>
    <span class="global20-result-copy">
      <span class="global20-result-type">${escapeHTML(global20KindLabel(result.kind))}${verification}</span>
      <strong>${escapeHTML(result.title)}</strong>
      ${result.subtitle ? `<small>${escapeHTML(result.subtitle)}</small>` : ''}
      ${result.excerpt ? `<p>${escapeHTML(result.excerpt)}</p>` : ''}
    </span>
    <span class="global20-result-open">→</span>
  </button>`;
}

function global20Section(title,eyebrow,rows,description='') {
  if(!rows?.length) return '';
  return `<section class="global20-section">
    <header class="global20-section-head">
      <div><span class="opportunity-kicker">${escapeHTML(eyebrow)}</span><h2>${escapeHTML(title)}</h2>${description ? `<p>${escapeHTML(description)}</p>` : ''}</div>
      <span>${rows.length} result${rows.length===1?'':'s'}</span>
    </header>
    <div class="global20-results">${rows.slice(0,8).map(global20ResultMarkup).join('')}</div>
  </section>`;
}

function global20DiscoveryMarkup(model) {
  const subjects=model.discover.subjects||[];
  const universities=model.discover.universities||[];
  const opportunities=model.discover.opportunities||[];
  return `<div class="global20-discovery">
    <section class="global20-discovery-block">
      <header><span class="opportunity-kicker">START WITH A SUBJECT</span><h2>Explore learning spaces</h2><p>Open a subject community to see public student context and linked opportunities.</p></header>
      <div class="global20-discovery-grid">
        ${subjects.length ? subjects.map(row=>`<button type="button" data-route="subject/${encodeURIComponent(row.name)}"><span>SUBJECT</span><b>${escapeHTML(row.name)}</b><small>${row.postCount} public posts · ${row.opportunityCount} opportunities</small></button>`).join('') : '<div class="global20-discovery-empty">Subject spaces appear as public Community and opportunity data grows.</div>'}
      </div>
    </section>
    <section class="global20-discovery-block">
      <header><span class="opportunity-kicker">UNIVERSITY SPACES</span><h2>Browse student context</h2><p>Community information is student context, not an official university channel.</p></header>
      <div class="global20-discovery-grid">
        ${universities.length ? universities.map(row=>`<button type="button" data-route="university/${encodeURIComponent(row.name)}"><span>UNIVERSITY</span><b>${escapeHTML(row.name)}</b><small>${escapeHTML((row.countries||[]).slice(0,2).join(' · ') || 'Global community')}</small></button>`).join('') : '<div class="global20-discovery-empty">University spaces appear when public community or opportunity records link to them.</div>'}
      </div>
    </section>
    <section class="global20-discovery-block">
      <header><span class="opportunity-kicker">OPPORTUNITIES</span><h2>Discover verified-source paths</h2><p>Open a record to review eligibility context and the official provider source.</p></header>
      <div class="global20-discovery-grid opportunities">
        ${opportunities.length ? opportunities.map(item=>`<button type="button" data-route="opportunity/${encodeURIComponent(item.id)}"><span>OPPORTUNITY</span><b>${escapeHTML(item.title)}</b><small>${escapeHTML([item.provider,item.country].filter(Boolean).join(' · '))}</small></button>`).join('') : '<div class="global20-discovery-empty">No public opportunity records are available for discovery yet.</div>'}
      </div>
    </section>
  </div>`;
}

async function renderSearch(term = '') {
  const query=String(term||'').trim().slice(0,120);
  state.searchQuery=query;

  renderShell(`<div class="global20-page"><section class="global20-hero loading"><span class="opportunity-kicker">PUBLIC SEARCH</span><h1>${query ? `Searching for “${escapeHTML(query)}”` : 'Search Tefsen'}</h1><p>Checking public student, Community and opportunity records without exposing private account data.</p></section></div>`,{wide:true,right:false});

  try{
    let rawSearch={users:[],posts:[],coverage:{people:{scanned:0,limit:0,complete:true},community:{scanned:0,limit:0,complete:true}}};
    let opportunitySearch={items:[],coverage:{scanned:0,limit:0,complete:true}};

    if(query){
      [rawSearch,opportunitySearch]=await Promise.all([
        searchAll(state.mode,query),
        getOpportunitySearchCorpus(state.mode)
      ]);
    }else{
      const opportunities=await getOpportunities(state.mode).catch(()=>[]);
      opportunitySearch={items:opportunities,coverage:{scanned:opportunities.length,limit:opportunities.length,complete:true}};
    }

    const publicPosts=query
      ? mergeSearchPublicPosts(state.posts,rawSearch.posts)
      : mergeSearchPublicPosts(state.posts);

    currentSearch=buildGlobalSearchModel({
      term:query,
      users:rawSearch.users,
      posts:publicPosts,
      opportunities:opportunitySearch.items,
      coverage:{
        people:rawSearch.coverage?.people,
        community:rawSearch.coverage?.community,
        opportunities:opportunitySearch.coverage
      }
    });

    const countItems=query ? [
      ['All',currentSearch.counts.all],
      ['People',currentSearch.counts.people],
      ['Community',currentSearch.counts.community],
      ['Opportunities',currentSearch.counts.opportunities],
      ['Subjects',currentSearch.counts.subjects],
      ['Universities',currentSearch.counts.universities],
      ['Intakes',currentSearch.counts.intakes]
    ] : [];

    const emptyTitle=currentSearch.coverage?.complete
      ? `No public matches for “${escapeHTML(query)}”`
      : `No match found in the current search coverage for “${escapeHTML(query)}”`;
    const emptyCopy=currentSearch.coverage?.complete
      ? 'Try a broader subject, university, country, scholarship name, program, student name or intake.'
      : 'This search window is bounded, so a matching public record may exist outside the records checked. Try a more specific name, username, university or opportunity title.';

    const content=`${demoBanner()}
      <div class="global20-page">
        <section class="global20-hero">
          <div>
            <span class="opportunity-kicker">PUBLIC SEARCH</span>
            <h1>${query ? `Results for “${escapeHTML(query)}”` : 'Find the right public place to continue'}</h1>
            <p>Search public student profiles, discussions, Success and Journey stories, public opportunity records, subjects, universities and intake spaces. Private Passport, Journey and account data are never part of this search.</p>
            <form class="global20-search-form" data-global-search-form>
              <input class="input" name="q" maxlength="120" value="${escapeHTML(query)}" placeholder="Try Computer Science, scholarship, university, student name…" aria-label="Search public Tefsen data">
              <button class="btn btn-primary" type="submit">${icon('search',17)} Search</button>
            </form>
          </div>
          <aside class="global20-scope">
            <span>WHAT SEARCH INCLUDES</span>
            <div><b>Public student context</b><small>Public profile identity and published Community content only.</small></div>
            <div><b>Opportunity discovery</b><small>Public opportunity metadata with official-source trust boundaries.</small></div>
            <div><b>Honest coverage</b><small>Search tells you when a result window is bounded instead of presenting partial results as a complete global index.</small></div>
          </aside>
        </section>

        ${query ? `<section class="global29-coverage ${currentSearch.coverage.complete?'complete':'partial'}">
          <div>${icon(currentSearch.coverage.complete?'check':'info',17)}<span><b>${currentSearch.coverage.complete?'Complete current corpus':'Bounded search coverage'}</b><small>${escapeHTML(currentSearch.coverage.note)}</small></span></div>
          <span class="global29-count-label">${escapeHTML(currentSearch.countLabel)}</span>
        </section>
        <section class="global20-counts" aria-label="Matches found in current search coverage">${countItems.map(([label,value])=>`<article><strong>${value}</strong><span>${label}</span></article>`).join('')}</section>` : ''}

        ${query ? `
          <section class="global20-ranking-note">${icon('info',16)}<span>${escapeHTML(currentSearch.rankingNote)}</span></section>
          ${currentSearch.empty ? `<section class="global20-empty"><div>${icon('search',24)}</div><h2>${emptyTitle}</h2><p>${emptyCopy}</p><button class="btn btn-secondary" type="button" data-route="search">Clear search</button></section>` : `
            ${global20Section('Best matching public results','TOP MATCHES',currentSearch.top,'A mixed view across the records checked. Result order is deterministic text matching, not a recommendation or quality score.')}
            ${global20Section('People','PUBLIC STUDENTS',currentSearch.people,'Only public profile fields are shown here. Counts are matches found in the current search coverage.')}
            ${global20Section('Community posts and stories','PUBLIC COMMUNITY',currentSearch.community,'Published discussions and student-shared Success/Journey stories in the current search coverage.')}
            ${global20Section('Opportunities','OFFICIAL-SOURCE DISCOVERY',currentSearch.opportunities,'Open each result to verify eligibility, deadline and application details on the official provider source.')}
            ${global20Section('Subject spaces','LEARNING COMMUNITIES',currentSearch.subjects)}
            ${global20Section('University spaces','STUDENT CONTEXT',currentSearch.universities,'These are student community spaces derived from the public records checked, not official university channels.')}
            ${global20Section('Intake spaces','INTAKE CONTEXT',currentSearch.intakes,'Intake pages show public student context and exact intake-linked data where available.')}
          `}`
          : global20DiscoveryMarkup(currentSearch)}
      </div>`;

    renderShell(content,{wide:true,right:false});
  }catch(error){
    console.error(error);
    renderShell(`${demoBanner()}${emptyState('info','Search unavailable','Tefsen could not safely load the public search corpus. Please try again.')}`,{wide:true,right:false});
  }
}

function renderRoute() {
  if (!state.user) return;
  const [route, param, param2] = routeParts();
  state.ui.profileMenu = false;
  document.documentElement.classList.remove('profile-menu-open');
  document.querySelectorAll('.profile-menu-backdrop, .profile-dropdown').forEach(el => el.remove());
  if (stopComments && route !== 'post') { stopComments(); stopComments = null; }
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
    case 'messages': renderPrivateMessagingUnavailable(); break;
    case 'leaderboard': renderLeaderboardRetired(); break;
    case 'profile': renderProfile(param || ''); break;
    case 'settings': {
      const allowedSettingsTabs = new Set(['overview','preferences','notifications','privacy','security']);
      if (param && allowedSettingsTabs.has(param)) settingsTab = param;
      renderSettings();
      break;
    }
    case 'admin': renderAdmin(); break;
    case 'subscription': renderSubscription(); break;
    case 'post': renderPostDetail(param || ''); break;
    case 'search': renderSearch(param || new URLSearchParams(location.hash.split('?')[1] || '').get('q') || ''); break;
    default: renderHome();
  }
}


function openSuccessStoryModal(prefill = {}) {
  modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop><section class="modal success18-modal" role="dialog" aria-modal="true" aria-labelledby="success18-title"><header class="modal-head"><div><span class="success18-modal-kicker">PUBLIC STUDENT EXPERIENCE</span><h2 id="success18-title">Share a student success</h2></div><button class="close-btn" data-close-modal>${icon('close',19)}</button></header><div class="modal-body">
    <section class="success18-publish-intro">
      <div><b>Share what happened</b><span>The offer, scholarship, admission or other outcome you personally received.</span></div>
      <div><b>Add useful context</b><span>What helped, what surprised you, or what another student should verify for themselves.</span></div>
      <div><b>Keep private data out</b><span>No application IDs, passport/visa numbers, addresses, financial account details, booking references or private documents.</span></div>
    </section>
    <form class="form-grid success18-form" data-success-story-form>
      <div class="story-form-grid">
        <div class="field"><label>University / institution <span>Required</span></label><input class="input" name="university" maxlength="180" required value="${escapeHTML(prefill.university||'')}" placeholder="Institution connected to this outcome"></div>
        <div class="field"><label>Scholarship / program / offer <span>Required</span></label><input class="input" name="opportunityName" maxlength="180" required placeholder="Name of the scholarship, program or offer"></div>
        <div class="field"><label>Country</label><input class="input" name="country" maxlength="120" placeholder="Optional destination context"></div>
        <div class="field"><label>Subject / field <span>Required</span></label><input class="input" name="subject" maxlength="120" required value="${escapeHTML(prefill.subject||'')}" placeholder="e.g. Computer Science"></div>
        <div class="field"><label>Study level</label><input class="input" name="studyLevel" maxlength="100" placeholder="Undergraduate, Master's…"></div>
        <div class="field"><label>Intake / year</label><input class="input" name="intake" maxlength="80" value="${escapeHTML(prefill.intake||'')}" placeholder="e.g. Fall 2027"></div>
        <div class="field"><label>Funding</label><select class="select" name="fundingType"><option value="">Not specified</option><option>Fully funded</option><option>Partial funding</option><option>Self funded / offer only</option><option>Other</option></select></div>
        <div class="field story-form-wide"><label>Headline</label><input class="input" name="title" maxlength="180" placeholder="e.g. I received a scholarship offer"></div>
        <div class="field story-form-wide"><label>Your story <span>Required · at least 40 characters</span></label><textarea class="textarea success18-story-text" name="content" maxlength="3000" required placeholder="What happened? What helped you? What should another student verify on the official source?"></textarea><small class="form-help">Write from your own experience. Do not present your result as a guarantee for another student.</small></div>
      </div>
      <section class="success18-public-note">
        ${icon('info',16)}
        <div><b>This will be public</b><p>The structured facts above and your story text can appear in Community, subject, university and intake spaces when they match. Official provider information remains authoritative.</p></div>
      </section>
      <div class="form-error" data-story-error></div>
      <div class="success18-publish-actions"><button class="btn btn-ghost" type="button" data-close-modal>Cancel</button><button class="btn btn-primary" type="submit">Publish success story</button></div>
    </form>
  </div></section></div>`;
}

function openJourneyStoryModal(prefill = {}) {
  const rows=[1,2,3,4].map(i=>`
    <div class="journey19-milestone-row">
      <div class="field"><label>Milestone ${i} stage ${i===1?'<span>Required</span>':''}</label><input class="input" name="stage${i}" maxlength="80" placeholder="e.g. Applied, Interview, Offer received"></div>
      <div class="field"><label>Month</label><input class="input" name="month${i}" type="month"></div>
      <div class="field journey19-note-field"><label>What you choose to share</label><input class="input" name="note${i}" maxlength="300" placeholder="Optional public context — no IDs, documents or private details"></div>
    </div>`).join('');

  modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop><section class="modal journey19-modal" role="dialog" aria-modal="true" aria-labelledby="journey19-title"><header class="modal-head"><div><span class="journey19-modal-kicker">PUBLIC JOURNEY STORY</span><h2 id="journey19-title">Share selected Journey milestones</h2></div><button class="close-btn" data-close-modal>${icon('close',19)}</button></header><div class="modal-body">
    <section class="journey19-publish-intro">
      <div><b>Nothing is imported automatically</b><span>Your private Journey stage, checklist, target dates, notes and post-acceptance plan stay private.</span></div>
      <div><b>You choose each milestone</b><span>Only the subject, university/intake context, introduction and milestone fields you enter here become public.</span></div>
      <div><b>Protect sensitive details</b><span>No application IDs, passport/visa numbers, booking references, exact addresses, account/card numbers or private documents.</span></div>
    </section>
    <form class="form-grid journey19-form" data-journey-story-form>
      <div class="story-form-grid">
        <div class="field"><label>Subject / field <span>Required</span></label><input class="input" name="subject" maxlength="120" required value="${escapeHTML(prefill.subject||'')}" placeholder="e.g. Computer Science"></div>
        <div class="field"><label>University / institution</label><input class="input" name="university" maxlength="180" value="${escapeHTML(prefill.university||'')}" placeholder="Optional public context"></div>
        <div class="field"><label>Intake / year</label><input class="input" name="intake" maxlength="80" value="${escapeHTML(prefill.intake||'')}" placeholder="e.g. Fall 2027"></div>
        <div class="field"><label>Story title <span>Required</span></label><input class="input" name="title" maxlength="180" required placeholder="My scholarship application Journey"></div>
        <div class="field story-form-wide"><label>Introduction <span>Required · at least 40 characters</span></label><textarea class="textarea journey19-intro-text" name="content" maxlength="3000" required placeholder="What was this Journey about? What context would help another student understand your timeline?"></textarea><small class="form-help">Share personal context, not instructions or guarantees for someone else.</small></div>
      </div>

      <section class="journey19-milestones">
        <header><div><span class="opportunity-kicker">PUBLIC MILESTONES</span><h3>Choose up to four moments</h3><p>Month-level timing is enough. Exact dates are intentionally not requested here.</p></div></header>
        <div class="journey19-milestone-list">${rows}</div>
      </section>

      <section class="journey19-public-note">
        ${icon('info',16)}
        <div><b>This story will be public</b><p>Only the values in this form are published. Tefsen does not copy your private Journey checklist, private notes, target dates, application status history or post-acceptance planning into this story.</p></div>
      </section>

      <div class="form-error" data-story-error></div>
      <div class="journey19-publish-actions"><button class="btn btn-ghost" type="button" data-close-modal>Cancel</button><button class="btn btn-primary" type="submit">Publish Journey story</button></div>
    </form>
  </div></section></div>`;
}

function openCommunityComposer(context = {}) {
  modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop><section class="modal" role="dialog" aria-modal="true"><header class="modal-head"><h2>Community discussion</h2><button class="close-btn" data-close-modal>${icon('close',19)}</button></header><div class="modal-body"><form class="form-grid" data-community-post-form data-community-subject="${escapeHTML(context.subject||'')}" data-community-university="${escapeHTML(context.university||'')}" data-community-intake="${escapeHTML(context.intake||'')}"><div class="community-banner">Keep private application, visa, address, booking and identity details out of public community posts.</div><div class="field"><label>Title / question</label><input class="input" name="title" maxlength="180" required></div><div class="field"><label>Details</label><textarea class="textarea" name="content" maxlength="4000" required></textarea></div><button class="btn btn-primary" type="submit">Publish discussion</button></form></div></section></div>`;
}

function openComposer() {
  const policy = getWebPostingPolicy(state.profile || {}, { admin:adminCapability });
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
  const options=REPORT_REASONS.map(reason=>`<option value="${escapeHTML(reason)}">${escapeHTML(reason)}</option>`).join('');
  modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop><section class="modal" role="dialog" aria-modal="true"><header class="modal-head"><h2>Report content</h2><button class="close-btn" data-close-modal>${icon('close',19)}</button></header><div class="modal-body"><form class="form-grid" data-report-form="${escapeHTML(postId)}"><div class="community-banner"><b>Reports are private.</b> They go to authorized Tefsen moderation review and are not shown to the post author or Community.</div><div class="field"><label>Reason</label><select class="select" name="reason" required><option value="">Choose a reason</option>${options}</select></div><div class="field"><label>Details (optional)</label><textarea class="textarea" name="details" maxlength="1000" placeholder="Add only information needed to explain the concern."></textarea></div><button class="btn btn-danger" type="submit">Submit private report</button></form></div></section></div>`;
}

function canDeletePost(post) {
  if (!post || !state.user?.uid) return false;
  const ownerId = String(post.authorId || post.userId || post.uid || post.ownerId || post.authorUid || post.creatorId || '');
  const ownPost = Boolean(ownerId) && ownerId === String(state.user.uid);
  return ownPost || adminCapability === true;
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
  if (settingsTabEl) { settingsTab = settingsTabEl.dataset.settingsTab || 'overview'; renderSettings(); return; }

  const themeChoice = event.target.closest('[data-settings-theme]');
  if (themeChoice) {
    const theme = themeChoice.dataset.settingsTheme;
    if (!['light','dark','system'].includes(theme)) return;
    themeChoice.disabled = true;
    try {
      const saved = await persistCurrentSettings({ theme });
      toast(saved.__localOnly
        ? `${theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System'} appearance is active on this device. Cloud sync will resume after the settings rules update.`
        : `${theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System'} appearance saved.`, 'success');
      renderSettings();
    } catch (error) {
      themeChoice.disabled = false;
      toast(humanError(error), 'error');
    }
    return;
  }

  const themeCycle = event.target.closest('[data-theme-cycle]');
  if (themeCycle) {
    const theme = themeCycle.dataset.themeNext || 'light';
    themeCycle.disabled = true;
    try {
      const saved = await persistCurrentSettings({ theme });
      toast(saved.__localOnly
        ? `Appearance changed to ${theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System'} on this device.`
        : `Appearance changed to ${theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System'}.`, 'success');
      renderRoute();
    } catch (error) {
      themeCycle.disabled = false;
      toast(humanError(error), 'error');
    }
    return;
  }

  const settingsToggle = event.target.closest('[data-settings-toggle]');
  if (settingsToggle) {
    const key = settingsToggle.dataset.settingsToggle;
    const allowed = new Set(['compactFeed','reducedMotion','notificationOpportunityDeadlines','notificationJourneyReminders','notificationCommunityActivity']);
    if (!allowed.has(key)) return;
    settingsToggle.disabled = true;
    try {
      await persistCurrentSettings({ [key]: !Boolean(currentUserSettings[key]) });
      toast('Setting saved.', 'success');
      renderSettings();
    } catch (error) {
      settingsToggle.disabled = false;
      toast(humanError(error), 'error');
    }
    return;
  }
  if (event.target.closest('[data-settings-reset-password]')) {
    const email = state.user?.email || state.profile?.email || '';
    if (!email) { toast('No account email is available for password reset.', 'error'); return; }
    try {
      await resetPassword(state.mode, email);
      toast('Password reset email sent.', 'success');
    } catch (error) {
      toast(humanError(error), 'error');
    }
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
  if (adminTabButton) { const next=adminTabButton.dataset.adminTab; adminTab=['review','import','reports'].includes(next)?next:'review'; await renderAdmin(); return; }
  const adminReview = event.target.closest('[data-admin-review-action]');
  if (adminReview) { await handleAdminReview(adminReview); return; }
  const adminImportConfirm = event.target.closest('[data-admin-import-confirm]');
  if (adminImportConfirm) { await handleAdminImportConfirm(adminImportConfirm); return; }
  const adminModeration = event.target.closest('[data-admin-moderation-action]');
  if (adminModeration) { await handleAdminModeration(adminModeration); return; }
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
  if (event.target.closest('[data-notifications-mark-all]')) { await handleNotificationsMarkAll(event.target.closest('[data-notifications-mark-all]')); return; }
  const markNotificationSection = event.target.closest('[data-notifications-mark-section]');
  if (markNotificationSection) { await handleNotificationsMarkSection(markNotificationSection, markNotificationSection.dataset.notificationsMarkSection || ''); return; }
  const notification = event.target.closest('[data-notification]');
  if (notification) { await handleNotification(notification); return; }
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
  if (event.target.closest('[data-profile-activity-jump]')) {
    document.getElementById('profile-public-activity')?.scrollIntoView({ behavior:'smooth', block:'start' });
    return;
  }
  if (event.target.closest('[data-edit-profile]')) { openEditProfile(); return; }
  const subject = event.target.closest('[data-subject]');
  if (subject) { state.searchQuery = subject.dataset.subject; go(`search/${encodeURIComponent(subject.dataset.subject)}`); return; }
}

async function handleSubmit(event) {
  const form = event.target;
  if (form.matches('[data-auth-form]')) { event.preventDefault(); await handleAuthForm(form); return; }
  if (form.matches('[data-global-search-form]')) { event.preventDefault(); const term = new FormData(form).get('q')?.trim(); if (term) go(`search/${encodeURIComponent(term)}`); return; }
  if (form.matches('[data-compose-form]')) { event.preventDefault(); await handleCompose(form); return; }
  if (form.matches('[data-comment-form]')) { event.preventDefault(); await handleComment(form); return; }
  if (form.matches('[data-settings-preferences-form]')) { event.preventDefault(); await handleSettingsPreferencesSave(form); return; }
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
  const policy = getWebPostingPolicy(state.profile || {}, { admin:adminCapability });
  const totalBytes = imageFiles.reduce((sum, file) => sum + Number(file.size || 0), 0);
  if (imageFiles.length > policy.maxImagesPerPost) { errorEl.textContent = `Your plan allows ${policy.maxImagesPerPost} image${policy.maxImagesPerPost === 1 ? '' : 's'} per post.`; return; }
  if (totalBytes > policy.maxTotalImageBytes) { errorEl.textContent = `Your plan allows ${Math.round(policy.maxTotalImageBytes/1024/1024)} MB total images per post.`; return; }
  await withButton(submit, async()=>{
    try { const post = await createPost(state.mode,state.user,state.profile,payload,{admin:adminCapability}); modalRoot.innerHTML=''; toast('Published successfully','success'); if (state.mode==='demo') { state.posts=[post,...state.posts]; } go(`post/${post.id}`); }
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
  const fd=new FormData(form);
  const submit=form.querySelector('button[type="submit"]');
  const errorEl=form.querySelector('[data-story-error]');
  const draft=validateSuccessStoryDraft({
    university:fd.get('university'),
    opportunityName:fd.get('opportunityName'),
    country:fd.get('country'),
    subject:fd.get('subject'),
    studyLevel:fd.get('studyLevel'),
    intake:fd.get('intake'),
    fundingType:fd.get('fundingType'),
    title:fd.get('title'),
    content:fd.get('content')
  });

  errorEl.textContent='';
  form.querySelectorAll('[aria-invalid="true"]').forEach(el=>el.removeAttribute('aria-invalid'));

  if(!draft.valid){
    const first=draft.errors[0];
    const field=form.elements.namedItem(first.field);
    const fieldEl=field instanceof RadioNodeList ? field[0] : field;
    fieldEl?.setAttribute?.('aria-invalid','true');
    fieldEl?.focus?.();
    errorEl.textContent=first.message;
    return;
  }

  const value=draft.value;
  const payload={
    title:value.title,
    content:value.content,
    subject:value.subject || 'Student Success',
    tags:['student-success', value.subject].filter(Boolean),
    postType:'success_story',
    successData:{
      university:value.university,
      opportunityName:value.opportunityName,
      country:value.country,
      subject:value.subject,
      studyLevel:value.studyLevel,
      intake:value.intake,
      fundingType:value.fundingType
    },
    communityUniversity:value.university,
    communityIntake:value.intake,
    communitySubject:value.subject,
    imageFiles:[]
  };

  await withButton(submit,async()=>{
    try{
      const post=await createPost(state.mode,state.user,state.profile,payload,{admin:adminCapability});
      modalRoot.innerHTML='';
      if(state.mode==='demo')state.posts=[post,...state.posts];
      toast('Success story published.','success');
      go(`post/${post.id}`);
    }catch(error){
      errorEl.textContent=humanError(error);
    }
  });
}

async function handleJourneyStorySubmit(form) {
  const fd=new FormData(form);
  const submit=form.querySelector('button[type="submit"]');
  const errorEl=form.querySelector('[data-story-error]');
  const milestones=[];
  for(let i=1;i<=4;i++){
    milestones.push({
      stage:fd.get(`stage${i}`),
      month:fd.get(`month${i}`),
      note:fd.get(`note${i}`)
    });
  }

  const draft=validateJourneyStoryDraft({
    subject:fd.get('subject'),
    university:fd.get('university'),
    intake:fd.get('intake'),
    title:fd.get('title'),
    content:fd.get('content'),
    publicMilestones:milestones
  });

  errorEl.textContent='';
  form.querySelectorAll('[aria-invalid="true"]').forEach(el=>el.removeAttribute('aria-invalid'));

  if(!draft.valid){
    const first=draft.errors[0];
    const field=form.elements.namedItem(first.field);
    const fieldEl=field instanceof RadioNodeList ? field[0] : field;
    fieldEl?.setAttribute?.('aria-invalid','true');
    fieldEl?.focus?.();
    errorEl.textContent=first.message;
    return;
  }

  const value=draft.value;
  const payload={
    title:value.title,
    content:value.content,
    subject:value.subject || 'Student Journey',
    tags:['student-journey',value.subject].filter(Boolean),
    postType:'journey_story',
    publicMilestones:value.publicMilestones,
    communitySubject:value.subject,
    communityUniversity:value.university,
    communityIntake:value.intake,
    imageFiles:[]
  };

  await withButton(submit,async()=>{
    try{
      const post=await createPost(state.mode,state.user,state.profile,payload,{admin:adminCapability});
      modalRoot.innerHTML='';
      if(state.mode==='demo')state.posts=[post,...state.posts];
      toast('Journey story published.','success');
      go(`post/${post.id}`);
    }catch(error){
      errorEl.textContent=humanError(error);
    }
  });
}

async function handleCommunityPostSubmit(form) {
  const fd=new FormData(form),submit=form.querySelector('button[type="submit"]');
  const subject=form.dataset.communitySubject||'', university=form.dataset.communityUniversity||'', intake=form.dataset.communityIntake||'';
  const payload={title:String(fd.get('title')||'').trim(),content:String(fd.get('content')||'').trim(),subject:subject||'General',tags:[subject,university,intake].filter(Boolean).slice(0,6),postType:'discussion',communitySubject:subject,communityUniversity:university,communityIntake:intake,imageFiles:[]};
  await withButton(submit,async()=>{try{const post=await createPost(state.mode,state.user,state.profile,payload,{admin:adminCapability});modalRoot.innerHTML='';if(state.mode==='demo')state.posts=[post,...state.posts];toast('Community post published.','success');go(`post/${post.id}`);}catch(error){toast(humanError(error),'error');}});
}


async function handleAdminReview(button) {
  if (!adminCapability) return;
  const id=button.dataset.adminOpportunityId||'', action=button.dataset.adminReviewAction||'';
  const opportunity=currentAdminOpportunities.find(item=>item.id===id);
  if(!opportunity){toast('Opportunity not found.','error');return;}
  await withButton(button,async()=>{try{await reviewOpportunity(state.mode,state.user,state.profile,opportunity,action);toast(action==='verify'?'Opportunity verified and published.':'Opportunity review state updated.','success');await renderAdmin();}catch(error){toast(humanError(error),'error');}});
}

async function handleAdminModeration(button) {
  if(!adminCapability)return;
  const id=button.dataset.adminReportId||'', source=button.dataset.adminReportSource||'reports', action=button.dataset.adminModerationAction||'';
  const report=currentAdminReports.find(row=>row.id===id&&row.source===source);
  if(!report){toast('Moderation report not found.','error');return;}
  await withButton(button,async()=>{
    try{
      await reviewReport(state.mode,state.user,state.profile,report,action);
      toast(action==='hide_post'?'Reported post hidden and action audited.':action==='dismiss'?'Report dismissed and audited.':'Report resolved and audited.','success');
      adminTab='reports';
      await renderAdmin();
    }catch(error){toast(humanError(error),'error');}
  });
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
  const fd=new FormData(form); try { await submitPostReport(state.mode,state.user.uid,form.dataset.reportForm,String(fd.get('reason')||''),String(fd.get('details')||'')); modalRoot.innerHTML=''; toast('Private report submitted for moderation review.','success'); } catch(e){toast(humanError(e),'error');}
}
async function handleNotification(el) {
  try{
    const n=state.notifications.find(x=>x.id===el.dataset.notification);
    if(!n)return;
    await markNotificationRead(state.mode,state.user.uid,n);
    n.read=true;
    setState({
      notifications:[...state.notifications],
      unreadCount:state.notifications.filter(row=>!row.read).length
    });
    const route=el.dataset.notificationRoute || n.route || '';
    if(route) go(route); else renderNotifications();
  }catch(e){
    toast(humanError(e),'error');
  }
}

async function handleNotificationsMarkAll(button) {
  const unread=state.notifications.filter(row=>!row.read);
  await withButton(button,async()=>{
    await markNotificationsRead(state.mode,state.user.uid,unread);
    for(const row of unread) row.read=true;
    setState({notifications:[...state.notifications],unreadCount:0});
    await renderNotifications();
  });
}
async function handleNotificationsMarkSection(button, category) {
  const unread=state.notifications.filter(row=>!row.read && row.category===category);
  if(!unread.length) return;
  await withButton(button,async()=>{
    await markNotificationsRead(state.mode,state.user.uid,unread);
    for(const row of unread) row.read=true;
    setState({
      notifications:[...state.notifications],
      unreadCount:state.notifications.filter(row=>!row.read).length
    });
    await renderNotifications();
  });
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
  const policy = getWebPostingPolicy(state.profile || {}, { admin:adminCapability });
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
  if (trapModalKeyboard(event)) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==='k') { event.preventDefault(); document.querySelector('[data-global-search-form] input')?.focus(); }
  if (event.key==='Escape' && state.ui.profileMenu) { state.ui.profileMenu = false; syncProfileMenu(); }
});

if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

boot();
