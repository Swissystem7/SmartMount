const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../src/lib/fsm');
const T = require('../src/lib/fsm-table');

function label(row) {
  return row.kind + ' ' + row.from + ' × ' + row.event;
}

test('every firmware and safe state×event cell is in the table', () => {
  for (const kind of ['firmware', 'safe']) {
    const states = T.statesOf(kind);
    const table = T.tableFor(kind);
    assert.deepEqual(Object.keys(table), [...states]);
    for (const state of states) {
      assert.deepEqual(Object.keys(table[state]), [...F.EVENTS], state);
    }
  }
});

test('walk covers SAFE_STATES × EVENTS and FIRMWARE_STATES × EVENTS', () => {
  const fw = T.walk('firmware');
  const sf = T.walk('safe');
  assert.equal(fw.length, F.FIRMWARE_STATES.length * F.EVENTS.length);
  assert.equal(sf.length, F.SAFE_STATES.length * F.EVENTS.length);
  assert.equal(fw.length, 2 * 15);
  assert.equal(sf.length, 11 * 15);
});

test('every firmware cell matches the table', () => {
  for (const row of T.walk('firmware')) {
    const exp = T.cell('firmware', row.from, row.event);
    assert.equal(row.to, exp.next, label(row));
    assert.equal(row.reject, exp.reject, label(row) + ' reject');
  }
});

test('every safe cell matches the table', () => {
  for (const row of T.walk('safe')) {
    const exp = T.cell('safe', row.from, row.event);
    assert.equal(row.to, exp.next, label(row));
    assert.equal(row.reject, exp.reject, label(row) + ' reject');
  }
});

test('canonical occupants are reached only through public step/boot', () => {
  for (const state of F.SAFE_STATES) {
    const s = T.canonical('safe', state);
    assert.equal(s.kind, 'safe');
    assert.equal(s.state, state);
  }
  for (const state of F.FIRMWARE_STATES) {
    const s = T.canonical('firmware', state);
    assert.equal(s.kind, 'firmware');
    assert.equal(s.state, state);
  }
});

test('context-sensitive variants are real step() results, not comments', () => {
  assert.ok(T.VARIANTS.length >= 8);
  for (const v of T.VARIANTS) {
    const out = T.walkVariant(v);
    assert.equal(out.state, v.next, v.id);
    assert.equal(out.reject, v.reject, v.id + ' reject');
  }
});

test('firmware BOOT swallows HOME/STALL — the reject only exists in RUN', () => {
  const boot = T.walk('firmware').find((r) => r.from === 'BOOT' && r.event === 'HOME_START');
  const run = T.walk('firmware').find((r) => r.from === 'RUN' && r.event === 'HOME_START');
  assert.equal(boot.reject, null);
  assert.equal(run.reject, 'no-such-state');
});

test('safe POWER_LOSS from every live state is DEAD; CLEAR is the only exit', () => {
  for (const row of T.walk('safe')) {
    if (row.event === 'POWER_LOSS') {
      assert.equal(row.to, 'DEAD', row.from);
    }
    if (row.from === 'DEAD' && row.event !== 'CLEAR') {
      assert.equal(row.to, 'DEAD', row.event);
    }
  }
  const clear = T.cell('safe', 'DEAD', 'CLEAR');
  assert.equal(clear.next, 'UNHOMED');
});

test('edges only list real state changes produced by walk()', () => {
  const edges = T.edges('safe');
  assert.ok(edges.some((e) => e.from === 'BOOT' && e.to === 'UNHOMED' && e.event === 'BOOT_DONE'));
  assert.ok(edges.some((e) => e.from === 'UNHOMED' && e.to === 'HOMING' && e.event === 'HOME_START'));
  assert.ok(edges.some((e) => e.from === 'HOMING' && e.to === 'IDLE_AUTO' && e.event === 'HOME_FOUND'));
  assert.ok(edges.every((e) => e.from !== e.to));
  const fw = T.edges('firmware');
  assert.deepEqual(fw.map((e) => e.from + '>' + e.to), ['BOOT>RUN']);
});

test('counts: most cells stay, a handful actually change state', () => {
  const sf = T.counts('safe');
  assert.equal(sf.cells, 165);
  assert.ok(sf.changes >= 20 && sf.changes < 50, 'safe changes=' + sf.changes);
  assert.ok(sf.stays > sf.changes);
  const fw = T.counts('firmware');
  assert.equal(fw.cells, 30);
  assert.equal(fw.changes, 1, 'firmware only leaves BOOT once');
});
