// Contact channel for a recruiter who is convinced by the case page.
//
// Rule: no invented contact details. There is ONE value to fill,
// CONTACT in config/contact.js. While it is empty, the direct link stays
// hidden and the pages point at a Hebrew GitHub issue form instead.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const FORM = 'https://github.com/Swissystem7/SmartMount/issues/new?template=recruiter.yml';

// The owner decided on 28.9: the public contact channel for all his apps is his Google Form
// "משוב על האפליקציות", with the app field pre-filled as SmartMount (an exact option of the form).
const OWNER_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSdT8YduNx-VWKM3bWGUJdiSj4Sw9D-EA6R6c-oYVYCQmOVXxQ/viewform?usp=pp_url&entry.368039752=SmartMount';

test('config/contact.js holds one CONTACT value: the owner\'s Google Form', () => {
  const cfg = require('../config/contact');
  assert.equal(typeof cfg.CONTACT, 'string');
  assert.equal(cfg.CONTACT, OWNER_FORM);
  assert.equal(cfg.ISSUE_FORM, FORM);
  const src = read('config/contact.js');
  assert.doesNotMatch(src, /@[a-z0-9-]+\.[a-z]{2,}|0\d{1,2}-?\d{7}|\+972/i, 'no email or phone in the config');
});

test('resolveContact: empty or unsafe value falls back to the issue form', () => {
  const { resolveContact } = require('../src/lib/contact');
  for (const v of ['', '   ', undefined, null, 'javascript:alert(1)', 'data:text/html,x', 'http://x.example', 'ftp://x']) {
    const r = resolveContact(v, FORM);
    assert.equal(r.kind, 'issue', String(v));
    assert.equal(r.href, FORM);
  }
});

test('resolveContact: mailto, https and tel become a direct link with a Hebrew label', () => {
  const { resolveContact } = require('../src/lib/contact');
  assert.deepEqual(resolveContact('mailto:someone@example.com', FORM), {
    kind: 'direct', href: 'mailto:someone@example.com', label: 'מייל',
  });
  assert.equal(resolveContact('https://www.linkedin.com/in/someone', FORM).label, 'LinkedIn');
  assert.equal(resolveContact('https://example.com/cv.pdf', FORM).label, 'קורות חיים / פרופיל');
  assert.equal(resolveContact('tel:+10000000000', FORM).label, 'טלפון');
  assert.equal(resolveContact(' https://example.com/x ', FORM).href, 'https://example.com/x');
});

test('the Hebrew recruiter issue form warns it is public and asks for no phone or email', () => {
  const rel = '.github/ISSUE_TEMPLATE/recruiter.yml';
  assert.ok(fs.existsSync(path.join(root, rel)), 'missing ' + rel);
  const form = read(rel);
  assert.match(form, /^name: /m);
  assert.match(form, /^title: "פנייה/m);
  assert.match(form, /ציבורי/);
  assert.match(form, /אל תכתבו טלפון/);
  assert.match(form, /לא רצה על לוח|לא הועלתה ללוח/);
  assert.doesNotMatch(form, /id: (phone|email|tel)\b/);
});

test('case and landing carry the contact box: issue form in HTML, direct link hidden', () => {
  for (const rel of ['case/index.html', 'index.html']) {
    const html = read(rel);
    assert.match(html, /id="contactBox"/, rel);
    assert.match(html, /data-contact-direct[^>]*hidden|hidden[^>]*data-contact-direct/, rel);
    assert.ok(html.includes('issues/new?template=recruiter.yml'), rel + ' must link the Hebrew form');
    assert.match(html, /config\/contact\.js/, rel);
    assert.match(html, /src\/lib\/contact\.js/, rel);
    assert.match(html, /ציבורי/, rel);
    const plainNew = html.match(/issues\/new(?!\?template=recruiter\.yml)/g) || [];
    assert.equal(plainNew.length, 0, rel + ': every issue link must open the recruiter form');
  }
});

test('the shipped CONTACT renders as a direct "טופס Google" link and the GitHub form steps aside', () => {
  const cfg = require('../config/contact');
  const { resolveContact, render } = require('../src/lib/contact');
  assert.deepEqual(resolveContact(cfg.CONTACT, cfg.ISSUE_FORM), { kind: 'direct', href: OWNER_FORM, label: 'טופס Google' });
  const direct = { hidden: true, href: '', textContent: '', removeAttribute() {} };
  const issue = { hidden: false };
  const box = { querySelector: (sel) => (sel === '[data-contact-direct]' ? direct : sel === '[data-contact-issue]' ? issue : null) };
  render({ getElementById: (id) => (id === 'contactBox' ? box : null) }, cfg);
  assert.equal(direct.hidden, false);
  assert.equal(direct.href, OWNER_FORM);
  assert.equal(direct.textContent, 'יצירת קשר: טופס Google');
  assert.equal(issue.hidden, true);
});
