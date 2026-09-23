const CACHE = 'tefsen-web-shell-v63-account-privacy';

const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/app.css', './css/premium.css', './css/premium-v2.css', './css/social-cleanup.css', './css/opportunities.css', './css/student-passport.css', './css/journey.css', './css/communities.css', './css/admin.css', './css/v2.css', './css/v3-polish.css', './css/v4-profile.css', './css/home-dashboard.css', './css/v25-settings.css', './css/v27-moderation.css', './css/v28-recognition.css', './css/v29-search-integrity.css',
  './js/app.js', './js/config/schema.js', './js/firebase-client.js', './js/store.js', './js/utils.js',
  './js/services/auth-service.js', './js/services/account-bootstrap-service.js', './js/services/privacy-request-service.js', './js/services/data-service.js', './js/services/demo-data.js',
  './js/services/opportunity-service.js', './js/services/opportunity-demo-data.js', './js/services/opportunity-starter-data.js', './js/services/student-passport-service.js', './js/services/eligibility-engine.js', './js/services/journey-service.js', './js/services/deadline-engine.js', './js/services/home-dashboard-service.js', './js/services/saved-opportunity-service.js', './js/services/journey-priority-service.js', './js/services/journey-detail-service.js', './js/services/post-acceptance-service.js', './js/post-acceptance-view.js', './js/services/public-profile-service.js', './js/services/public-profile-record-service.js', './js/services/community-service.js', './js/services/success-story-service.js', './js/services/journey-story-service.js', './js/services/global-search-service.js', './js/services/notification-service.js', './js/services/notification-state-service.js', './js/services/saved-community-service.js', './js/services/settings-service.js', './js/services/app-check-readiness-service.js', './js/services/moderation-model.js', './js/services/moderation-service.js', './js/services/opportunity-admin-service.js',
  './assets/tefsen-logo.png', './assets/favicon.png'
];

function isFirebaseRuntimeConfig(url) {
  return url.pathname.endsWith('/js/config/firebase-config.js');
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || request.destination === 'document';
}

async function updateCachedNavigation(response) {
  if (!response || !response.ok || response.type !== 'basic') return;
  const cache = await caches.open(CACHE);
  await cache.put('./index.html', response.clone());
}

async function networkOnlyConfig(request) {
  return fetch(request, { cache:'no-store' });
}

async function navigationResponse(request) {
  try {
    const response = await fetch(request);
    await updateCachedNavigation(response);
    return response;
  } catch {
    return (await caches.match('./index.html')) || Response.error();
  }
}

async function staticAssetResponse(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) || Response.error();
  }
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  if (isFirebaseRuntimeConfig(url)) {
    event.respondWith(networkOnlyConfig(request));
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(navigationResponse(request));
    return;
  }

  event.respondWith(staticAssetResponse(request));
});
