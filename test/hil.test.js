const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('../src/lib/hil');

test('every HIL case is still never-run — the board has not been on a bench', () => {
  assert.equal(H.STATUS, 'never-run');
  const s = H.summary();
  assert.equal(s.run, 0);
  assert.equal(s.neverRun, H.CASES.length);
  assert.equal(s.cases, 12);
  assert.ok(s.hazards.high >= 1);
});

test('ids are unique and every fixture / hazard is a known token', () => {
  const ids = new Set();
  const fixtures = new Set(H.FIXTURES.map((f) => f.id));
  for (const c of H.CASES) {
    assert.equal(ids.has(c.id), false, c.id);
    ids.add(c.id);
    assert.match(c.id, /^HIL-\d{2}$/);
    assert.ok(fixtures.has(c.fixture), c.id);
    assert.ok(['none', 'low', 'high'].includes(c.hazard), c.id);
    assert.ok(c.expect.length > 20, c.id);
    assert.ok(c.cannotProve.length > 10, c.id);
    assert.ok(c.instruments.length >= 1, c.id);
  }
});

test('the high-hazard case is dummy mass, never a television', () => {
  const drop = H.byId('HIL-10');
  assert.equal(drop.hazard, 'high');
  assert.equal(drop.fixture, 'dummy');
  assert.match(drop.inject, /לא טלוויזיה|מסה מדומה/);
  assert.match(drop.cannotProve, /18 ק״ג|UL|TÜV/);
});

test('unhomed boot and missing endstop are first-class cases', () => {
  assert.match(H.byId('HIL-07').expect, /30|הבאג/);
  assert.match(H.byId('HIL-12').proves, /לא בקושחה/);
  assert.equal(H.byFixture('dummy').length, 1);
});

test('docs/HIL.md exists and refuses to claim a run', () => {
  const md = fs.readFileSync(path.join(__dirname, '../docs/HIL.md'), 'utf8');
  assert.match(md, /never-run/);
  assert.match(md, /אף מקרה למטה לא רץ/);
  assert.match(md, /HIL-10/);
  assert.match(md, /להכריז/);
  assert.doesNotMatch(md, /all cases passed/i);
});
