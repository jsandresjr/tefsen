(() => {
  'use strict';

  const OLD_ORIGIN = 'https://tefsen.com';
  const NEW_ORIGIN = 'https://tefsen.org';

  const replaceLegacyDomain = (value = '') => String(value).replaceAll(OLD_ORIGIN, NEW_ORIGIN);

  document.querySelectorAll('link[href], meta[content]').forEach((element) => {
    if (element.hasAttribute('href')) {
      const href = element.getAttribute('href');
      if (href?.includes(OLD_ORIGIN)) element.setAttribute('href', replaceLegacyDomain(href));
    }
    if (element.hasAttribute('content')) {
      const content = element.getAttribute('content');
      if (content?.includes(OLD_ORIGIN)) element.setAttribute('content', replaceLegacyDomain(content));
    }
  });

  document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
    if (script.textContent.includes(OLD_ORIGIN)) {
      script.textContent = replaceLegacyDomain(script.textContent);
    }
  });

  const header = document.querySelector('[data-header]');
  const menuButton = document.querySelector('[data-menu-button]');
  const nav = document.querySelector('[data-nav]');

  const updateHeader = () => {
    if (!header) return;
    header.classList.toggle('scrolled', window.scrollY > 24);
  };

  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  if (menuButton && nav) {
    menuButton.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      menuButton.setAttribute('aria-expanded', String(isOpen));
      menuButton.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
      document.body.classList.toggle('menu-open', isOpen);
    });

    nav.addEventListener('click', (event) => {
      if (!(event.target instanceof HTMLAnchorElement)) return;
      nav.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'Open navigation');
      document.body.classList.remove('menu-open');
    });
  }

  const companyHeading = [...document.querySelectorAll('.footer-column > b')]
    .find((heading) => heading.textContent.trim().toLowerCase() === 'company');
  const companyColumn = companyHeading?.closest('.footer-column');
  if (companyColumn && !companyColumn.querySelector('a[href="founder.html"]')) {
    const founderLink = document.createElement('a');
    founderLink.href = 'founder.html';
    founderLink.textContent = 'Founder';
    companyColumn.insertBefore(founderLink, companyColumn.querySelector('a[href="#contact"]') || null);
  }

  const revealItems = document.querySelectorAll('.reveal');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('visible'));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.13, rootMargin: '0px 0px -40px 0px' });

    revealItems.forEach((item) => observer.observe(item));
  }
})();
