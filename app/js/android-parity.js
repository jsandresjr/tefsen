const TEFSEN_PARITY = (() => {
  const icon = (name, size = 22) => {
    const paths = {
      home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/>',
      bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      study: '<path d="m3 10 9-5 9 5-9 5-9-5Z"/><path d="M7 12.2V17c2.8 2 7.2 2 10 0v-4.8"/><path d="M21 10v6"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
      trophy: '<path d="M8 3h8v5a4 4 0 0 1-8 0V3Z"/><path d="M8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 12v5M8 21h8M9 17h6"/>',
      question: '<circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.5 2.5 0 0 1 4.8 1c0 2-2.5 2.1-2.5 4"/><path d="M12 18h.01"/>',
      check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
      message: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/>',
      fire: '<path d="M13 2s1 4-2 6c-2 1.4-3 3.2-3 5.2A4 4 0 0 0 12 17a4 4 0 0 0 4-4c0-1.5-.7-2.9-2-4 .2 2-1 3-2 3 .7-4-2-6-2-6"/><path d="M9 19h6"/>',
      bookmark: '<path d="M6 3h12v18l-6-4-6 4V3Z"/>',
      upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>'
    };
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.question}</svg>`;
  };

  const route = () => (location.hash || '#/home').replace(/^#\/?/, '').split('/')[0] || 'home';
  let applying = false;
  let queued = false;

  function queueApply() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      apply();
    });
  }

  function setNavButton(button, routeName, label, iconName) {
    if (!button) return;
    button.dataset.route = routeName;
    button.removeAttribute('data-action');
    button.setAttribute('aria-label', label);
    button.innerHTML = `${icon(iconName, 22)}<span class="mobile-nav-label">${label}</span>`;
    button.classList.toggle('active', route() === routeName);
  }

  function patchMobileNav() {
    const nav = document.querySelector('.mobile-bottom');
    if (!nav) return;
    const buttons = [...nav.querySelectorAll(':scope > button')];
    if (buttons.length < 5) return;

    setNavButton(buttons[0], 'home', 'Home', 'home');
    setNavButton(buttons[1], 'notifications', 'Alerts', 'bell');

    const ask = buttons[2];
    ask.removeAttribute('data-route');
    ask.dataset.action = 'compose';
    ask.setAttribute('aria-label', 'Ask');
    ask.innerHTML = `${icon('plus', 25)}<span class="mobile-nav-label">Ask</span>`;
    ask.classList.add('create-mobile');

    setNavButton(buttons[3], 'study', 'Study', 'study');
    setNavButton(buttons[4], 'profile', 'Profile', 'user');
  }

  function patchSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    const firstNav = sidebar.querySelector('.nav-list');
    if (!firstNav) return;

    const find = (routeName) => firstNav.querySelector(`[data-route="${routeName}"]`);
    const home = find('home');
    if (home) home.innerHTML = `<span class="nav-icon">${icon('home', 20)}</span><span>Home</span>`;

    const explore = find('explore');
    const notifications = find('notifications');
    if (explore) {
      explore.dataset.route = 'notifications';
      explore.innerHTML = `<span class="nav-icon">${icon('bell', 20)}</span><span>Alerts</span>`;
    }
    if (notifications && notifications !== explore) notifications.classList.add('parity-hide-nav');

    let study = firstNav.querySelector('[data-parity-study]');
    if (!study) {
      study = document.createElement('button');
      study.type = 'button';
      study.className = 'nav-item';
      study.dataset.route = 'study';
      study.dataset.parityStudy = '1';
      firstNav.appendChild(study);
    }
    study.innerHTML = `<span class="nav-icon">${icon('study', 20)}</span><span>Study</span>`;
    study.classList.toggle('active', route() === 'study');
  }

  function subjectFilters() {
    if (document.querySelector('.subject-filter-row')) return;
    const tabs = document.querySelector('.feed-tabs');
    if (!tabs) return;
    tabs.insertAdjacentHTML('afterend', `
      <div class="subject-filter-row" aria-label="Subject filters">
        <button class="subject-chip active" type="button" data-parity-subject="all">${icon('check', 16)} All Subjects</button>
        <button class="subject-chip" type="button" data-subject="Mathematics">Mathematics</button>
        <button class="subject-chip" type="button" data-subject="Physics">Physics</button>
        <button class="subject-chip" type="button" data-subject="Chemistry">Chemistry</button>
      </div>`);
  }

  function patchHome() {
    if (route() !== 'home') return;
    const tabs = [...document.querySelectorAll('.feed-tabs .feed-tab')];
    const labels = ['For You', 'Latest', 'Unanswered', 'Following'];
    tabs.slice(0, 4).forEach((tab, index) => {
      tab.textContent = labels[index];
      tab.classList.add('parity-feed-tab');
    });
    subjectFilters();

    const fakeInput = document.querySelector('.composer-mini .fake-input');
    if (fakeInput) fakeInput.textContent = 'Ask an academic question or share what you learned…';

    const empty = document.querySelector('.feed-list .empty-state');
    if (empty && !document.querySelector('.post-card')) {
      empty.classList.add('academic-empty');
      empty.innerHTML = `
        <div class="academic-empty-icon">${icon('question', 62)}</div>
        <h3>No questions found</h3>
        <p>Be the first to ask an academic question in this subject!</p>
        <button class="btn btn-primary academic-empty-cta" type="button" data-action="compose">${icon('plus', 23)} Ask the first question</button>`;
    }

    const wrap = document.querySelector('.content-wrap');
    if (wrap && !wrap.querySelector('.floating-ask')) {
      wrap.insertAdjacentHTML('beforeend', `<button class="floating-ask" type="button" data-action="compose">${icon('plus', 25)}<span>Ask Question</span></button>`);
    }
  }

  function patchNotifications() {
    if (route() !== 'notifications') return;
    const head = document.querySelector('.page-head h1');
    if (head) head.innerHTML = `${icon('bell', 30)} Notifications`;
    const desc = document.querySelector('.page-head p');
    if (desc) desc.textContent = '';
    const empty = document.querySelector('.empty-state');
    if (empty) {
      empty.classList.add('notification-empty');
      empty.innerHTML = `<div class="notification-empty-orb">${icon('bell', 52)}</div><h3>Quiet for now</h3><p>You'll see activity updates, answers to your questions, and community alerts here.</p>`;
    }
  }

  function patchLeaderboard() {
    if (route() !== 'leaderboard') return;
    const desc = document.querySelector('.page-head p');
    if (desc) desc.remove();
    const empty = document.querySelector('.empty-state');
    if (empty) {
      empty.classList.add('leaderboard-empty');
      empty.innerHTML = `<div class="leaderboard-empty-icon">${icon('trophy', 70)}</div><h3>Leaderboard Empty</h3><p>Earn more than 400 reputation points to appear here!</p>`;
    }
  }

  function patchProfile() {
    if (route() !== 'profile') return;
    const panel = document.querySelector('.content-wrap > .panel');
    if (!panel) return;
    panel.classList.add('profile-dashboard-card');

    const info = panel.querySelector('.profile-info');
    if (info && !info.querySelector('.profile-dashboard-label')) {
      const label = document.createElement('div');
      label.className = 'profile-dashboard-label';
      label.textContent = 'Profile Dashboard';
      panel.prepend(label);
    }

    const stats = [...panel.querySelectorAll('.profile-stats > span')];
    if (stats.length >= 4) {
      const values = stats.map(el => el.querySelector('b')?.textContent || '0');
      const posts = values[0] || '0';
      const followers = values[1] || '0';
      const following = values[2] || '0';
      const points = values[3] || '0';
      panel.querySelector('.profile-stats').innerHTML = `
        <span><b>${points}</b><small>Reputation</small></span>
        <span><b>${posts}</b><small>Questions</small></span>
        <span><b>0</b><small>Answers</small></span>
        <span><b>${followers}</b><small>Followers</small></span>
        <span><b>${following}</b><small>Following</small></span>`;
    }

    const wrap = document.querySelector('.content-wrap');
    if (!wrap || wrap.querySelector('.academic-achievements')) return;
    const tabs = wrap.querySelector('.profile-tabs');
    if (tabs) tabs.style.display = 'none';
    const feed = wrap.querySelector('.feed-list');
    if (feed) feed.style.display = 'none';
    panel.insertAdjacentHTML('afterend', `
      <section class="academic-achievements">
        <h2>Academic Achievements</h2>
        <div class="achievement-row">
          <span class="achievement-chip disabled">${icon('check',18)} First Answer</span>
          <span class="achievement-chip disabled">${icon('trophy',18)} Scholar (+100 Rep)</span>
          <span class="achievement-chip active">${icon('check',18)} Verified</span>
        </div>
      </section>
      <section class="questions-asked-panel">
        <h2>Questions Asked</h2>
        <div class="questions-placeholder">No academic questions posted yet.</div>
      </section>`);
  }

  function renderStudy() {
    if (route() !== 'study') return;
    const wrap = document.querySelector('.content-wrap');
    if (!wrap) return;
    if (wrap.dataset.parityStudyRendered === '1') return;
    wrap.dataset.parityStudyRendered = '1';
    wrap.classList.add('study-wrap');
    wrap.innerHTML = `
      <section class="study-hub-screen">
        <header class="study-head">
          <div><h1>Study Hub</h1><p>Your learning, organized</p></div>
          <div class="study-head-actions"><span class="streak-pill">${icon('fire',20)} 0 day</span><button class="trophy-round" type="button" data-route="leaderboard" aria-label="Leaderboard">${icon('trophy',24)}</button></div>
        </header>
        <section class="weekly-goal-card">
          <h2>${icon('fire',28)} Weekly learning goal</h2>
          <p><strong>0</strong> of 5 helpful contributions</p>
          <div class="goal-track"><span style="width:0%"></span></div>
          <small>Ask or answer 5 more times to finish.</small>
        </section>
        <div class="study-stat-grid">
          <article><span class="study-stat-icon blue">${icon('question',23)}</span><strong>0</strong><small>Asked</small></article>
          <article><span class="study-stat-icon green">${icon('message',23)}</span><strong>0</strong><small>Answered</small></article>
          <article><span class="study-stat-icon purple">${icon('check',23)}</span><strong>0</strong><small>Solved</small></article>
          <article><span class="study-stat-icon gold">${icon('check',23)}</span><strong>0</strong><small>Accepted</small></article>
        </div>
        <section class="quick-actions-block">
          <h2>Quick actions</h2>
          <button class="practice-button" type="button" data-action="compose">${icon('study',24)} Start Practice Session</button>
          <div class="quick-action-row">
            <button type="button" data-action="compose">${icon('plus',22)} Ask</button>
            <button class="outline" type="button" data-route="notifications">${icon('bell',22)} Activity</button>
          </div>
        </section>
        <section class="subject-focus-block"><h2>Subject focus</h2><p>Start asking or answering to build your subject map.</p></section>
        <section class="continue-learning-block"><div><h2>Continue learning</h2><span>0 saved</span></div><div class="continue-empty">${icon('bookmark',24)}<p>Save useful questions and answers to continue later.</p></div></section>
      </section>`;
  }

  function patchComposer() {
    const form = document.querySelector('[data-compose-form]');
    if (!form) return;
    const modal = form.closest('.modal');
    if (!modal || modal.classList.contains('academic-compose')) return;
    modal.classList.add('academic-compose');
    const title = modal.querySelector('.modal-head h2');
    if (title) title.textContent = 'Ask Academic Question';
    const titleInput = form.elements.title;
    const details = form.elements.content;
    const subject = form.elements.subject;
    if (titleInput) titleInput.placeholder = "e.g. Prove Euler's Identity using power series expansion";
    if (details) details.placeholder = 'Describe your academic problem step-by-step. Keep formulas highly readable.';
    if (subject) subject.placeholder = 'Mathematics';

    const titleField = titleInput?.closest('.field');
    const detailsField = details?.closest('.field');
    const subjectField = subject?.closest('.field');
    if (titleField?.querySelector('label')) titleField.querySelector('label').textContent = 'Title';
    if (detailsField?.querySelector('label')) detailsField.querySelector('label').textContent = 'Details / Equations';
    if (subjectField?.querySelector('label')) subjectField.querySelector('label').textContent = 'Select Subject';
    const drop = form.querySelector('.file-drop');
    if (drop) drop.classList.add('academic-file-drop');
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.innerHTML = `${icon('upload', 22)} Publish Question`;
  }

  function patchHeader() {
    const brand = document.querySelector('.topbar-brand span');
    if (brand && !brand.dataset.parityBrand) {
      brand.dataset.parityBrand = '1';
      brand.innerHTML = `<b>Tefsen</b><small>The Social Education Network</small>`;
    }
    const mobileBrand = document.querySelector('.mobile-top-brand span');
    if (mobileBrand && !mobileBrand.dataset.parityBrand) {
      mobileBrand.dataset.parityBrand = '1';
      mobileBrand.innerHTML = `<b>Tefsen</b><small>The Social Education Network</small>`;
    }
  }

  function apply() {
    if (applying) return;
    applying = true;
    try {
      document.documentElement.classList.add('tefsen-android-parity');
      patchHeader();
      patchMobileNav();
      patchSidebar();
      if (route() === 'study') renderStudy();
      else {
        patchHome();
        patchNotifications();
        patchLeaderboard();
        patchProfile();
      }
      patchComposer();
    } finally {
      applying = false;
    }
  }

  document.addEventListener('click', event => {
    const all = event.target.closest('[data-parity-subject="all"]');
    if (all) {
      event.preventDefault();
      document.querySelectorAll('.subject-chip').forEach(el => el.classList.remove('active'));
      all.classList.add('active');
      return;
    }
  }, true);

  window.addEventListener('hashchange', () => setTimeout(queueApply, 0));
  new MutationObserver(queueApply).observe(document.documentElement, { childList: true, subtree: true });
  queueApply();
  return { apply: queueApply };
})();
