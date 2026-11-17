const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');

test('tools/codecov uploadReport covers non-success upload branches', async () => {
  const codecov = require('../tools/codecov.js');
  const env = { CODECOV_TOKEN: 'token-123' };

  const postFail = await codecov.uploadReport('lcov-data', env, async () => ({ ok: false, status: 503 }));
  assert.deepEqual(postFail, { ok: true, uploaded: false, reason: 'codecov-503' });

  let calls = 0;
  const noUrl = await codecov.uploadReport('lcov-data', env, async () => {
    calls += 1;
    if (calls === 1) return { ok: true, text: async () => 'upload created but no URL line' };
    throw new Error('PUT should not run when upload URL is missing');
  });
  assert.deepEqual(noUrl, { ok: true, uploaded: false, reason: 'no-upload-url' });
});

test('scripts/smoke findChromiumExecutable discovers default and cache paths', () => {
  const smoke = require('../scripts/smoke.js');
  const realExistsSync = fs.existsSync;
  const realReaddirSync = fs.readdirSync;
  const realHome = process.env.HOME;

  try {
    fs.existsSync = (p) => p === '/tmp/chrome' || p === '/tmp/home/.cache/ms-playwright' ||
      p === '/tmp/home/.cache/ms-playwright/chromium-123/chrome-linux/chrome';
    fs.readdirSync = (p) => (p === '/tmp/home/.cache/ms-playwright' ? ['chromium-123'] : []);
    process.env.HOME = '/tmp/home';

    const fromDefault = smoke.findChromiumExecutable({
      chromium: { executablePath: () => '/tmp/chrome' },
    });
    assert.equal(fromDefault, '/tmp/chrome');

    const fromCache = smoke.findChromiumExecutable({
      chromium: { executablePath: () => { throw new Error('no bundled binary'); } },
    });
    assert.equal(fromCache, '/tmp/home/.cache/ms-playwright/chromium-123/chrome-linux/chrome');
  } finally {
    fs.existsSync = realExistsSync;
    fs.readdirSync = realReaddirSync;
    process.env.HOME = realHome;
  }
});

test('scripts/pr-size main returns expected status codes', () => {
  const { main } = require('../scripts/pr-size.js');
  const realLog = console.log;
  const realErr = console.error;
  const logs = [];
  const errs = [];
  console.log = (s) => logs.push(String(s));
  console.error = (s) => errs.push(String(s));

  try {
    assert.equal(main(['HEAD...HEAD', '--json']), 0);
    assert.ok(logs.length >= 1);
    const plan = JSON.parse(logs[0]);
    assert.equal(plan.total, 0);
    assert.equal(plan.fits, true);

    assert.equal(main(['--budget', '0']), 2);
    assert.match(errs[0], /--budget needs a positive integer/);
  } finally {
    console.log = realLog;
    console.error = realErr;
  }
});

test('scripts/sync-control-params regenerates known targets', () => {
  const run = spawnSync(process.execPath, ['scripts/sync-control-params.js'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /synced control-params/);

  const generatedJs = fs.readFileSync(path.join(root, 'src/lib/control-params.js'), 'utf8');
  assert.match(generatedJs, /samplePeriodMs:/);
  assert.match(generatedJs, /Object\.freeze/);

  const firmware = fs.readFileSync(path.join(root, 'firmware/smart_mount.ino'), 'utf8');
  assert.match(
    firmware,
    /\/\/ >>> BEGIN GENERATED control-params[\s\S]*\/\/ <<< END GENERATED control-params/,
  );
});

test('src/lib/sentryLoader exports to browser global and safely auto-inits', () => {
  const code = fs.readFileSync(path.join(root, 'src/lib/sentryLoader.js'), 'utf8');
  const context = {
    document: {
      querySelector: () => { throw new Error('meta probe failed'); },
    },
  };
  vm.createContext(context);
  vm.runInContext(code, context, { filename: 'sentryLoader.js' });
  assert.equal(typeof context.SM_SENTRY, 'object');
  assert.equal(typeof context.SM_SENTRY.initSentry, 'function');
});
