#!/usr/bin/env node
/**
 * Headless 390px smoke test for the landing page.
 *
 * Serves the repo over loopback (no network, no CDN) and opens it in Chromium at
 * the narrowest phone width we claim to support. Fails on console errors, page
 * errors, failed requests, horizontal overflow, clipped RTL text, or tap targets
 * below 44px. Run with `npm run smoke`.
 *
 * Kept out of `test/` on purpose: `npm test` is `node --test` and must stay
 * dependency-free and offline. This script is the only thing that needs Chromium.
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const VIEWPORT = { width: 390, height: 844 };
const DESKTOP = { width: 1200, height: 900 };
const MIN_TAP_PX = 44;
// Defaults to the landing page, which is what CI gates on. Any other page can be
// passed as an argument for a one-off look: `npm run smoke -- /lab/`.
const PAGE = process.argv[2] || '/';
const IS_LANDING = PAGE === '/' || PAGE === '/index.html';

const LANDMARKS = ['main#main', 'h1', 'nav.site-nav'].concat(
  IS_LANDING ? ['a.btn.primary', '#panelLimitsText'] : []
);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/**
 * Runs inside the page. Measures layout against the viewport and reports every
 * box that escapes it plus every control too small to hit with a thumb.
 */
function audit({ minTap, landmarks }) {
  const vw = window.innerWidth;
  const out = {
    docWidth: document.documentElement.scrollWidth,
    viewport: vw,
    dir: getComputedStyle(document.documentElement).direction,
    overflow: [],
    tiny: [],
    missing: [],
    navLinks: document.querySelectorAll('nav.site-nav a').length,
    panels: '',
  };

  const describe = (el) =>
    `<${el.tagName.toLowerCase()}${el.className ? ` class="${el.className}"` : ''}>`;
  // A closed <details> reports unreliable geometry for its hidden children, so
  // measure them only in the pass where the drawer is open.
  const laidOut = (el) => {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const hidden = el.closest('details:not([open])');
    const summary = hidden && hidden.querySelector(':scope > summary');
    if (hidden && el !== hidden && !(summary && summary.contains(el))) return false;
    const r = el.getBoundingClientRect();
    return r.width !== 0 || r.height !== 0;
  };

  for (const el of document.querySelectorAll('body *')) {
    if (!laidOut(el)) continue;
    // The skip-link parks itself off-canvas until focused; everything else that
    // leaves the viewport is unreadable, popovers included.
    if (el.classList.contains('skip-link') || el.classList.contains('sr-only')) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) {
      out.overflow.push({
        el: describe(el),
        left: Math.round(r.left),
        right: Math.round(r.right),
        text: (el.textContent || '').trim().slice(0, 40),
      });
    }
  }

  for (const el of document.querySelectorAll('a[href], button, summary')) {
    if (el.classList.contains('skip-link') || !laidOut(el)) continue;
    // Links inside a paragraph of running text are read, not aimed at.
    if (el.closest('p') && !el.classList.contains('btn')) continue;
    const h = el.getBoundingClientRect().height;
    if (h < minTap) {
      out.tiny.push({
        text: (el.textContent || '').trim().slice(0, 30),
        height: Math.round(h),
        where: el.parentElement ? describe(el.parentElement) : '?',
      });
    }
  }

  // Landmarks the page is worthless without.
  for (const sel of landmarks) {
    if (!document.querySelector(sel)) out.missing.push(sel);
  }
  const panels = document.getElementById('panelLimitsText');
  out.panels = panels ? panels.textContent.trim() : '';
  return out;
}

function collect(failures, report, phase, width, { tapTargets = true } = {}) {
  if (report.docWidth > width + 1) {
    failures.push(`[${phase}] page scrolls sideways: scrollWidth ${report.docWidth}px > ${width}px`);
  }
  for (const o of report.overflow) {
    failures.push(`[${phase}] escapes viewport: ${o.el} left=${o.left} right=${o.right} "${o.text}"`);
  }
  if (!tapTargets) return;
  for (const t of report.tiny) {
    failures.push(`[${phase}] tap target ${t.height}px < ${MIN_TAP_PX}px: "${t.text}" in ${t.where}`);
  }
}

