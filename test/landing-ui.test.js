const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function fakeElement(id, initial = {}) {
  const listeners = {};
  const attrs = { ...initial.attrs };
  const classes = new Set(initial.classes || []);
  let text = initial.text || '';
  let inner = initial.innerHTML || '';
  return {
    id,
    value: initial.value || '',
    attrs,
    dataset: initial.dataset || {},
    style: {},
    children: [],
    get hidden() { return attrs.hidden !== undefined && attrs.hidden !== 'false'; },
    set hidden(v) {
      if (v) attrs.hidden = 'true';
      else delete attrs.hidden;
    },
    get href() { return attrs.href; },
    set href(v) {
      if (v) attrs.href = String(v);
      else delete attrs.href;
    },
    get textContent() { return text; },
    set textContent(v) { text = String(v); },
    get innerHTML() { return inner; },
    set innerHTML(v) { inner = String(v); },
    get className() { return [...classes].join(' '); },
    set className(v) {
      classes.clear();
      if (v) v.trim().split(/\s+/).forEach((c) => classes.add(c));
    },
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      toggle: (c, force) => {
        if (force === undefined) {
          if (classes.has(c)) classes.delete(c);
          else classes.add(c);
        } else if (force) classes.add(c);
        else classes.delete(c);
      },
      contains: (c) => classes.has(c),
    },
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return attrs[k] !== undefined ? attrs[k] : null; },
    removeAttribute(k) { delete attrs[k]; },
    addEventListener(type, fn) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    fire(type) {
      (listeners[type] || []).forEach((fn) => fn());
    },
    querySelector(sel) {
      if (sel === '[data-contact-direct]') return this.children.find((c) => c.attrs && c.attrs['data-contact-direct'] !== undefined);
      if (sel === '[data-contact-issue]') return this.children.find((c) => c.attrs && c.attrs['data-contact-issue'] !== undefined);
      return null;
    },
  };
}

test('landing page HTML defines accessible landmarks, CTA buttons, and single primary button', () => {
  const html = read('index.html');

  // Landmarks & Accessibility
  assert.match(html, /<a class="skip-link" href="#main">דלג לתוכן<\/a>/);
  assert.match(html, /<main id="main" class="wrap" tabindex="-1">/);
  assert.match(html, /<nav class="site-nav"[^>]*aria-label="ניווט ראשי">/);
  assert.match(html, /<span id="panelLimitsText"[^>]*aria-label="מגבלות זווית לפי סוג פאנל"/);

  // CTAs
  assert.match(html, /<div class="cta">/);
  assert.match(html, /<a class="btn primary" href="\.\/case\/">מקרה הנדסי — 90 שניות למגייסים<\/a>/);
  assert.match(html, /<a class="btn ghost" href="\.\/lab\/">מעבדה: הזרקת תקלות<\/a>/);
  assert.match(html, /<a class="btn ghost" href="https:\/\/github\.com\/Swissystem7\/SmartMount"[^>]*target="_blank"[^>]*rel="noopener noreferrer">קוד ב-GitHub<\/a>/);

  // Exactly one primary button on the entire landing page
  const primaryButtons = (html.match(/class="btn primary"/g) || []).length;
  assert.equal(primaryButtons, 1, 'landing page must have exactly 1 primary CTA button');
});

test('landing page CSS provides high-contrast button hover, focus-visible outline, and direct contact styles', () => {
  const html = read('index.html');

  // Primary button hover contrast preservation
  assert.match(html, /a\.btn\.primary:hover\{color:#fff;filter:brightness\(1\.12\)\}/);

  // Ghost button hover style
  assert.match(html, /a\.btn\.ghost:hover\{background:rgba\(255,255,255,\.08\);color:#fff;border-color:var\(--accent\)\}/);

  // Keyboard accessibility
  assert.match(html, /a\.btn:focus-visible\{outline:2px solid var\(--accent\);outline-offset:3px\}/);

  // Direct contact action styling
  assert.match(html, /\.contact a\[data-contact-direct\]\{display:inline-flex/);
  assert.match(html, /\.contact a\[data-contact-direct\]:hover\{border-color:var\(--accent\);color:#fff/);
  assert.match(html, /\.contact a\[data-contact-direct\]:focus-visible\{outline:2px solid var\(--accent\)/);

  // Facts hover polish
  assert.match(html, /\.facts div:hover\{border-color:rgba\(255,255,255,\.18\);background:#131326\}/);
});

test('landing page script dynamically populates panel limits from CONTROL_PARAMS', () => {
  const panelLimitsEl = fakeElement('panelLimitsText', { text: 'OLED · QLED · LED' });
  const fakeDoc = {
    getElementById: (id) => (id === 'panelLimitsText' ? panelLimitsEl : null),
  };

  const html = read('index.html');
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  assert.ok(scriptMatch, 'missing inline script block in index.html');
  const inlineScript = scriptMatch[1];

  const controlParamsCode = read('src/lib/control-params.js');
  const sandbox = {
    document: fakeDoc,
    console,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(controlParamsCode, sandbox);
  vm.runInContext(inlineScript, sandbox);

  // Asserts panel limits were correctly populated with actual limits from control-params
  assert.equal(panelLimitsEl.textContent, 'OLED 40°, QLED 30°, LED 20°');
});

test('landing page contact box correctly reveals direct link or recruiter fallback', () => {
  const { resolveContact, render } = require('../src/lib/contact');
  const directLink = fakeElement('direct', { attrs: { 'data-contact-direct': '', hidden: 'true' } });
  const issueLink = fakeElement('issue', { attrs: { 'data-contact-issue': '' } });

  const contactBox = fakeElement('contactBox');
  contactBox.children = [directLink, issueLink];

  const fakeDoc = {
    getElementById: (id) => (id === 'contactBox' ? contactBox : null),
  };

  // Case 1: Active Google Form in config
  const ownerForm = 'https://docs.google.com/forms/d/e/1FAIpQLSdT8YduNx-VWKM3bWGUJdiSj4Sw9D-EA6R6c-oYVYCQmOVXxQ/viewform?usp=pp_url&entry.368039752=SmartMount';
  const cfgActive = {
    CONTACT: ownerForm,
    ISSUE_FORM: 'https://github.com/Swissystem7/SmartMount/issues/new?template=recruiter.yml',
  };

  render(fakeDoc, cfgActive);
  assert.equal(directLink.hidden, false, 'data-contact-direct must be unhidden when direct contact exists');
  assert.equal(directLink.href, ownerForm);
  assert.equal(directLink.textContent, 'יצירת קשר: טופס Google');
  assert.equal(issueLink.hidden, true, 'data-contact-issue must be hidden when direct contact exists');

  // Case 2: Empty contact configuration (fallback)
  const cfgFallback = {
    CONTACT: '',
    ISSUE_FORM: 'https://github.com/Swissystem7/SmartMount/issues/new?template=recruiter.yml',
  };
  render(fakeDoc, cfgFallback);
  assert.equal(directLink.hidden, true, 'data-contact-direct must be hidden when CONTACT is empty');
  assert.equal(directLink.href, undefined, 'href should be removed on fallback');
});
