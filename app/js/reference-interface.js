const TEFSEN_REFERENCE_INTERFACE = (() => {
  let queued = false;
  let applying = false;

  function route() {
    return (location.hash || '#/home').replace(/^#\/?/, '').split('/')[0] || 'home';
  }

  function ensureReferenceClass() {
    document.documentElement.classList.add('tefsen-web-reference');
  }

  function cleanupLegacyHomeRows() {
    if (route() !== 'home') return;
    const wrap = document.querySelector('.content-wrap');
    if (!wrap) return;

    // web-polish owns the real subject filter. Older parity/reference rows caused
    // the duplicated dark strip seen in light mode, so remove only rows inside Home.
    wrap.querySelectorAll('.subject-filter-row').forEach(row => row.remove());
  }

  function ensureLearningCircles() {
    if (route() !== 'home') return;
    const wrap = document.querySelector('.content-wrap');
    const subjects = wrap?.querySelector('.quality-subjects');
    if (!wrap || !subjects) return;

    let circles = wrap.querySelector('.learning-circles');
    if (circles) {
      if (circles.previousElementSibling !== subjects) subjects.insertAdjacentElement('afterend', circles);
      return;
    }

    subjects.insertAdjacentHTML('afterend', `
      <section class="learning-circles" aria-label="Learning circles">
        <button class="learning-circle" type="button" data-route="profile" aria-label="Open My Space">
          <span class="learning-circle-orb"><span>ME</span></span><small>My Space</small>
        </button>
        <button class="learning-circle" type="button" data-quality-subject="Mathematics" aria-label="Show Mathematics questions">
          <span class="learning-circle-orb"><span>∑</span></span><small>Mathematics</small>
        </button>
        <button class="learning-circle" type="button" data-quality-subject="Physics" aria-label="Show Physics questions">
          <span class="learning-circle-orb"><span>Φ</span></span><small>Physics</small>
        </button>
        <button class="learning-circle" type="button" data-quality-subject="Chemistry" aria-label="Show Chemistry questions">
          <span class="learning-circle-orb"><span>⚗</span></span><small>Chemistry</small>
        </button>
        <button class="learning-circle" type="button" data-quality-subject="Biology" aria-label="Show Biology questions">
          <span class="learning-circle-orb"><span>DNA</span></span><small>Biology</small>
        </button>
        <button class="learning-circle" type="button" data-quality-subject="ICT/Computer Science" aria-label="Show computing questions">
          <span class="learning-circle-orb"><span>&lt;/&gt;</span></span><small>Computing</small>
        </button>
        <button class="learning-circle" type="button" data-route="study" aria-label="Open Study Hub">
          <span class="learning-circle-orb"><span>✓</span></span><small>Study Hub</small>
        </button>
      </section>`);
  }

  function patchFeedCards() {
    if (route() !== 'home') return;
    document.querySelectorAll('.post-card').forEach(card => {
      card.classList.add('social-feed-card');
      card.dataset.socialFeedCard = '1';
    });
  }

  function patchHeader() {
    const input = document.querySelector('.global-search input');
    if (input) input.placeholder = 'Search questions, people, subjects';
  }

  function patchRightRail() {
    const headings = [...document.querySelectorAll('.rightbar .widget h3')];
    if (headings[0]) headings[0].textContent = 'Learning pulse';
    if (headings[1]) headings[1].textContent = 'Your learning';
  }

  function patchMobileCreate() {
    document.querySelector('.mobile-bottom .create-mobile')?.classList.add('social-create');
  }

  function apply() {
    if (applying) return;
    applying = true;
    queued = false;
    try {
      ensureReferenceClass();
      patchHeader();
      patchRightRail();
      patchMobileCreate();
      cleanupLegacyHomeRows();
      ensureLearningCircles();
      patchFeedCards();
    } finally {
      applying = false;
    }
  }

  function queueApply() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  window.addEventListener('hashchange', queueApply);
  new MutationObserver(() => { if (!applying) queueApply(); }).observe(document.getElementById('app-root') || document.documentElement, { childList: true, subtree: true });
  queueApply();

  return { apply: queueApply };
})();
