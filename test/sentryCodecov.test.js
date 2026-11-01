const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const sentry = require('../src/lib/sentryLoader');
const codecov = require('../tools/codecov');

function fakeDoc(metaDsn) {
  const scripts = [];
  const head = {
    appendChild: (el) => scripts.push(el),
  };
  return {
    scripts,
    head,
    documentElement: head,
    createElement: (tag) => ({ tag }),
    querySelector: (sel) => {
      if (sel === 'meta[name="sentry-dsn"]' && metaDsn !== undefined) {
        return { getAttribute: (attr) => (attr === 'content' ? metaDsn : null) };
      }
      return null;
    },
  };
}

test('sentry loader stays off without a valid DSN', () => {
  assert.equal(sentry.dsnOf(null), '');
  assert.equal(sentry.dsnOf(fakeDoc()), '');
  assert.equal(sentry.dsnOf(fakeDoc('')), '');
  assert.equal(sentry.dsnOf(fakeDoc(sentry.PLACEHOLDER)), '');
  assert.equal(sentry.dsnOf(fakeDoc('not-a-sentry-dsn')), '');

  const doc = fakeDoc(sentry.PLACEHOLDER);
  assert.deepEqual(sentry.initSentry(doc), { enabled: false });
  assert.equal(doc.scripts.length, 0);
});

test('sentry loader loads SDK and disables PII with a valid DSN', () => {
  const testDsn = 'https://key@o12345.ingest.sentry.io/987654';
  const doc = fakeDoc(testDsn);
  assert.equal(sentry.dsnOf(doc), testDsn);

  const seenOpts = [];
  const fakeGlobal = {
    Sentry: {
      init: (opts) => seenOpts.push(opts),
    },
  };

  const res = sentry.initSentry(doc, fakeGlobal);
  assert.deepEqual(res, { enabled: true });
  assert.equal(doc.scripts.length, 1);
  assert.equal(doc.scripts[0].src, sentry.SDK);

  doc.scripts[0].onload();
  assert.equal(seenOpts.length, 1);
  assert.equal(seenOpts[0].dsn, testDsn);
  assert.equal(seenOpts[0].sendDefaultPii, false);

  const scrubbed = seenOpts[0].beforeSend({ user: { id: '123' }, request: { data: 'secret' }, message: 'err' });
  assert.equal(scrubbed.user, undefined);
  assert.equal(scrubbed.request.data, undefined);
  assert.equal(scrubbed.message, 'err');
});

test('codecov helper skips cleanly without token', async () => {
  assert.equal(codecov.tokenOf({}), '');
  assert.equal(codecov.tokenOf({ CODECOV_TOKEN: '   ' }), '');
  assert.equal(codecov.tokenOf({ CODECOV_TOKEN: codecov.PLACEHOLDER }), '');

  let called = 0;
  const result = await codecov.uploadReport('dummy-lcov', {}, () => { called += 1; });
  assert.equal(called, 0);
  assert.deepEqual(result, { ok: true, uploaded: false, reason: 'token-missing' });
});

test('repo files contain no committed secrets', () => {
  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(indexHtml, /<meta name="sentry-dsn" content="__SENTRY_DSN__">/);
  assert.match(indexHtml, /src\/lib\/sentryLoader\.js/);
  assert.doesNotMatch(indexHtml, /browser\.sentry-cdn\.com/);

  const allCode = indexHtml +
    fs.readFileSync(path.join(root, 'src', 'lib', 'sentryLoader.js'), 'utf8') +
    fs.readFileSync(path.join(root, 'tools', 'codecov.js'), 'utf8') +
    fs.readFileSync(path.join(root, 'README.md'), 'utf8');

  assert.doesNotMatch(allCode, /https:\/\/[0-9a-f]+@[a-z0-9.]+\.sentry\.io\/\d+/);
  assert.doesNotMatch(allCode, /CODECOV_TOKEN\s*[:=]\s*['"][A-Za-z0-9]{8,}/);
});
