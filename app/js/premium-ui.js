// Tefsen Premium UI enhancements.
// Loaded after the main app module so the existing Firebase/data behavior remains intact.

const MESSAGE_ROUTE = 'messages';

function stripMessagesUI(root = document) {
  root.querySelectorAll('[data-route="messages"]').forEach((el) => el.remove());

  // Remove any text-only legacy navigation item that may be rendered by older templates.
  root.querySelectorAll('button, a').forEach((el) => {
    const label = (el.textContent || '').trim().toLowerCase();
    if (label === 'messages' && (el.closest('.nav-list') || el.closest('.topbar-actions'))) {
      el.remove();
    }
  });
}

function redirectLegacyMessagesRoute() {
  const route = location.hash.replace(/^#\/?/, '').split('/')[0].toLowerCase();
  if (route === MESSAGE_ROUTE) {
    history.replaceState(null, '', `${location.pathname}${location.search}#/home`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
}

function enhanceAccessibility(root = document) {
  root.querySelectorAll('.post-card').forEach((card) => {
    if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex', '0');
  });

  root.querySelectorAll('img:not([decoding])').forEach((img) => {
    img.setAttribute('decoding', 'async');
  });
}

function applyPremiumEnhancements() {
  stripMessagesUI();
  redirectLegacyMessagesRoute();
  enhanceAccessibility();
  document.documentElement.classList.add('tefsen-premium-ui');
}

let queued = false;
const observer = new MutationObserver(() => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    applyPremiumEnhancements();
  });
});

observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', redirectLegacyMessagesRoute);
document.addEventListener('DOMContentLoaded', applyPremiumEnhancements, { once: true });
applyPremiumEnhancements();
