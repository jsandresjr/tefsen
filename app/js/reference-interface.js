const TEFSEN_REFERENCE_INTERFACE = (() => {
  let queued = false;

  const checkIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';

  function route() {
    return (location.hash || '#/home').replace(/^#\/?/, '').split('/')[0] || 'home';
  }

  function ensureReferenceClass() {
    document.documentElement.classList.add('tefsen-web-reference');
  }

  function ensureSubjectFilters() {
    if (route() !== 'home') return null;
    const tabs = document.querySelector('.content-wrap .feed-tabs');
    if (!tabs) return null;

    let row = tabs.nextElementSibling;
    if (!row?.classList?.contains('subject-filter-row') || row.hidden) {
      tabs.insertAdjacentHTML('afterend', `
        <div class="subject-filter-row" aria-label="Subject filters">
          <button class="subject-chip active" type="button" data-parity-subject="all">${checkIcon} All Subjects</button>
          <button class="subject-chip" type="button" data-subject="Mathematics">Mathematics</button>
          <button class="subject-chip" type="button" data-subject="Physics">Physics</button>
          <button class="subject-chip" type="button" data-subject="Chemistry">Chemistry</button>
        </div>`);
      row = tabs.nextElementSibling;
    }
    return row;
  }

  function ensureLearningCircles(subjectRow) {
    if (route() !== 'home' || !subjectRow) return;
    const circles = subjectRow.nextElementSibling;
    if (circles?.classList?.contains('learning-circles')) return;

    subjectRow.insertAdjacentHTML('afterend', `
      <section class="learning-circles" aria-label="Learning circles">
        <button class="learning-circle" type="button" data-route="profile" aria-label="Open My Space">
          <span class="learning-circle-orb"><span>ME</span></span><small>My Space</small>
        </button>
        <button class="learning-circle" type="button" data-subject="Mathematics" aria-label="Explore Mathematics">
          <span class="learning-circle-orb"><span>∑</span></span><small>Mathematics</small>
        </button>
        <button class="learning-circle" type="button" data-subject="Physics" aria-label="Explore Physics">
          <span class="learning-circle-orb"><span>Φ</span></span><small>Physics</small>
        </button>
        <button class="learning-circle" type="button" data-subject="Chemistry" aria-label="Explore Chemistry">
          <span class="learning-circle-orb"><span>⚗</span></span><small>Chemistry</small>
        </button>
        <button class="learning-circle" type="button" data-subject="Biology" aria-label="Explore Biology">
          <span class="learning-circle-orb"><span>DNA</span></span><small>Biology</small>
        </button>
        <button class="learning-circle" type="button" data-subject="Computer Science" aria-label="Explore Computer Science">
          <span class="learning-circle-orb"><span>&lt;/&gt;</span></span><small>Computing</small>
        </button>
        <button class="learning-circle" type="button" data-route="study" aria-label="Open Study Hub">
          <span class="learning-circle-orb"><span>✓</span></span><small>Study Hub</small>
        </button>
      </section>`);
  }

  function patchFeedCards() {
    document.querySelectorAll('.post-card').forEach(card => {
      if (card.dataset.socialFeedCard === '1') return;
      card.dataset.socialFeedCard = '1';
      card.classList.add('social-feed-card');
    });
  }

  function patchHeader() {
    const input = document.querySelector('.global-search input');
    if (input && input.placeholder !== 'Search Tefsen') input.placeholder = 'Search Tefsen';
  }

  function patchRightRail() {
    const headings = [...document.querySelectorAll('.rightbar .widget h3')];
    if (headings[0] && headings[0].textContent !== 'Learning pulse') headings[0].textContent = 'Learning pulse';
    if (headings[1] && headings[1].textContent !== 'Your learning') headings[1].textContent = 'Your learning';
  }

  function patchMobileCreate() {
    const create = document.querySelector('.mobile-bottom .create-mobile');
    if (create) create.classList.add('social-create');
  }

  function patchFloatingAsk() {
    const button = document.querySelector('.floating-ask');
    if (!button) return;
    button.setAttribute('aria-label', 'Ask a question');
  }

  function apply() {
    queued = false;
    ensureReferenceClass();
    patchHeader();
    patchRightRail();
    patchMobileCreate();
    patchFloatingAsk();

    if (route() === 'home') {
      const subjectRow = ensureSubjectFilters();
      ensureLearningCircles(subjectRow);
      patchFeedCards();
    }
  }

  function queueApply() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  window.addEventListener('hashchange', queueApply);
  new MutationObserver(queueApply).observe(document.documentElement, { childList: true, subtree: true });
  queueApply();

  return { apply: queueApply };
})();
