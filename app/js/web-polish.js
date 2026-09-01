import { state } from './store.js';
import { escapeHTML, formatCount, safeUrl, timestampToDate, toast } from './utils.js';

const root = document.getElementById('app-root');
const modalRoot = document.getElementById('modal-root');
const SUBJECTS = ['All Subjects', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'ICT/Computer Science'];
let homeMode = 'for-you';
let activeSubject = 'All Subjects';
let applying = false;
let queued = false;

function routeName() {
  return (location.hash || '#/home').replace(/^#\/?/, '').split('/')[0] || 'home';
}

function svg(name, size = 20) {
  const paths = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    question: '<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 0 1 4.6 1c0 2-2.4 2.2-2.4 4"/><path d="M12 18h.01"/>',
    trophy: '<path d="M8 3h8v5a4 4 0 0 1-8 0V3Z"/><path d="M8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 12v5M8 21h8M9 17h6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    flame: '<path d="M13 2s1 4-2 6c-2 1.4-3 3.2-3 5.2A4 4 0 0 0 12 17a4 4 0 0 0 4-4c0-1.5-.7-2.9-2-4 .2 2-1 3-2 3 .7-4-2-6-2-6"/><path d="M9 19h6"/>'
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.question}</svg>`;
}

function num(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

function dateMs(value) {
  return timestampToDate(value)?.getTime() || 0;
}

function ownQuestions() {
  const uid = String(state.user?.uid || '');
  return uid ? state.posts.filter(post => [post.authorId, post.userId, post.uid, post.ownerId, post.authorUid].map(v => String(v || '')).includes(uid)) : [];
}

function metrics() {
  const p = state.profile || {};
  return {
    questions: ownQuestions().length,
    answers: num(p.answersCount, p.answerCount, p.answeredCount, p.totalAnswers),
    solved: num(p.solvedCount, p.questionsSolved, p.solvedQuestions),
    accepted: num(p.acceptedCount, p.acceptedAnswers, p.bestAnswerCount),
    points: num(p.points, p.reputation, p.score),
    followers: num(p.followersCount, p.followerCount),
    following: num(p.followingCount)
  };
}

function normalizeSubject(value = '') {
  const v = String(value || '').trim().toLowerCase();
  if (['math', 'maths', 'mathematics'].includes(v)) return 'Mathematics';
  if (v.includes('physics')) return 'Physics';
  if (v.includes('chem')) return 'Chemistry';
  if (v.includes('bio')) return 'Biology';
  if (v.includes('computer') || v.includes('ict') || v.includes('coding') || v.includes('program')) return 'ICT/Computer Science';
  return value || 'General';
}

function scorePost(post) {
  const age = Math.max(0, (Date.now() - dateMs(post.createdAt)) / 36e5);
  const freshness = age <= 24 ? 8 : age <= 72 ? 5 : age <= 168 ? 2 : 0;
  return num(post.likeCount) * 2 + num(post.commentCount) * 4 + freshness;
}

function homePosts() {
  let posts = [...state.posts];
  if (activeSubject !== 'All Subjects') posts = posts.filter(post => normalizeSubject(post.subject) === activeSubject);
  if (homeMode === 'latest') return posts.sort((a, b) => dateMs(b.createdAt) - dateMs(a.createdAt));
  if (homeMode === 'unanswered') return posts.filter(post => num(post.commentCount) === 0).sort((a, b) => dateMs(b.createdAt) - dateMs(a.createdAt));
  if (homeMode === 'following') {
    const p = state.profile || {};
    const ids = new Set([...(Array.isArray(p.followingIds) ? p.followingIds : []), ...(Array.isArray(p.following) ? p.following : [])].map(String));
    return ids.size ? posts.filter(post => ids.has(String(post.authorId || ''))) : [];
  }
  return posts.sort((a, b) => scorePost(b) - scorePost(a));
}

function applyTheme() {
  const theme = localStorage.getItem('tefsen_web_theme') || 'dark';
  document.documentElement.dataset.webTheme = theme;
  const button = document.querySelector('[data-quality-theme]');
  if (button && button.dataset.renderedTheme !== theme) {
    button.dataset.renderedTheme = theme;
    button.innerHTML = theme === 'light' ? svg('moon', 20) : svg('sun', 20);
    button.setAttribute('aria-label', theme === 'light' ? 'Use dark theme' : 'Use light theme');
  }
}

function patchTopbar() {
  const actions = document.querySelector('.topbar-actions');
  if (actions && !actions.querySelector('[data-quality-theme]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'icon-button quality-theme-button';
    button.dataset.qualityTheme = '1';
    actions.prepend(button);
  }
  applyTheme();
  const search = document.querySelector('.global-search input');
  if (search && search.dataset.qualitySearch !== '1') {
    search.dataset.qualitySearch = '1';
    search.placeholder = 'Search questions, people, subjects';
    search.autocomplete = 'off';
  }
}

function patchSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar || sidebar.dataset.qualitySidebar === '1') return;
  sidebar.dataset.qualitySidebar = '1';
  sidebar.querySelector('[data-route="messages"]')?.style.setProperty('display', 'none');
  sidebar.querySelector('[data-route="saved"]')?.style.setProperty('display', 'none');
}

function homeEmpty() {
  const title = homeMode === 'unanswered' ? 'No unanswered questions' : homeMode === 'following' ? 'No questions from followed learners' : 'No questions found';
  const text = homeMode === 'following'
    ? 'Following is not enabled in the current Tefsen data model yet. Use For You or Latest to browse questions.'
    : activeSubject !== 'All Subjects' ? `No ${activeSubject} questions are available yet.` : 'Be the first to ask an academic question.';
  return `<section class="quality-empty"><div class="quality-empty-icon">${svg('question', 58)}</div><h3>${escapeHTML(title)}</h3><p>${escapeHTML(text)}</p>${homeMode === 'following' ? '<button class="btn btn-secondary" type="button" data-quality-feed="for-you">Back to For You</button>' : `<button class="btn btn-primary" type="button" data-action="compose">${svg('plus', 20)} Ask a question</button>`}</section>`;
}

function patchHome() {
  if (routeName() !== 'home') return;
  const wrap = document.querySelector('.content-wrap');
  if (!wrap) return;

  if (!wrap.querySelector('.quality-home-hero')) {
    wrap.insertAdjacentHTML('afterbegin', `<header class="quality-home-hero"><div><span class="quality-eyebrow">TEFSEN</span><h1>Learn together</h1><p>The Social Education Network</p></div><button class="quality-hero-ask" type="button" data-action="compose">${svg('plus', 21)} Ask Question</button></header>`);
  }

  const tabs = wrap.querySelector('.feed-tabs');
  if (tabs) {
    const defs = [['for-you','For You'], ['latest','Latest'], ['unanswered','Unanswered'], ['following','Following']];
    [...tabs.querySelectorAll('button')].slice(0,4).forEach((button, index) => {
      const [mode, label] = defs[index];
      if (button.dataset.qualityFeed !== mode) {
        button.removeAttribute('data-feed-tab');
        button.dataset.qualityFeed = mode;
        button.textContent = label;
      }
      button.classList.toggle('active', homeMode === mode);
      button.setAttribute('aria-selected', String(homeMode === mode));
    });
  }

  wrap.querySelector('.subject-filter-row')?.remove();
  let subjects = wrap.querySelector('.quality-subjects');
  if (!subjects && tabs) {
    subjects = document.createElement('div');
    subjects.className = 'quality-subjects';
    tabs.insertAdjacentElement('afterend', subjects);
  }
  if (subjects && subjects.dataset.signature !== activeSubject) {
    subjects.dataset.signature = activeSubject;
    subjects.innerHTML = SUBJECTS.map(subject => `<button type="button" class="${activeSubject === subject ? 'active' : ''}" data-quality-subject="${escapeHTML(subject)}">${subject === 'All Subjects' ? svg('check', 15) : ''}${escapeHTML(subject)}</button>`).join('');
  }

  const composer = wrap.querySelector('.composer-mini');
  if (composer && composer.dataset.qualityComposerMini !== '1') {
    composer.dataset.qualityComposerMini = '1';
    composer.classList.add('quality-composer');
    const fake = composer.querySelector('.fake-input');
    if (fake) fake.textContent = 'Ask an academic question…';
  }

  const feed = wrap.querySelector('.feed-list');
  if (!feed) return;
  const signature = `${homeMode}|${activeSubject}|${state.posts.map(post => `${post.id}:${num(post.commentCount)}:${num(post.likeCount)}`).join(',')}`;
  if (feed.dataset.qualitySignature === signature) return;
  feed.dataset.qualitySignature = signature;

  feed.querySelectorAll('.quality-empty').forEach(el => el.remove());
  const cards = new Map([...feed.querySelectorAll('[data-post-id]')].map(card => [String(card.dataset.postId), card]));
  [...cards.values()].forEach(card => { card.hidden = true; });
  let visible = 0;
  for (const post of homePosts()) {
    const card = cards.get(String(post.id));
    if (!card) continue;
    card.hidden = false;
    feed.appendChild(card);
    visible += 1;
  }
  const legacyEmpty = feed.querySelector('.empty-state');
  if (legacyEmpty) legacyEmpty.hidden = true;
  if (!visible) feed.insertAdjacentHTML('beforeend', homeEmpty());
}

function patchComposer() {
  const form = document.querySelector('[data-compose-form]');
  if (!form || form.dataset.qualityComposer === '1') return;
  form.dataset.qualityComposer = '1';
  const modal = form.closest('.modal');
  modal?.classList.add('quality-question-modal');
  const heading = modal?.querySelector('.modal-head h2');
  if (heading) heading.textContent = 'Ask Academic Question';

  const subjectInput = form.querySelector('[name="subject"]');
  if (subjectInput && subjectInput.tagName !== 'SELECT') {
    const select = document.createElement('select');
    select.name = 'subject';
    select.className = 'select quality-subject-select';
    SUBJECTS.slice(1).forEach(subject => {
      const option = document.createElement('option');
      option.value = subject;
      option.textContent = subject;
      if (normalizeSubject(subjectInput.value) === subject) option.selected = true;
      select.appendChild(option);
    });
    subjectInput.replaceWith(select);
  }
  const title = form.querySelector('[name="title"]');
  const details = form.querySelector('[name="content"]');
  if (title) title.placeholder = 'Enter your academic question';
  if (details) details.placeholder = 'Explain the problem, what you tried, and include equations or important details.';
  form.querySelector('[name="tags"]')?.closest('.field')?.classList.add('quality-hidden-field');
  form.querySelector('.file-drop')?.classList.add('quality-file-drop');
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.innerHTML = `${svg('plus', 20)} Publish Question`;
}

function patchStudy() {
  if (routeName() !== 'study') return;
  const wrap = document.querySelector('.content-wrap');
  if (!wrap) return;
  const m = metrics();
  const recent = ownQuestions().filter(post => Date.now() - dateMs(post.createdAt) <= 7 * 864e5).length;
  const weekly = Math.min(5, recent + Math.min(m.answers, 5));
  const signature = `${m.questions}:${m.answers}:${m.solved}:${m.accepted}:${weekly}:${num(state.profile?.streakDays, state.profile?.studyStreak, state.profile?.streak)}`;
  if (wrap.dataset.qualityStudy === signature) return;
  wrap.dataset.qualityStudy = signature;

  const goal = wrap.querySelector('.weekly-goal-card');
  if (goal) {
    const p = goal.querySelector('p');
    if (p) p.innerHTML = `<strong>${weekly}</strong> of 5 helpful contributions`;
    const bar = goal.querySelector('.goal-track span');
    if (bar) bar.style.width = `${weekly * 20}%`;
    const small = goal.querySelector('small');
    if (small) small.textContent = weekly >= 5 ? 'Weekly goal complete — keep learning!' : `Ask or answer ${5 - weekly} more time${5 - weekly === 1 ? '' : 's'} to finish.`;
  }
  [m.questions, m.answers, m.solved, m.accepted].forEach((value, index) => {
    const el = wrap.querySelectorAll('.study-stat-grid article strong')[index];
    if (el) el.textContent = formatCount(value);
  });
  const practice = wrap.querySelector('.practice-button');
  if (practice) { practice.removeAttribute('data-action'); practice.dataset.qualityPractice = '1'; }
  const streak = wrap.querySelector('.streak-pill');
  if (streak) {
    const days = num(state.profile?.streakDays, state.profile?.studyStreak, state.profile?.streak);
    streak.innerHTML = `${svg('flame',19)} ${days} day${days === 1 ? '' : 's'}`;
  }
  const focus = wrap.querySelector('.subject-focus-block');
  if (focus) {
    const counts = new Map();
    ownQuestions().forEach(post => counts.set(normalizeSubject(post.subject), (counts.get(normalizeSubject(post.subject)) || 0) + 1));
    const top = [...counts.entries()].sort((a,b) => b[1]-a[1]).slice(0,4);
    focus.innerHTML = `<h2>Subject focus</h2>${top.length ? `<div class="quality-focus-list">${top.map(([name,count]) => `<button type="button" data-quality-subject-jump="${escapeHTML(name)}"><span>${escapeHTML(name)}</span><b>${count}</b></button>`).join('')}</div>` : '<p>Start asking or answering to build your subject map.</p>'}`;
  }
}

function patchProfile() {
  if (routeName() !== 'profile') return;
  const wrap = document.querySelector('.content-wrap');
  if (!wrap) return;
  const m = metrics();
  const p = state.profile || {};
  const signature = `${m.points}:${m.questions}:${m.answers}:${m.followers}:${m.following}:${Boolean(p.verified)}`;
  if (wrap.dataset.qualityProfile === signature) return;
  wrap.dataset.qualityProfile = signature;

  const stats = [...wrap.querySelectorAll('.profile-stats > span')];
  const values = [m.points, m.questions, m.answers, m.followers, m.following];
  const labels = ['Reputation', 'Questions', 'Answers', 'Followers', 'Following'];
  stats.slice(0,5).forEach((stat,index) => { stat.innerHTML = `<b>${formatCount(values[index])}</b><small>${labels[index]}</small>`; });
  const tabs = wrap.querySelector('.profile-tabs');
  if (tabs) tabs.style.display = 'none';
  const feed = wrap.querySelector('.feed-list');
  if (feed) { feed.style.display = ''; feed.classList.add('quality-profile-feed'); }
  wrap.querySelectorAll('.questions-asked-panel').forEach(el => el.remove());
  if (feed && !wrap.querySelector('.quality-questions-title')) feed.insertAdjacentHTML('beforebegin', '<section class="quality-questions-title"><h2>Questions Asked</h2></section>');

  const achievements = wrap.querySelector('.academic-achievements');
  if (achievements) achievements.innerHTML = `<h2>Academic Achievements</h2><div class="achievement-row"><span class="achievement-chip ${m.answers > 0 ? 'active' : 'disabled'}">${svg('check',18)} First Answer</span><span class="achievement-chip ${m.points >= 100 ? 'active' : 'disabled'}">${svg('trophy',18)} Scholar (+100 Rep)</span><span class="achievement-chip ${p.verified ? 'active' : 'disabled'}">${svg('check',18)} Verified</span></div>`;

  const info = wrap.querySelector('.profile-info');
  if (info && !info.querySelector('.quality-joined')) {
    const joined = timestampToDate(p.createdAt || p.joinedAt);
    if (joined) info.insertAdjacentHTML('beforeend', `<small class="quality-joined">Joined: ${escapeHTML(joined.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' }))}</small>`);
  }
}

function avatar(user = {}) {
  const name = user.fullName || 'Tefsen User';
  const photo = safeUrl(user.photoUrl || user.profileImageUrl || '');
  const initials = name.split(/\s+/).filter(Boolean).slice(0,2).map(v => v[0]).join('').toUpperCase() || 'TU';
  return photo ? `<img src="${photo}" alt="${escapeHTML(name)}">` : `<span>${escapeHTML(initials)}</span>`;
}

function patchLeaderboard() {
  if (routeName() !== 'leaderboard') return;
  const panel = document.querySelector('.content-wrap > .panel');
  if (!panel) return;
  const eligible = (state.leaderboard || []).filter(user => num(user.points) > 400);
  if (!eligible.length) return;
  const signature = eligible.map(user => `${user.uid}:${user.points}`).join('|');
  if (panel.dataset.qualityLeaderboard === signature) return;
  panel.dataset.qualityLeaderboard = signature;
  panel.innerHTML = eligible.map((user,index) => `<button class="leaderboard-row quality-leader-row" type="button" data-route="profile/${encodeURIComponent(user.uid || user.id || '')}"><span class="rank ${index < 3 ? 'top' : ''}">${index+1}</span><span class="quality-leader-user"><span class="quality-leader-avatar">${avatar(user)}</span><span><b>${escapeHTML(user.fullName || 'Tefsen User')}</b><small>${escapeHTML(user.role || 'Student')}</small></span></span><span class="points">${formatCount(user.points)} pts</span></button>`).join('');
}

function showPracticePicker() {
  modalRoot.innerHTML = `<div class="modal-backdrop quality-practice-backdrop" data-quality-practice-close><section class="quality-practice-sheet" role="dialog" aria-modal="true"><span class="quality-eyebrow">PRACTICE</span><h2>Choose a subject</h2><p>Start by asking a focused academic question.</p><div class="quality-practice-subjects">${SUBJECTS.slice(1).map(subject => `<button type="button" data-quality-practice-subject="${escapeHTML(subject)}">${escapeHTML(subject)}</button>`).join('')}</div><button class="btn btn-ghost" type="button" data-quality-practice-close>Cancel</button></section></div>`;
}

function openComposer(subject = '') {
  modalRoot.innerHTML = '';
  const trigger = document.querySelector('[data-action="compose"]');
  if (!trigger) { toast('Question composer is not available on this screen.', 'error'); return; }
  trigger.click();
  requestAnimationFrame(() => {
    patchComposer();
    const field = document.querySelector('[data-compose-form] [name="subject"]');
    if (field && subject) field.value = subject;
    document.querySelector('[data-compose-form] [name="title"]')?.focus();
  });
}

function apply() {
  if (applying) return;
  applying = true;
  try {
    document.documentElement.classList.add('web-quality');
    patchTopbar();
    patchSidebar();
    patchComposer();
    patchHome();
    patchStudy();
    patchProfile();
    patchLeaderboard();
  } finally {
    applying = false;
  }
}

function scheduleApply() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; apply(); });
}

