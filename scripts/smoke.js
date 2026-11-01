// SmartMount — Headless Playwright Smoke Test (390px viewport, Refs #67)
// Opens index.html (and suite pages) at mobile 390px, validates Hebrew RTL and asserts no console errors or horizontal overflow.
// Runs headless without network dependency.

const path = require('path');
const fs = require('fs');

function resolvePlaywright() {
  try {
    return require('playwright');
  } catch (e) {
    const cacheDirs = [
      path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'),
      path.join(process.env.HOME || '', '.npm', '_npx')
    ];
    for (const base of cacheDirs) {
      if (fs.existsSync(base)) {
        for (const sub of fs.readdirSync(base)) {
          const cand = path.join(base, sub, 'node_modules', 'playwright');
          if (fs.existsSync(cand)) {
            try { return require(cand); } catch (_) {}
          }
        }
      }
    }
  }
  return null;
}

function findChromiumExecutable(pw) {
  if (pw && pw.chromium) {
    try {
      const def = pw.chromium.executablePath();
      if (fs.existsSync(def)) return def;
    } catch (_) {}
  }

  const bases = [
    'D:\\Cache\\ms-playwright',
    path.join(process.env.LOCALAPPDATA || '', 'ms-playwright'),
    path.join(process.env.HOME || '', '.cache', 'ms-playwright')
  ];

  for (const b of bases) {
    if (fs.existsSync(b)) {
      for (const entry of fs.readdirSync(b)) {
        if (/^chromium-\d+/i.test(entry)) {
          const cand = path.join(b, entry, 'chrome-win64', 'chrome.exe');
          if (fs.existsSync(cand)) return cand;
          const candLinux = path.join(b, entry, 'chrome-linux', 'chrome');
          if (fs.existsSync(candLinux)) return candLinux;
        }
      }
    }
  }
  return null;
}

async function runSmokeTest() {
  const pw = resolvePlaywright();
  if (!pw || !pw.chromium) {
    console.log('Playwright is not available — skipping live browser smoke.');
    return { ok: true, skipped: true };
  }

  const execPath = findChromiumExecutable(pw);
  const launchOpts = { headless: true };
  if (execPath) {
    launchOpts.executablePath = execPath;
  }

  let browser;
  try {
    browser = await pw.chromium.launch(launchOpts);
  } catch (err) {
    console.log('Playwright browser launch unavailable (' + err.message + ') — skipping live smoke.');
    return { ok: true, skipped: true };
  }

  const rootDir = path.resolve(__dirname, '..');
  const pagesToTest = ['', 'case/', 'lab/', 'spec/'];
  const failures = [];

  for (const pageRel of pagesToTest) {
    const pageUrl = 'file:///' + path.join(rootDir, pageRel, 'index.html').replace(/\\/g, '/');
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }
    });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    await page.goto(pageUrl, { waitUntil: 'load' });

    const layout = await page.evaluate(() => {
      return {
        dir: document.documentElement.getAttribute('dir'),
        lang: document.documentElement.getAttribute('lang'),
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth
      };
    });

    if (consoleErrors.length > 0) {
      failures.push({ page: pageRel || 'root', reason: 'Console errors: ' + consoleErrors.join('; ') });
    }
    if (pageErrors.length > 0) {
      failures.push({ page: pageRel || 'root', reason: 'Page errors: ' + pageErrors.join('; ') });
    }
    if (layout.dir !== 'rtl') {
      failures.push({ page: pageRel || 'root', reason: 'Expected dir="rtl", got ' + layout.dir });
    }
    if (layout.lang !== 'he') {
      failures.push({ page: pageRel || 'root', reason: 'Expected lang="he", got ' + layout.lang });
    }
    if (layout.scrollW > layout.clientW + 2) {
      failures.push({
        page: pageRel || 'root',
        reason: `Horizontal overflow: scrollWidth=${layout.scrollW} > clientWidth=${layout.clientW}`
      });
    }

    await context.close();
  }

  await browser.close();

  if (failures.length > 0) {
    console.error('Smoke test failures:', failures);
    if (require.main === module) process.exit(1);
    throw new Error('Smoke test failed: ' + JSON.stringify(failures));
  } else {
    console.log('Smoke test passed at 390px: 0 console errors, valid RTL, 0 horizontal overflow across ' + pagesToTest.length + ' pages.');
    return { ok: true, testedCount: pagesToTest.length };
  }
}

if (require.main === module) {
  runSmokeTest().catch(err => {
    console.error('Smoke test execution error:', err);
    process.exit(1);
  });
}

module.exports = { resolvePlaywright, findChromiumExecutable, runSmokeTest };
