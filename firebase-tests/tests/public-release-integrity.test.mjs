import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const rootUrl = new URL('../../', import.meta.url);

async function read(path){
  return readFile(new URL(path, rootUrl),'utf8');
}
async function exists(path){
  try { await access(new URL(path, rootUrl)); return true; }
  catch { return false; }
}
function canonical(html){
  return html.match(/rel="canonical" href="([^"]+)"/)?.[1] || '';
}
function sitemapLocs(xml){
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
}

const [
  sitemap,
  robots,
  cname,
  home,
  founder,
  terms,
  privacyLegacy,
  privacyCanonical,
  deleteLegacy,
  deleteCanonical,
  appIndex,
  app,
  firebaseConfig,
  manifest,
  readme,
  sw
] = await Promise.all([
  read('sitemap.xml'),
  read('robots.txt'),
  read('CNAME'),
  read('index.html'),
  read('founder.html'),
  read('terms.html'),
  read('privacy.html'),
  read('privacy-policy/index.html'),
  read('delete-account.html'),
  read('delete-account/index.html'),
  read('app/index.html'),
  read('app/js/app.js'),
  read('app/js/config/firebase-config.js'),
  read('app/manifest.webmanifest'),
  read('README.md'),
  read('app/sw.js')
]);

test('custom domain and sitemap authority are canonical',()=>{
  assert.equal(cname.trim(),'www.tefsen.com');
  assert.match(robots,/Sitemap: https:\/\/www\.tefsen\.com\/sitemap\.xml/);
});

test('sitemap contains only canonical indexable public pages',()=>{
  const locs=sitemapLocs(sitemap);
  assert.deepEqual(locs,[
    'https://www.tefsen.com/',
    'https://www.tefsen.com/founder.html',
    'https://www.tefsen.com/privacy-policy/',
    'https://www.tefsen.com/terms.html',
    'https://www.tefsen.com/delete-account/'
  ]);
  assert.doesNotMatch(sitemap,/privacy\.html/);
  assert.doesNotMatch(sitemap,/delete-account\.html/);
  assert.doesNotMatch(sitemap,/https:\/\/www\.tefsen\.com\/app\//);
});

test('indexable sitemap pages expose matching canonical URLs',()=>{
  assert.equal(canonical(home),'https://www.tefsen.com/');
  assert.equal(canonical(founder),'https://www.tefsen.com/founder.html');
  assert.equal(canonical(privacyCanonical),'https://www.tefsen.com/privacy-policy/');
  assert.equal(canonical(terms),'https://www.tefsen.com/terms.html');
  assert.equal(canonical(deleteCanonical),'https://www.tefsen.com/delete-account/');
});

test('legacy privacy and deletion routes remain redirects only',()=>{
  assert.equal(canonical(privacyLegacy),'https://www.tefsen.com/privacy-policy/');
  assert.match(privacyLegacy,/window\.location\.replace\('\/privacy-policy\/'\)/);
  assert.equal(canonical(deleteLegacy),'https://www.tefsen.com/delete-account/');
  assert.match(deleteLegacy,/window\.location\.replace\('\/delete-account\/'\)/);
});

test('public and app navigation use canonical privacy route directly',()=>{
  assert.match(home,/href="privacy-policy\/">Privacy Policy<\/a>/);
  assert.doesNotMatch(home,/href="privacy\.html"/);
  assert.match(terms,/href="privacy-policy\//);
  assert.doesNotMatch(terms,/href="privacy\.html"/);
  assert.match(app,/href="\.\.\/privacy-policy\//);
  assert.doesNotMatch(app,/href="\.\.\/privacy\.html"/);
});

test('authenticated app stays intentionally non-indexable and out of sitemap',()=>{
  assert.match(appIndex,/meta name="robots" content="noindex,follow"/);
  assert.doesNotMatch(sitemap,/\/app\//);
});

test('production Firebase Web config is complete and not forced into demo mode',()=>{
  for(const key of ['apiKey','authDomain','projectId','storageBucket','messagingSenderId','appId']){
    assert.match(firebaseConfig,new RegExp(`${key}:\\s*["'](?!PASTE_|["'])`));
  }
  assert.doesNotMatch(firebaseConfig,/PASTE_FIREBASE_WEB_API_KEY/);
  assert.match(firebaseConfig,/window\.TEFSEN_FORCE_DEMO_MODE = false/);
  assert.match(firebaseConfig,/projectId:\s*"tefsen-fa2b5"/);
});

test('App Check readiness is not falsely represented as enforced',()=>{
  assert.match(firebaseConfig,/window\.TEFSEN_APPCHECK_SITE_KEY = ""/);
  assert.match(firebaseConfig,/validate traffic before enforcement/i);
});

test('PWA manifest points only to existing local assets',async()=>{
  const parsed=JSON.parse(manifest);
  assert.equal(parsed.start_url,'./#/home');
  assert.equal(parsed.scope,'./');
  for(const icon of parsed.icons || []){
    assert.equal(await exists(`app/${icon.src}`),true,`Missing manifest icon: ${icon.src}`);
  }
});

test('critical public and authenticated entry assets exist',async()=>{
  for(const path of [
    'index.html',
    'js/home.js',
    'css/home.css',
    'css/home-v2.css',
    'founder.html',
    'terms.html',
    'privacy-policy/index.html',
    'delete-account/index.html',
    'app/index.html',
    'app/js/app.js',
    'app/js/config/firebase-config.js',
    'app/manifest.webmanifest',
    'app/sw.js',
    'assets/tefsen-logo.png',
    'app/assets/tefsen-logo.png'
  ]){
    assert.equal(await exists(path),true,`Missing release asset: ${path}`);
  }
});

test('README distinguishes canonical routes from legacy redirects',()=>{
  assert.match(readme,/privacy-policy\/.*canonical/i);
  assert.match(readme,/privacy\.html.*legacy redirect/i);
  assert.match(readme,/delete-account\/.*canonical/i);
  assert.match(readme,/delete-account\.html.*legacy redirect/i);
});

test('PWA cache remains newer than the Step 39 release baseline',()=>{
  const version=Number(sw.match(/tefsen-web-shell-v(\d+)/)?.[1] || 0);
  assert.ok(version >= 65, `Expected PWA cache version >= 65, received ${version}`);
});
