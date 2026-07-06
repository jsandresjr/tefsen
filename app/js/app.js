import { initFirebase } from './firebase-client.js';
import { state, setState } from './store.js';
import { observeAuth, signIn, register, signInGoogle, resetPassword, logout } from './services/auth-service.js';
import {
  getProfile, subscribePosts, createPost, deletePost, getPost, getReactionIds, toggleLike, toggleSave,
  subscribeComments, addComment, getNotifications, markNotificationRead, getConversations,
  subscribeMessages, sendMessage, getLeaderboard, searchAll, updateUserProfile, reportPost,
  startConversation, normalizeUser, getUserById
} from './services/data-service.js';
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
let currentProfileView = null;
let appStarted = false;

const navItems = [
  ['home', 'Home', 'home'],
  ['explore', 'Explore', 'compass'],
  ['notifications', 'Notifications', 'bell'],
  ['messages', 'Messages', 'message'],
  ['leaderboard', 'Leaderboard', 'trophy'],
  ['saved', 'Saved', 'bookmark'],
  ['profile', 'Profile', 'user'],
  ['settings', 'Settings', 'settings']
];

function avatar(user, size = '', extra = '') {
  const name = user?.fullName || user?.displayName || user?.authorName || 'Tefsen User';
  const photo = user?.photoUrl || user?.profileImageUrl || user?.photoURL || user?.authorPhotoUrl || '';
  const safePhoto = safeUrl(photo);
  const cls = `avatar ${size} ${extra} ${safePhoto ? 'has-photo' : ''}`.trim();
  const fallback = `<span class="avatar-fallback" aria-hidden="true">${escapeHTML(initials(name))}</span>`;
  return `<div class="${cls}" aria-label="${escapeHTML(name)}">${fallback}${safePhoto ? `<img src="${safePhoto}" alt="${escapeHTML(name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}</div>`;
}

function rolePill(role = 'Student') {
  return `<span class="role-pill ${roleClass(role)}">${escapeHTML(normalizeRole(role))}</span>`;
}

