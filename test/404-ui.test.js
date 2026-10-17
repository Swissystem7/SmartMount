const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html404 = fs.readFileSync(path.join(root, '404.html'), 'utf8');

test('404.html has valid document shell with Hebrew RTL and robots noindex', () => {
  assert.match(html404, /<!DOCTYPE html>/i);
  assert.match(html404, /<html\s+lang="he"\s+dir="rtl">/);
  assert.match(html404, /<meta\s+charset="UTF-8">/i);
  assert.match(html404, /<meta\s+name="viewport"\s+content="[^"]*width=device-width/);
  assert.match(html404, /<meta\s+name="robots"\s+content="noindex">/);
  assert.match(html404, /<link\s+rel="icon"\s+href="\.\/assets\/favicon\.svg"/);
  assert.match(html404, /<link\s+rel="stylesheet"\s+href="\.\/assets\/site\.css">/);
  assert.match(html404, /<title>SmartMount — העמוד לא נמצא<\/title>/);
});

test('404.html provides accessible skip link targeting #main', () => {
  assert.match(html404, /<a\s+class="skip-link"\s+href="#main">דלג לתוכן<\/a>/);
  assert.match(html404, /<main\s+id="main"\s+tabindex="-1"/);
});

test('404.html site navigation is synchronized with full engineering suite', () => {
  const navMatch = html404.match(/<nav class="site-nav"[\s\S]*?<\/nav>/);
  assert.ok(navMatch, 'missing <nav class="site-nav">');
  const nav = navMatch[0];

  assert.match(nav, /<a\s+class="brand"\s+href="\.\/">SmartMount<\/a>/);
  assert.match(nav, /<a\s+href="\.\/">בית<\/a>/);
  assert.match(nav, /<a\s+href="\.\/case\/">מקרה הנדסי<\/a>/);
  assert.match(nav, /<a\s+href="\.\/lab\/">מעבדה<\/a>/);
  assert.match(nav, /<a\s+class="nav-mid"\s+href="\.\/spec\/">מפרט<\/a>/);

  assert.match(nav, /<details\s+class="nav-more">/);
  assert.match(nav, /<summary>עוד<\/summary>/);

  const moreListMatch = nav.match(/<div class="nav-more-list">([\s\S]*?)<\/div>/);
  assert.ok(moreListMatch, 'missing nav-more-list');
  const moreList = moreListMatch[1];

  assert.match(moreList, /href="\.\/spec\/"/);
  assert.match(moreList, /href="\.\/geometry\/"/);
  assert.match(moreList, /href="\.\/protocol\/"/);
  assert.match(moreList, /href="\.\/fsm\/"/);
  assert.match(moreList, /href="\.\/runtime\/"/);
  assert.match(moreList, /href="\.\/hil\/"/);

  // Lab was previously duplicated in nav-more-list
  const labOccurrences = (moreList.match(/href="\.\/lab\/"/g) || []).length;
  assert.equal(labOccurrences, 0, 'lab must not be duplicated inside nav-more-list');

  // Cut pages must stay out of nav
  assert.doesNotMatch(nav, /href="\.\/power\/"/);
  assert.doesNotMatch(nav, /href="\.\/alts\/"/);
  assert.doesNotMatch(nav, /href="\.\/dashboard\/"/);
});

test('404.html displays honesty banner and error badge', () => {
  assert.match(html404, /<div class="banner"[^>]*>שגיאה 404/);
  assert.match(html404, /תיק הנדסי/);
  assert.match(html404, /<span class="badge">שגיאה 404<\/span>/);
  assert.match(html404, /<h1>העמוד הזה לא קיים<\/h1>/);
});

test('404.html includes styled call-to-action buttons for quick recovery', () => {
  const ctaMatch = html404.match(/<div class="cta">([\s\S]*?)<\/div>/);
  assert.ok(ctaMatch, 'missing .cta container');
  const cta = ctaMatch[1];

  assert.match(cta, /<a class="btn primary"\s+href="\.\/">חזרה לבית<\/a>/);
  assert.match(cta, /<a class="btn ghost"\s+href="\.\/case\/">מקרה הנדסי/);
  assert.match(cta, /<a class="btn ghost"\s+href="\.\/lab\/">מעבדה/);
});

test('404.html provides directory cards linking to all engineering tools', () => {
  const linksMatch = html404.match(/<div class="links-card">([\s\S]*?)<\/div>\s*<\/div>/);
  assert.ok(linksMatch, 'missing .links-card container');
  const links = linksMatch[1];

  assert.match(links, /<h2>דפי התיק ההנדסי<\/h2>/);
  assert.match(links, /href="\.\/spec\/"/);
  assert.match(links, /href="\.\/geometry\/"/);
  assert.match(links, /href="\.\/protocol\/"/);
  assert.match(links, /href="\.\/fsm\/"/);
  assert.match(links, /href="\.\/runtime\/"/);
  assert.match(links, /href="\.\/hil\/"/);
});
