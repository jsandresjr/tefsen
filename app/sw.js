const CACHE = 'tefsen-web-shell-v43-subject-communities';
const SHELL = [
  './', './index.html',
  './css/app.css', './css/premium.css', './css/premium-v2.css', './css/social-cleanup.css', './css/opportunities.css', './css/student-passport.css', './css/journey.css', './css/communities.css', './css/admin.css', './css/v2.css', './css/v3-polish.css', './css/v4-profile.css', './css/home-dashboard.css',
  './js/app.js', './js/config/firebase-config.js', './js/config/schema.js', './js/firebase-client.js', './js/store.js', './js/utils.js', './js/services/opportunity-service.js', './js/services/opportunity-starter-data.js', './js/services/student-passport-service.js', './js/services/eligibility-engine.js', './js/services/journey-service.js', './js/services/deadline-engine.js', './js/services/home-dashboard-service.js', './js/services/saved-opportunity-service.js', './js/services/journey-priority-service.js', './js/services/journey-detail-service.js', './js/services/post-acceptance-service.js', './js/post-acceptance-view.js', './js/services/public-profile-service.js', './js/services/community-service.js', './js/services/opportunity-admin-service.js',
  './assets/tefsen-logo.png', './assets/favicon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  event.respondWith(
    fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy));
      return response;
    }).catch(() => caches.match(request).then(hit => hit || caches.match('./index.html')))
  );
});