function verifiedMark(value) {
  const active = value === true || value === 1 || ['true', '1', 'yes', 'verified'].includes(String(value || '').trim().toLowerCase());
  if (!active) return '';
  return `<span class="verified-badge" title="Verified" aria-label="Verified"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path class="verified-badge-fill" d="M12 2.3l2.2 1.5 2.7-.2 1.1 2.5 2.4 1.3-.5 2.7 1.5 2.2-1.5 2.2.5 2.7-2.4 1.3-1.1 2.5-2.7-.2L12 21.7l-2.2-1.5-2.7.2L6 17.9l-2.4-1.3.5-2.7L2.6 12l1.5-2.2-.5-2.7L6 5.8l1.1-2.5 2.7.2L12 2.3Z"/><path class="verified-badge-check" d="m8.1 12.2 2.4 2.4 5.4-5.5"/></svg></span>`;
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
    stopPosts = subscribePosts(state.mode, posts => {
      setState({ posts });
      renderRoute();
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
          <h1>Learn. Share.<br><span>Grow together.</span></h1>
          <p>Your Tefsen community on the web — the same place for thoughtful questions, useful answers, student profiles and knowledge that moves between people.</p>
        </div>
        <div class="auth-proof"><span>✓ Student focused</span><span>✓ Community powered</span><span>✓ Cross-platform ready</span></div>
      </section>
      <section class="auth-panel">
        <div class="auth-card">
          ${state.mode === 'demo' ? `<div class="demo-banner"><span><b>Preview mode:</b> Firebase is not connected yet.</span><a href="#" data-demo-info>Setup</a></div>` : ''}
          <h2>${isRegister ? 'Create your account' : 'Welcome back'}</h2>
          <p>${isRegister ? 'Join a community built around useful knowledge.' : 'Sign in to continue to Tefsen Web.'}</p>
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
            <input name="q" value="${escapeHTML(state.searchQuery)}" placeholder="Search questions, people, subjects…" aria-label="Search Tefsen">
            <span class="search-kbd">Ctrl K</span>
          </form>
        </div>
        <div class="topbar-actions">
          <button class="icon-button desktop-only" type="button" data-route="messages" aria-label="Messages">${icon('message',19)}</button>
          <button class="icon-button hide-small" type="button" data-route="notifications" aria-label="Notifications">${icon('bell',19)}${state.unreadCount ? `<span class="badge-dot">${Math.min(state.unreadCount, 99)}</span>` : ''}</button>
          <button class="top-avatar" type="button" data-profile-menu aria-label="Profile menu"><span class="top-avatar-fallback">${escapeHTML(initials(p.fullName || 'TU'))}</span>${safeUrl(p.photoUrl || '') ? `<img src="${safeUrl(p.photoUrl)}" alt="${escapeHTML(p.fullName || 'Profile')}" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}</button>
        </div>
      </header>

      <aside class="sidebar">
        <nav class="nav-list" aria-label="Tefsen navigation">
          ${navItems.slice(0,6).map(([id,label,ic]) => navButton(id,label,ic,route)).join('')}
        </nav>
        <div class="nav-divider"></div>
        <div class="sidebar-cta"><button class="btn btn-primary btn-block" data-action="compose">${icon('plus',18)} Ask a question</button></div>
        <nav class="nav-list">
          ${navItems.slice(6).map(([id,label,ic]) => navButton(id,label,ic,route)).join('')}
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
        ${mobileNavButton('explore','compass',route,'Explore')}
        <button class="create-mobile" type="button" data-action="compose" aria-label="Ask a question">${icon('plus',24)}</button>
        ${mobileNavButton('notifications','bell',route,'Notifications')}
        ${mobileNavButton('profile','user',route,'Profile')}
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
  return `<div class="dropdown" data-dropdown>
    <button type="button" data-route="profile">${icon('user',17)} &nbsp; View profile</button>
    <button type="button" data-route="settings">${icon('settings',17)} &nbsp; Settings</button>
    <button type="button" data-logout>${icon('logout',17)} &nbsp; Sign out</button>
  </div>`;
}

function renderRightbar() {
  const trending = [...state.posts].sort((a,b) => scorePost(b) - scorePost(a)).slice(0,4);
  return `
    <section class="widget">
      <h3>Trending discussions</h3>
      ${trending.length ? trending.map((p,i) => `<button class="widget-link" style="width:100%;border-left:0;border-right:0;border-top:0;background:none;color:inherit;text-align:left;cursor:pointer" data-route="post/${encodeURIComponent(p.id)}"><span class="trend-number">0${i+1}</span><div><b>${escapeHTML(p.title || p.content.slice(0,60))}</b><small>${escapeHTML(p.subject || 'General')} · ${formatCount(p.likeCount)} likes</small></div></button>`).join('') : '<small style="color:var(--muted)">Discussions will appear here.</small>'}
    </section>
    <section class="widget">
      <h3>Your Tefsen</h3>
      <div class="widget-link">${avatar(state.profile,'sm')}<div><b>${escapeHTML(state.profile?.fullName || 'Tefsen User')}</b><small>${escapeHTML(normalizeRole(state.profile?.role || 'Student'))} · ${formatCount(state.profile?.points || 0)} points</small></div></div>
      <div class="widget-link"><span class="notification-icon">${icon('bookmark',17)}</span><div><b>${reactionState.saved.size} saved items</b><small>Knowledge for later</small></div></div>
    </section>
    <div class="footer-mini"><a href="../privacy.html">Privacy</a> · <a href="../terms.html">Terms</a> · <a href="../delete-account/">Delete account</a><br>© ${new Date().getFullYear()} Tefsen</div>`;
}

function scorePost(p) { return Number(p.trendingScore || 0) || Number(p.likeCount || 0) * 2 + Number(p.commentCount || 0) * 3; }

function getFilteredPosts(tab = state.activeFeedTab) {
  const posts = [...state.posts];
  if (tab === 'trending') return posts.sort((a,b) => scorePost(b) - scorePost(a));
  if (tab === 'saved') return posts.filter(p => reactionState.saved.has(p.id));
  if (tab === 'liked') return posts.filter(p => reactionState.liked.has(p.id));
  return posts;
}

function postCard(post) {
  const liked = reactionState.liked.has(post.id);
  const saved = reactionState.saved.has(post.id);
  const displayTitle = post.title || (post.content ? post.content.slice(0,110) : 'Untitled discussion');
  return `<article class="panel post-card" data-post-id="${escapeHTML(post.id)}">
    <header class="post-head">
      <button style="border:0;background:none;padding:0;cursor:pointer" data-route="profile/${encodeURIComponent(post.authorId || '')}">${avatar({ fullName: post.authorName, photoUrl: post.authorPhotoUrl }, '', '')}</button>
      <div class="post-head-main"><b>${escapeHTML(post.authorName || 'Tefsen User')} ${verifiedMark(post.verified)}</b><small>${rolePill(post.role)} &nbsp; ${relativeTime(post.createdAt)}</small></div>
      <button class="post-menu" type="button" data-post-menu="${escapeHTML(post.id)}" aria-label="Post options">${icon('more',20)}</button>
    </header>
    <div class="post-body" data-route="post/${encodeURIComponent(post.id)}">
      <span class="post-subject">${escapeHTML(post.subject || 'General')}</span>
      <h3>${escapeHTML(displayTitle)}</h3>
      ${post.content && post.content !== post.title ? `<p>${nl2br(post.content.length > 460 ? post.content.slice(0,460) + '…' : post.content)}</p>` : ''}
      ${post.imageUrl ? `<img class="post-image" src="${safeUrl(post.imageUrl)}" alt="Post image" loading="lazy">` : ''}
      ${post.tags?.length ? `<div class="tag-row">${post.tags.slice(0,6).map(t => `<span class="tag">#${escapeHTML(t)}</span>`).join('')}</div>` : ''}
    </div>
    <footer class="post-actions">
      <button class="action-btn like ${liked ? 'active' : ''}" data-like="${escapeHTML(post.id)}"><span>${icon('heart',17)}</span>${formatCount(post.likeCount + (liked && !post._likedIncluded ? 0 : 0))}</button>
      <button class="action-btn" data-route="post/${encodeURIComponent(post.id)}"><span>${icon('comment',17)}</span>${formatCount(post.commentCount)}</button>
      <button class="action-btn ${saved ? 'active' : ''}" data-save="${escapeHTML(post.id)}"><span>${icon('bookmark',17)}</span>${saved ? 'Saved' : 'Save'}</button>
      <button class="action-btn" data-share="${escapeHTML(post.id)}"><span>${icon('share',17)}</span>Share</button>
    </footer>
  </article>`;
}

function renderHome(forcedTab = null) {
  if (forcedTab) state.activeFeedTab = forcedTab;
  const posts = getFilteredPosts();
  const content = `${demoBanner()}
    <div class="feed-tabs" role="tablist">
      ${['latest','trending','saved','liked'].map(t => `<button class="feed-tab ${state.activeFeedTab === t ? 'active' : ''}" data-feed-tab="${t}" role="tab">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}
    </div>
    <section class="panel composer-mini">
      ${avatar(state.profile,'sm')}
      <button class="fake-input" type="button" data-action="compose">Ask something or share what you learned…</button>
      <button class="ask-btn" type="button" data-action="compose">${icon('plus',16)} Ask</button>
    </section>
    <div class="feed-list">${posts.length ? posts.map(postCard).join('') : emptyState(state.activeFeedTab === 'saved' ? 'bookmark' : 'compass', state.activeFeedTab === 'saved' ? 'No saved posts yet' : 'Nothing here yet', state.activeFeedTab === 'saved' ? 'Save useful discussions and they will appear here.' : 'New discussions will appear as the community contributes.')}</div>`;
  renderShell(content);
}

function renderExplore() {
  const subjects = new Map();
  state.posts.forEach(p => subjects.set(p.subject || 'General', (subjects.get(p.subject || 'General') || 0) + 1));
  const topSubjects = [...subjects.entries()].sort((a,b) => b[1]-a[1]).slice(0,8);
  const content = `${demoBanner()}
    <header class="page-head"><div><h1>Explore</h1><p>Discover questions, subjects and ideas from across the community.</p></div><button class="btn btn-primary" data-action="compose">${icon('plus',17)} Ask</button></header>
    <section class="panel section-card" style="margin-bottom:16px">
      <div class="panel-title"><h2>Subjects</h2><small>${topSubjects.length} active</small></div>
      <div class="tag-row">${topSubjects.length ? topSubjects.map(([name,count]) => `<button class="btn btn-secondary" style="min-height:38px" data-subject="${escapeHTML(name)}">${escapeHTML(name)} <small>${count}</small></button>`).join('') : '<span style="color:var(--muted)">Subjects appear as posts are published.</span>'}</div>
    </section>
    <div class="feed-list">${[...state.posts].sort((a,b)=>scorePost(b)-scorePost(a)).map(postCard).join('') || emptyState('compass','No posts yet','Explore will come alive as the community publishes.')}</div>`;
  renderShell(content);
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
        <header class="post-head">${avatar({fullName:post.authorName,photoUrl:post.authorPhotoUrl})}<div class="post-head-main"><b>${escapeHTML(post.authorName)} ${verifiedMark(post.verified)}</b><small>${rolePill(post.role)} &nbsp; ${relativeTime(post.createdAt)}</small></div><button class="post-menu" data-post-menu="${escapeHTML(post.id)}">${icon('more',20)}</button></header>
        <div class="post-body"><span class="post-subject">${escapeHTML(post.subject || 'General')}</span><h1>${escapeHTML(post.title || 'Discussion')}</h1><p>${nl2br(post.content || '')}</p>${post.imageUrl ? `<img class="post-image" src="${safeUrl(post.imageUrl)}" alt="Post image">` : ''}${post.tags?.length ? `<div class="tag-row">${post.tags.map(t=>`<span class="tag">#${escapeHTML(t)}</span>`).join('')}</div>`:''}</div>
        <footer class="post-actions"><button class="action-btn like ${liked?'active':''}" data-like="${escapeHTML(post.id)}"><span>${icon('heart',17)}</span>${formatCount(post.likeCount)}</button><button class="action-btn"><span>${icon('comment',17)}</span>${formatCount(currentComments.length || post.commentCount)}</button><button class="action-btn ${saved?'active':''}" data-save="${escapeHTML(post.id)}"><span>${icon('bookmark',17)}</span>${saved?'Saved':'Save'}</button><button class="action-btn" data-share="${escapeHTML(post.id)}"><span>${icon('share',17)}</span>Share</button></footer>
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
  return `<article class="panel answer-card"><header class="post-head">${avatar(user,'sm')}<div class="post-head-main"><b>${escapeHTML(user.fullName)} ${verifiedMark(answer.verified || answer.authorVerified)}</b><small>${rolePill(answer.role || answer.authorRole || 'Student')} &nbsp; ${relativeTime(answer.createdAt)}</small></div></header><p>${nl2br(answer.content || answer.text || '')}</p></article>`;
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
    <section class="panel">${state.leaderboard.length ? state.leaderboard.map((u,i)=>`<button class="leaderboard-row" type="button" style="width:100%;border-left:0;border-right:0;border-top:0;background:none;color:inherit;text-align:left" data-route="profile/${encodeURIComponent(u.uid)}"><span class="rank ${i<3?'top':''}">${i+1}</span><span class="user-inline">${avatar(u,'sm')}<span><b>${escapeHTML(u.fullName)} ${verifiedMark(u.verified)}</b><small>${escapeHTML(normalizeRole(u.role))}</small></span></span><span class="points">${formatCount(u.points)} pts</span></button>`).join('') : emptyState('trophy','Leaderboard is empty','Points will appear as members contribute.')}</section>`;
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
  const posts = state.posts.filter(p => p.authorId === profile?.uid);
  const content = `${demoBanner()}<section class="panel" style="overflow:hidden">
    <div class="profile-cover"></div>
    <div class="profile-main">
      <div class="profile-topline"><div>${avatar(profile,'lg')}</div><div>${own ? `<button class="btn btn-secondary" data-edit-profile>${icon('edit',17)} Edit profile</button>` : `<button class="btn btn-primary" data-message-user="${escapeHTML(profile?.uid || '')}">${icon('message',17)} Message</button>`}</div></div>
      <div class="profile-info"><h1>${escapeHTML(profile?.fullName || 'Tefsen User')} ${verifiedMark(profile?.verified)}</h1><span class="handle">@${escapeHTML(profile?.username || 'tefsen-user')}</span><p>${escapeHTML(profile?.bio || 'Learning, sharing and growing with the Tefsen community.')}</p>${rolePill(profile?.role || 'Student')}
      <div class="profile-stats"><span><b>${formatCount(posts.length)}</b>Posts</span><span><b>${formatCount(profile?.followersCount || 0)}</b>Followers</span><span><b>${formatCount(profile?.followingCount || 0)}</b>Following</span><span><b>${formatCount(profile?.points || 0)}</b>Points</span></div></div>
    </div></section>
    <div class="profile-tabs"><button class="feed-tab active">Posts</button></div>
    <div class="feed-list">${posts.length ? posts.map(postCard).join('') : emptyState('comment','No posts yet',own?'Ask your first question or share something useful.':'This member has not published yet.')}</div>`;
  renderShell(content);
}

function renderSettings() {
  const p = state.profile || {};
  const content = `${demoBanner()}<header class="page-head"><div><h1>Settings</h1><p>Manage your profile and web experience.</p></div></header>
    <div class="settings-grid"><aside class="panel settings-nav"><button class="active">Profile</button><button>Preferences</button><button>Account</button></aside>
    <section class="panel settings-section"><h2 style="margin-top:0">Profile details</h2><form class="form-grid" data-profile-form><div class="field"><label>Full name</label><input class="input" name="fullName" value="${escapeHTML(p.fullName || '')}" required maxlength="80"></div><div class="field"><label>Username</label><input class="input" name="username" value="${escapeHTML(p.username || '')}" maxlength="40"></div><div class="field"><label>Bio</label><textarea class="textarea" name="bio" maxlength="500">${escapeHTML(p.bio || '')}</textarea></div><div><button class="btn btn-primary" type="submit">Save changes</button></div></form>
    <div class="nav-divider"></div><h3>Preferences</h3><div class="setting-row"><span><b>Compact feed</b><p>Reduce spacing between discussions.</p></span><button class="toggle" type="button" data-pref="compact"></button></div><div class="setting-row"><span><b>Reduced motion</b><p>Limit interface animation.</p></span><button class="toggle" type="button" data-pref="motion"></button></div>
    <div class="nav-divider"></div><h3>Account</h3><div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-secondary" href="../privacy.html">Privacy policy</a><a class="btn btn-secondary" href="../delete-account/">Delete account</a><button class="btn btn-danger" data-logout>Sign out</button></div></section></div>`;
  renderShell(content,{wide:true});
}

async function renderSearch(term = '') {
  state.searchQuery = term;
  renderShell(`<header class="page-head"><div><h1>Search</h1><p>${term ? `Results for “${escapeHTML(term)}”` : 'Find people, questions and subjects.'}</p></div></header><div class="loading-card"></div>`);
  currentSearch = term ? await searchAll(state.mode, term).catch(()=>({users:[],posts:[]})) : {users:[],posts:[]};
  const content = `${demoBanner()}<header class="page-head"><div><h1>Search</h1><p>${term ? `Results for “${escapeHTML(term)}”` : 'Find people, questions and subjects.'}</p></div></header>
    ${currentSearch.users.length ? `<section class="panel section-card" style="margin-bottom:16px"><div class="panel-title"><h2>People</h2><small>${currentSearch.users.length} results</small></div><div class="search-results">${currentSearch.users.map(u=>`<button class="search-user" type="button" style="width:100%;border:0;background:none;color:inherit;text-align:left" data-route="profile/${encodeURIComponent(u.uid)}">${avatar(u,'sm')}<span><b>${escapeHTML(u.fullName)} ${verifiedMark(u.verified)}</b><small style="display:block;color:var(--muted)">${escapeHTML(normalizeRole(u.role))}</small></span></button>`).join('')}</div></section>`:''}
    <div class="feed-list">${currentSearch.posts.length ? currentSearch.posts.map(postCard).join('') : emptyState('search',term?'No matching discussions':'Start searching','Try a name, subject or question keyword.')}</div>`;
  renderShell(content);
}

function renderRoute() {
  if (!state.user) return;
  const [route, param] = routeParts();
  state.ui.profileMenu = false;
  if (stopComments && route !== 'post') { stopComments(); stopComments = null; }
  if (stopMessages && route !== 'messages') { stopMessages(); stopMessages = null; }
  switch (route || 'home') {
    case 'home': renderHome(); break;
    case 'explore': renderExplore(); break;
    case 'saved': renderHome('saved'); break;
    case 'notifications': renderNotifications(); break;
    case 'messages': renderMessages(param || ''); break;
    case 'leaderboard': renderLeaderboard(); break;
    case 'profile': renderProfile(param || ''); break;
    case 'settings': renderSettings(); break;
    case 'post': renderPostDetail(param || ''); break;
    case 'search': renderSearch(param || new URLSearchParams(location.hash.split('?')[1] || '').get('q') || ''); break;
    default: renderHome();
  }
}

function openComposer() {
  modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop><section class="modal" role="dialog" aria-modal="true" aria-labelledby="compose-title"><header class="modal-head"><h2 id="compose-title">Ask a question or share knowledge</h2><button class="close-btn" type="button" data-close-modal>${icon('close',19)}</button></header><div class="modal-body"><form class="form-grid" data-compose-form><div class="field"><label>Title / question</label><input class="input" name="title" maxlength="180" required placeholder="What would you like to ask or explain?"></div><div class="field"><label>Details</label><textarea class="textarea" name="content" maxlength="8000" required placeholder="Add context, what you tried, or a useful explanation…"></textarea></div><div class="input-row"><div class="field"><label>Subject</label><input class="input" name="subject" maxlength="60" placeholder="e.g. Physics"></div><div class="field"><label>Tags</label><input class="input" name="tags" maxlength="150" placeholder="circuits, electricity"></div></div><div class="file-drop">${icon('image',24)}<br><b>Add an image</b><br><span class="form-help">PNG, JPG or WebP</span><input type="file" name="image" accept="image/png,image/jpeg,image/webp"></div><div class="image-preview hidden" data-image-preview></div><div class="form-error" data-compose-error></div><div style="display:flex;justify-content:flex-end;gap:10px"><button class="btn btn-ghost" type="button" data-close-modal>Cancel</button><button class="btn btn-primary" type="submit">Publish</button></div></form></div></section></div>`;
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
  modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop><section class="modal"><header class="modal-head"><h2>Edit profile</h2><button class="close-btn" data-close-modal>${icon('close',19)}</button></header><div class="modal-body"><form class="form-grid" data-profile-form data-profile-modal><div class="field"><label>Full name</label><input class="input" name="fullName" value="${escapeHTML(p.fullName || '')}" required maxlength="80"></div><div class="field"><label>Username</label><input class="input" name="username" value="${escapeHTML(p.username || '')}" maxlength="40"></div><div class="field"><label>Bio</label><textarea class="textarea" name="bio" maxlength="500">${escapeHTML(p.bio || '')}</textarea></div><button class="btn btn-primary" type="submit">Save profile</button></form></div></section></div>`;
}

function openDemoInfo() {
  modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop><section class="modal"><header class="modal-head"><h2>Connect the real Tefsen Firebase project</h2><button class="close-btn" data-close-modal>${icon('close',19)}</button></header><div class="modal-body"><p style="color:var(--muted)">This package is fully interactive in preview mode. To use the same real accounts and data as your Android app:</p><ol style="line-height:1.9;color:#cbd9e5"><li>Firebase Console → Project settings → General.</li><li>Add/select the Web app.</li><li>Copy its <code>firebaseConfig</code> values.</li><li>Edit <code>app/js/config/firebase-config.js</code>.</li><li>Confirm collection names in <code>app/js/config/schema.js</code>.</li><li>Add <code>tefsen.com</code> to Firebase Authentication authorized domains.</li></ol><p style="color:#ffda91"><b>Never</b> paste a service-account private key into GitHub.</p><button class="btn btn-primary" data-close-modal>Got it</button></div></section></div>`;
}

async function handleClick(event) {
  const routeEl = event.target.closest('[data-route]');
  if (routeEl) { event.preventDefault(); go(routeEl.dataset.route); return; }
  const switchEl = event.target.closest('[data-auth-switch]');
  if (switchEl) { renderAuth(switchEl.dataset.authSwitch); return; }
  if (event.target.closest('[data-google]')) { await withButton(event.target.closest('[data-google]'), () => signInGoogle(state.mode).catch(e=>toast(humanError(e),'error'))); return; }
  if (event.target.closest('[data-demo-login]')) { await signIn(state.mode,'demo@tefsen.com','demo123'); return; }
  if (event.target.closest('[data-demo-info]')) { event.preventDefault(); openDemoInfo(); return; }
  if (event.target.closest('[data-forgot]')) { handleForgot(); return; }
  if (event.target.closest('[data-action="compose"]')) { openComposer(); return; }
  if (event.target.closest('[data-close-modal]')) { modalRoot.innerHTML=''; return; }
  if (event.target.matches('[data-modal-backdrop]')) { modalRoot.innerHTML=''; return; }
  const tab = event.target.closest('[data-feed-tab]');
  if (tab) { state.activeFeedTab = tab.dataset.feedTab; renderHome(); return; }
  const like = event.target.closest('[data-like]');
  if (like) { await handleLike(like.dataset.like); return; }
  const save = event.target.closest('[data-save]');
  if (save) { await handleSave(save.dataset.save); return; }
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
  if (event.target.closest('[data-profile-menu]')) { state.ui.profileMenu = !state.ui.profileMenu; renderRoute(); return; }
  if (event.target.closest('[data-logout]')) { await logout(state.mode); return; }
  if (event.target.closest('[data-edit-profile]')) { openEditProfile(); return; }
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
  if (form.matches('[data-report-form]')) { event.preventDefault(); await handleReport(form); return; }
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
  const payload = {
    title: String(fd.get('title')||'').trim(), content: String(fd.get('content')||'').trim(), subject: String(fd.get('subject')||'General').trim() || 'General',
    tags: String(fd.get('tags')||'').split(',').map(x=>x.trim().replace(/^#/,'')).filter(Boolean).slice(0,8), imageFile: fd.get('image')?.size ? fd.get('image') : null
  };
  if (!payload.title || !payload.content) return;
  await withButton(submit, async()=>{
    try { const post = await createPost(state.mode,state.user,state.profile,payload); modalRoot.innerHTML=''; toast('Published successfully','success'); if (state.mode==='demo') { state.posts=[post,...state.posts]; } go(`post/${post.id}`); }
    catch(e){ errorEl.textContent=humanError(e); }
  });
}

async function handleLike(postId) {
  try {
    const active = await toggleLike(state.mode,state.user.uid,postId);
    active ? reactionState.liked.add(postId) : reactionState.liked.delete(postId);
    const p=state.posts.find(x=>x.id===postId); if(p) p.likeCount=Math.max(0,Number(p.likeCount||0)+(active?1:-1));
    renderRoute();
  } catch(e){ toast(humanError(e),'error'); }
}
async function handleSave(postId) {
  try { const active=await toggleSave(state.mode,state.user.uid,postId); active?reactionState.saved.add(postId):reactionState.saved.delete(postId); toast(active?'Saved for later':'Removed from saved','success'); renderRoute(); }
  catch(e){ toast(humanError(e),'error'); }
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
  const fd=new FormData(form), submit=form.querySelector('button[type="submit"]');
  await withButton(submit,async()=>{ try { const profile=await updateUserProfile(state.mode,state.user.uid,{fullName:String(fd.get('fullName')||'').trim(),username:String(fd.get('username')||'').trim(),bio:String(fd.get('bio')||'').trim()}); state.profile={...state.profile,...profile}; modalRoot.innerHTML=''; toast('Profile updated','success'); renderRoute(); }catch(e){toast(humanError(e),'error');} });
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
  const file = event.target.matches('[data-compose-form] input[type="file"]') ? event.target : null;
  if (file) {
    const preview=file.form.querySelector('[data-image-preview]'), f=file.files?.[0];
    if(!f){preview.classList.add('hidden');preview.innerHTML='';return;}
    if(f.size>8*1024*1024){toast('Image must be under 8 MB.','error');file.value='';return;}
    const url=URL.createObjectURL(f); preview.innerHTML=`<img src="${url}" alt="Selected image preview">`;preview.classList.remove('hidden');
  }
}

document.addEventListener('error', event => {
  const img = event.target;
  if (img instanceof HTMLImageElement && img.closest('.avatar, .top-avatar')) {
    img.remove();
  }
}, true);

window.addEventListener('hashchange', renderRoute);
document.addEventListener('click', handleClick);
document.addEventListener('submit', handleSubmit);
document.addEventListener('change', handleInput);
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==='k') { event.preventDefault(); document.querySelector('[data-global-search-form] input')?.focus(); }
  if (event.key==='Escape' && modalRoot.innerHTML) modalRoot.innerHTML='';
});

if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

boot();