/** Opens the "עוד" nav drawer and waits for it to actually be open. */
async function openDrawer(page) {
  const summary = page.locator('details.nav-more > summary');
  if (!(await summary.count())) return false;
  await summary.first().click();
  await page.waitForFunction(() => document.querySelector('details.nav-more[open]') !== null);
  return true;
}

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let rel = url.endsWith('/') ? url + 'index.html' : url;
    const file = path.join(ROOT, rel);
    // Never serve outside the repo, even if the page asks for ../../etc/passwd.
    if (!file.startsWith(ROOT + path.sep)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    fs.readFile(file, (err, body) => {
      if (err) {
        res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(body);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    console.error('playwright is missing — run `npm install` first.');
    process.exit(1);
  }

  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const failures = [];

  /** Loads PAGE at one width and returns a page wired to report console noise. */
  async function visit(width, height) {
    const context = await browser.newContext({ viewport: { width, height }, locale: 'he-IL' });
    // A static portfolio page must not reach the network. Anything that tries is a bug.
    await context.route('**', (route) => {
      const url = route.request().url();
      if (url.startsWith(base)) return route.continue();
      failures.push(`off-site request: ${url}`);
      return route.abort();
    });

    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        failures.push(`console.${msg.type()}: ${msg.text()}`);
      }
    });
    page.on('pageerror', (err) => failures.push(`pageerror: ${err.message}`));
    page.on('requestfailed', (req) => {
      failures.push(`request failed: ${req.url()} (${req.failure() && req.failure().errorText})`);
    });

    const response = await page.goto(base + PAGE, { waitUntil: 'load' });
    if (!response || !response.ok()) {
      failures.push(`${PAGE} returned ${response ? response.status() : 'no response'}`);
    }
    return page;
  }

  try {
    const page = await visit(VIEWPORT.width, VIEWPORT.height);

    const closed = await page.evaluate(audit, { minTap: MIN_TAP_PX, landmarks: LANDMARKS });
    collect(failures, closed, `${VIEWPORT.width}px nav closed`, VIEWPORT.width);

    if (closed.dir !== 'rtl') failures.push(`expected dir=rtl, got ${closed.dir}`);
    for (const m of closed.missing) failures.push(`missing element: ${m}`);
    // Proves control-params.js actually executed rather than silently 404ing.
    if (IS_LANDING && !/\d+°/.test(closed.panels)) {
      failures.push(`panel limits never rendered from control-params.js (got "${closed.panels}")`);
    }

    // The "עוד" drawer is the only way to reach most pages on a phone, so audit it
    // open too — a closed <details> hides its children from layout.
    let open = null;
    if (await openDrawer(page)) {
      open = await page.evaluate(audit, { minTap: MIN_TAP_PX, landmarks: LANDMARKS });
      collect(failures, open, `${VIEWPORT.width}px nav open`, VIEWPORT.width);
    } else {
      failures.push('no details.nav-more drawer on the page');
    }

    // Above 560px the same drawer becomes an absolutely positioned popover, which
    // is where RTL anchoring goes wrong. Tap-target sizing is a touch concern, so
    // only the geometry is checked here.
    const wide = await visit(DESKTOP.width, DESKTOP.height);
    if (await openDrawer(wide)) {
      const popover = await wide.evaluate(audit, { minTap: MIN_TAP_PX, landmarks: LANDMARKS });
      collect(failures, popover, `${DESKTOP.width}px nav open`, DESKTOP.width, { tapTargets: false });
    }

    console.log(`viewport ${VIEWPORT.width}x${VIEWPORT.height}  scrollWidth ${closed.docWidth}px  dir ${closed.dir}`);
    console.log(`nav: ${closed.navLinks} links, drawer opens to ${open ? open.docWidth : '?'}px wide`);
    console.log(`panel limits: ${closed.panels}`);
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.error(`\n${failures.length} smoke failure(s) on ${PAGE}:`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`\nsmoke OK — ${PAGE} at ${VIEWPORT.width}px: no console errors, no overflow.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
