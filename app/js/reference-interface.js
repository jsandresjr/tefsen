const TEFSEN_REFERENCE_INTERFACE = (() => {
  let queued = false;

  const checkIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';

  function route() {
    return (location.hash || '#/home').replace(/^#\/?/, '').split('/')[0] || 'home';
  }

  function ensureSubjectFilters() {
    if (route() !== 'home') return;
    const tabs = document.querySelector('.content-wrap .feed-tabs');
    if (!tabs) return;

    const next = tabs.nextElementSibling;
    if (next?.classList?.contains('subject-filter-row') && !next.hidden) return;

    tabs.insertAdjacentHTML('afterend', `
      <div class="subject-filter-row" aria-label="Subject filters">
        <button class="subject-chip active" type="button" data-parity-subject="all">${checkIcon} All Subjects</button>
        <button class="subject-chip" type="button" data-subject="Mathematics">Mathematics</button>
        <button class="subject-chip" type="button" data-subject="Physics">Physics</button>
        <button class="subject-chip" type="button" data-subject="Chemistry">Chemistry</button>
      </div>`);
  }

  function ensureReferenceClass() {
    document.documentElement.classList.add('tefsen-web-reference');
  }

  function apply() {
    queued = false;
    ensureReferenceClass();
    ensureSubjectFilters();
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