document.addEventListener('click', event => {
  const theme = event.target.closest?.('[data-quality-theme]');
  if (theme) {
    event.preventDefault();
    localStorage.setItem('tefsen_web_theme', document.documentElement.dataset.webTheme === 'light' ? 'dark' : 'light');
    applyTheme();
    return;
  }
  const feed = event.target.closest?.('[data-quality-feed]');
  if (feed) {
    event.preventDefault(); event.stopImmediatePropagation();
    homeMode = feed.dataset.qualityFeed || 'for-you';
    const list = document.querySelector('.feed-list'); if (list) delete list.dataset.qualitySignature;
    patchHome();
    return;
  }
  const subject = event.target.closest?.('[data-quality-subject]');
  if (subject) {
    event.preventDefault(); event.stopImmediatePropagation();
    activeSubject = subject.dataset.qualitySubject || 'All Subjects';
    const list = document.querySelector('.feed-list'); if (list) delete list.dataset.qualitySignature;
    const rail = document.querySelector('.quality-subjects'); if (rail) delete rail.dataset.signature;
    patchHome();
    return;
  }
  const jump = event.target.closest?.('[data-quality-subject-jump]');
  if (jump) {
    activeSubject = jump.dataset.qualitySubjectJump || 'All Subjects'; homeMode = 'latest'; location.hash = '#/home'; setTimeout(scheduleApply, 0); return;
  }
  if (event.target.closest?.('[data-quality-practice]')) {
    event.preventDefault(); event.stopImmediatePropagation(); showPracticePicker(); return;
  }
  const practiceSubject = event.target.closest?.('[data-quality-practice-subject]');
  if (practiceSubject) {
    event.preventDefault(); event.stopImmediatePropagation(); openComposer(practiceSubject.dataset.qualityPracticeSubject || ''); return;
  }
  const close = event.target.closest?.('[data-quality-practice-close]');
  if (close && (close === event.target || close.matches('button'))) { event.preventDefault(); modalRoot.innerHTML = ''; }
}, true);

window.addEventListener('hashchange', () => setTimeout(scheduleApply, 0));
window.addEventListener('resize', scheduleApply);
new MutationObserver(() => { if (!applying) scheduleApply(); }).observe(root, { childList: true, subtree: true });
scheduleApply();
