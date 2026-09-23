import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../../app/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../../app/js/app.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../../app/css/app.css', import.meta.url), 'utf8');
const sw = await readFile(new URL('../../app/sw.js', import.meta.url), 'utf8');

test('document provides keyboard skip navigation without making the whole app a live region',()=>{
  assert.match(index,/class="skip-link" href="#app-main"/);
  assert.match(index,/<div id="app-root"><\/div>/);
  assert.doesNotMatch(index,/id="app-root"[^>]*aria-live/);
  assert.match(index,/id="toast-root"[^>]*aria-live="polite"/);
});

test('all major app shells expose a stable focusable main target',()=>{
  assert.match(app,/loadingScreen[\s\S]*<main id="app-main" tabindex="-1"/);
  assert.match(app,/renderAuth[\s\S]*<main id="app-main" class="auth-page" tabindex="-1"/);
  assert.match(app,/renderShell[\s\S]*<main id="app-main" class="main-area" tabindex="-1"/);
});

test('skip link is visually hidden until keyboard focus',()=>{
  assert.match(css,/\.skip-link \{/);
  assert.match(css,/transform: translateY\(-160%\)/);
  assert.match(css,/\.skip-link:focus/);
  assert.match(css,/transform: translateY\(0\)/);
});

test('dialog lifecycle normalizes semantics and close-button labels',()=>{
  assert.match(app,/function normalizeDialogAccessibility/);
  assert.match(app,/setAttribute\('role','dialog'\)/);
  assert.match(app,/setAttribute\('aria-modal','true'\)/);
  assert.match(app,/setAttribute\('aria-labelledby', heading\.id\)/);
  assert.match(app,/setAttribute\('aria-label','Close dialog'\)/);
  assert.match(app,/setAttribute\('tabindex','-1'\)/);
});

test('dialog lifecycle makes background inert and restores opener focus',()=>{
  assert.match(app,/root\.inert = true/);
  assert.match(app,/root\.inert = false/);
  assert.match(app,/skipLink\.inert = true/);
  assert.match(app,/skipLink\.inert = false/);
  assert.match(app,/modalReturnFocus = document\.activeElement/);
  assert.match(app,/returnTarget\.isConnected/);
  assert.match(app,/returnTarget\.focus/);
});

test('dialog keyboard handler traps Tab and handles Escape before global shortcuts',()=>{
  assert.match(app,/function trapModalKeyboard/);
  assert.match(app,/event\.key === 'Escape'/);
  assert.match(app,/event\.key !== 'Tab'/);
  assert.match(app,/event\.shiftKey/);
  assert.match(app,/last\.focus\(\)/);
  assert.match(app,/first\.focus\(\)/);
  assert.match(app,/if \(trapModalKeyboard\(event\)\) return/);
});

test('modal activation is centralized through modal-root observation',()=>{
  assert.match(app,/new MutationObserver/);
  assert.match(app,/modalAccessibilityObserver\.observe\(modalRoot,\{ childList:true \}\)/);
  assert.doesNotMatch(app,/modalAccessibilityObserver\.observe\(modalRoot,\{[^}]*subtree:true/);
});

test('rendered form fields receive programmatic label associations and announce errors',()=>{
  assert.match(app,/function normalizeRenderedAccessibility/);
  assert.match(app,/field\.querySelector\('label'\)/);
  assert.match(app,/label\.setAttribute\('for', control\.id\)/);
  assert.match(app,/\.form-error, \.field-error/);
  assert.match(app,/setAttribute\('aria-live','polite'\)/);
  assert.match(app,/normalizeRenderedAccessibility\(root\)/);
  assert.match(app,/normalizeRenderedAccessibility\(dialog\)/);
});

test('active navigation and global search shortcut expose assistive semantics',()=>{
  assert.match(app,/aria-current="page"/);
  assert.match(app,/aria-keyshortcuts="Control\+K Meta\+K"/);
  assert.match(app,/Ctrl\/⌘ K/);
  assert.match(app,/aria-label="Account and saved navigation"/);
});

test('PWA shell remains versioned after later completion steps',()=>{
  assert.match(sw,/tefsen-web-shell-v\d+/);
});
