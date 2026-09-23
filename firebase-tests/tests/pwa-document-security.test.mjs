import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../../app/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../../app/sw.js', import.meta.url), 'utf8');

function block(startNeedle,endNeedle){
  const start=sw.indexOf(startNeedle);
  const end=sw.indexOf(endNeedle,start);
  assert.ok(start>=0 && end>start,`Missing block: ${startNeedle}`);
  return sw.slice(start,end);
}

test('document defines a restrictive CSP for the actual Firebase dependency set',()=>{
  assert.match(index,/http-equiv="Content-Security-Policy"/);
  assert.match(index,/default-src 'self'/);
  assert.match(index,/base-uri 'self'/);
  assert.match(index,/object-src 'none'/);
  assert.match(index,/script-src 'self' https:\/\/www\.gstatic\.com https:\/\/apis\.google\.com https:\/\/www\.google\.com https:\/\/www\.recaptcha\.net/);
  assert.match(index,/connect-src 'self' https:\/\/\*\.googleapis\.com/);
  assert.match(index,/https:\/\/\*\.firebaseapp\.com/);
  assert.match(index,/wss:\/\/\*\.firebaseio\.com/);
  assert.match(index,/frame-src 'self'/);
  assert.match(index,/worker-src 'self' blob:/);
  assert.match(index,/manifest-src 'self'/);
  assert.match(index,/form-action 'self'/);
  assert.match(index,/upgrade-insecure-requests/);
  const csp=index.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] || '';
  const scriptDirective=csp.split(';').map(part=>part.trim()).find(part=>part.startsWith('script-src')) || '';
  assert.doesNotMatch(scriptDirective,/'unsafe-inline'/);
  assert.doesNotMatch(scriptDirective,/'unsafe-eval'/);
});

test('strict referrer policy remains present beside CSP',()=>{
  assert.match(index,/meta name="referrer" content="strict-origin-when-cross-origin"/);
});

test('Firebase runtime config is excluded from the offline shell',()=>{
  const shell=block('const SHELL = [','];');
  assert.doesNotMatch(shell,/firebase-config\.js/);
  assert.match(sw,/isFirebaseRuntimeConfig/);
  assert.match(sw,/fetch\(request, \{ cache:'no-store' \}\)/);
});

test('runtime config is handled before navigation/static caching',()=>{
  const fetchBlock=sw.slice(sw.indexOf("self.addEventListener('fetch'"));
  const configIndex=fetchBlock.indexOf('isFirebaseRuntimeConfig(url)');
  const navigationIndex=fetchBlock.indexOf('isNavigationRequest(request)');
  const staticIndex=fetchBlock.indexOf('staticAssetResponse(request)');
  assert.ok(configIndex>=0 && navigationIndex>configIndex && staticIndex>navigationIndex);
});

test('HTML fallback is limited to navigation requests',()=>{
  const navigation=block('async function navigationResponse','async function staticAssetResponse');
  const staticAssets=block('async function staticAssetResponse',"self.addEventListener('install'");
  assert.match(navigation,/caches\.match\('\.\/index\.html'\)/);
  assert.doesNotMatch(staticAssets,/index\.html/);
  assert.match(staticAssets,/caches\.match\(request\)/);
  assert.doesNotMatch(sw,/hit \|\| caches\.match\('\.\/index\.html'\)/);
});

test('static asset cache stores only successful same-origin basic responses',()=>{
  const staticAssets=block('async function staticAssetResponse',"self.addEventListener('install'");
  assert.match(staticAssets,/response\.ok/);
  assert.match(staticAssets,/response\.type === 'basic'/);
  assert.match(staticAssets,/cache\.put\(request, response\.clone\(\)\)/);
});

test('offline shell explicitly includes direct and transitive startup modules',()=>{
  const shell=block('const SHELL = [','];');
  for(const path of [
    './js/app.js',
    './js/firebase-client.js',
    './js/services/auth-service.js',
    './js/services/account-bootstrap-service.js',
    './js/services/data-service.js',
    './js/services/demo-data.js',
    './js/services/opportunity-demo-data.js'
  ]){
    assert.ok(shell.includes(path),`offline shell missing ${path}`);
  }
});

test('PWA shell remains versioned after later completion steps',()=>{
  assert.match(sw,/tefsen-web-shell-v\d+/);
});
