import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';

const rootUrl = new URL('../../', import.meta.url);

async function exists(relativePath) {
  try {
    await access(new URL(relativePath, rootUrl));
    return true;
  } catch {
    return false;
  }
}

test('canonical public site and authenticated app entry points exist', async () => {
  assert.equal(await exists('index.html'), true);
  assert.equal(await exists('js/home.js'), true);
  assert.equal(await exists('app/index.html'), true);
  assert.equal(await exists('app/js/app.js'), true);
  assert.equal(await exists('app/js/services/data-service.js'), true);
  assert.equal(await exists('app/sw.js'), true);
});

test('legacy root authenticated application artifacts stay removed', async () => {
  for (const path of [
    'app.js',
    'services/data-service.js',
    'js/main.js',
    'script.js',
    'style.css'
  ]) {
    assert.equal(await exists(path), false, `legacy public artifact returned: ${path}`);
  }
});

test('temporary signup-like deploy copy stays removed', async () => {
  assert.equal(await exists('tefsen-web-signup-like-fix'), false);
});

test('repository root has no alternate public app/service directory', async () => {
  const entries = await readdir(rootUrl, { withFileTypes:true });
  const names = new Set(entries.map(entry => entry.name));
  assert.equal(names.has('services'), false);
  assert.equal(names.has('tefsen-web-signup-like-fix'), false);
});

test('public homepage links to the one canonical authenticated app', async () => {
  const home = await readFile(new URL('index.html', rootUrl), 'utf8');
  assert.match(home, /href="app\//);
  assert.match(home, /href="app\/#\/opportunities"/);
  assert.match(home, /src="js\/home\.js/);
  assert.doesNotMatch(home, /src="app\.js"/);
  assert.doesNotMatch(home, /js\/main\.js/);
});

test('canonical app entry uses only the app-local application tree', async () => {
  const appIndex = await readFile(new URL('app/index.html', rootUrl), 'utf8');
  assert.match(appIndex, /src="js\/config\/firebase-config\.js"/);
  assert.match(appIndex, /src="js\/app\.js"/);
  assert.doesNotMatch(appIndex, /\.\.\/app\.js/);
  assert.doesNotMatch(appIndex, /tefsen-web-signup-like-fix/);
});

test('README documents current same-domain app deployment', async () => {
  const readme = await readFile(new URL('README.md', rootUrl), 'utf8');
  assert.match(readme, /https:\/\/www\.tefsen\.com\/app\//);
  assert.match(readme, /GitHub Pages deployment is separate from Firebase backend deployment/);
  assert.doesNotMatch(readme, /recommended:\s*`app\.tefsen\.com`/i);
});

test('surface ownership document forbids duplicate authenticated trees', async () => {
  const doc = await readFile(new URL('docs/WEB_SURFACE_OWNERSHIP.md', rootUrl), 'utf8');
  assert.match(doc, /exactly one authenticated browser application implementation/i);
  assert.match(doc, /temporary patches/i);
  assert.match(doc, /must not be deployed over the existing Android\/backend production rules/i);
});
