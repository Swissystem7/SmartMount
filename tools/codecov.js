#!/usr/bin/env node
// SmartMount — Optional Codecov upload helper (Refs #195).
// When CODECOV_TOKEN is absent, skips upload and exits 0 cleanly.
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PLACEHOLDER = '__CODECOV_TOKEN__';

function tokenOf(env) {
  const t = env && env.CODECOV_TOKEN;
  if (t == null) return '';
  const s = String(t).trim();
  if (!s || s === PLACEHOLDER) return '';
  return s;
}

function writeCoverage(root) {
  const dest = path.join(root, 'coverage', 'lcov.info');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const r = spawnSync(process.execPath, [
    '--test', '--experimental-test-coverage',
    '--test-reporter=lcov', '--test-reporter-destination=' + dest,
  ], { cwd: root, stdio: 'inherit' });
  return { status: r.status == null ? 1 : r.status, dest: dest };
}

async function uploadReport(lcov, env, fetchImpl) {
  const token = tokenOf(env);
  if (!token) return { ok: true, uploaded: false, reason: 'token-missing' };
  const fetchFn = fetchImpl || fetch;
  const q = new URLSearchParams({
    package: 'smartmount',
    token: token,
    branch: (env && env.GITHUB_REF_NAME) || '',
    commit: (env && env.GITHUB_SHA) || '',
    slug: 'Swissystem7/SmartMount',
    service: 'custom',
    build: (env && env.GITHUB_RUN_ID) || 'local',
    pr: (env && env.PR_NUMBER) || '',
  });
  const res = await fetchFn('https://codecov.io/upload/v4?' + q.toString(), { method: 'POST' });
  if (!res.ok) return { ok: true, uploaded: false, reason: 'codecov-' + res.status };
  const lines = String(await res.text()).split('\n').map(function (s) { return s.trim(); });
  const url = lines.find(function (s) { return s.indexOf('http') === 0; });
  if (!url) return { ok: true, uploaded: false, reason: 'no-upload-url' };
  const put = await fetchFn(url, { method: 'PUT', body: lcov, headers: { 'Content-Type': 'text/plain' } });
  return { ok: true, uploaded: !!put.ok, reason: put.ok ? 'ok' : 'put-' + put.status };
}

async function main() {
  const root = path.join(__dirname, '..');
  const run = writeCoverage(root);
  if (run.status !== 0) process.exit(run.status);
  const lcov = fs.readFileSync(run.dest, 'utf8');
  const result = await uploadReport(lcov, process.env);
  if (!result.uploaded) console.log('codecov: ' + result.reason);
  process.exit(0);
}

if (require.main === module) {
  main().catch(function (err) {
    console.log('codecov: ' + (err && err.message ? err.message : err));
    process.exit(0);
  });
}

module.exports = { tokenOf: tokenOf, uploadReport: uploadReport, writeCoverage: writeCoverage, PLACEHOLDER: PLACEHOLDER };
