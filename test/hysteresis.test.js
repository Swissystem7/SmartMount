const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('../src/lib/hysteresis');
const C = require('../src/lib/control');
const { PANEL_LIMITS, GLARE_THRESHOLD, GAIN_DEG_PER_RATIO, DEADBAND_DEG } = C;

// Every expected number below was computed by hand in a python3 scratch script
// before this file existed, from the same arithmetic the module documents:
//   filtered = mean of the last `window` usable ratios
//   target   = clamp((filtered - enter) * gain, 0, panel limit)
//   a move happens only when |target - commanded| > deadband
// IEEE-754 doubles, so the python and JS results are bit-identical.

// A sequence that hovers on the 3.0 threshold: the case the whole item exists
// for. Raw samples cross 3.0 five times in eight readings.
const HOVER = [2.8, 3.1, 2.9, 3.2, 2.95, 3.05, 2.85, 3.15];
// Hand-derived 3-sample moving average of HOVER:
const HOVER_FILTERED = [
  2.8,
  2.95,
  2.9333333333333336,
  3.0666666666666664,
  3.016666666666667,
  3.0666666666666664,
  2.9499999999999997,
  3.016666666666667,
];

test('the defaults come from the firmware bridge, the band and window do not', () => {
  const r = H.computeTiltState([1], { panel: 'LED' });
  assert.equal(r.enter, GLARE_THRESHOLD);
  assert.equal(r.gain, GAIN_DEG_PER_RATIO);
  assert.equal(r.deadband, DEADBAND_DEG);
  assert.equal(r.limit, PANEL_LIMITS.LED);
  assert.equal(r.band, H.DEFAULT_BAND);
  assert.equal(r.window, H.DEFAULT_WINDOW);
  // exit = enter - band = 3 - 0.5 = 2.5
  assert.equal(r.exit, 2.5);
});

test('the moving average of the hovering sequence is the hand-derived one', () => {
  const r = H.computeTiltState(HOVER, { panel: 'LED' });
  assert.deepEqual(r.samples.map((s) => s.filtered), HOVER_FILTERED);
  assert.deepEqual(r.samples.map((s) => s.index), [0, 1, 2, 3, 4, 5, 6, 7]);
});

test('a sequence hovering on the threshold commands zero moves', () => {
  const r = H.computeTiltState(HOVER, { panel: 'LED' });
  assert.deepEqual(
    r.samples.map((s) => s.state),
    ['idle', 'idle', 'idle', 'engaged', 'engaged', 'engaged', 'engaged', 'engaged']
  );
  assert.equal(r.moves, 0);
  assert.equal(r.finalState, 'engaged');
  assert.equal(r.finalAngle, 0);
  for (const s of r.samples) assert.equal(s.moved, false);
});

// The threshold is strict, exactly as in the .ino and in control.js. A ratio
// that lands ON 3.0 is not glare: firmware line 140 is
// `if (glareRatio > GLARE_THRESHOLD)` and control.js returns 0 for
// `ratio <= GLARE_THRESHOLD`. Without this the engage comparison could be
// relaxed to >= and every other test in the suite would stay green.
test('a ratio sitting exactly on the enter threshold does not engage', () => {
  const r = H.computeTiltState([3, 3, 3], { panel: 'LED' });
  // Hand-derived: mean([3,3,3]) = 3 exactly, and 3 > 3 is false three times.
  assert.deepEqual(r.samples.map((s) => s.filtered), [3, 3, 3]);
  assert.deepEqual(r.samples.map((s) => s.state), ['idle', 'idle', 'idle']);
  assert.equal(r.finalState, 'idle');
  assert.equal(r.finalAngle, 0);
  assert.equal(r.moves, 0);
  // One tick above the threshold DOES engage, so the assertion above is a
  // boundary and not a claim that the module never engages.
  const hot = H.computeTiltState([3.0000001], { panel: 'LED' });
  assert.equal(hot.samples[0].state, 'engaged');
  // ...and the mirror agrees at the same point: ratio 300/100 = 3.0 -> 0 deg.
  assert.equal(C.calcOptimalAngle(300, 100, 'LED', 11.25), 0);
});

// The two mechanisms fix two different failures, and the numbers say so.
test('without the band the state flips back below the threshold', () => {
  const c = H.compareMechanisms(HOVER, { panel: 'LED' });
  // filtered[6] = 2.9499999999999997 — under enter (3) but over exit (2.5).
  assert.equal(c.withBoth.samples[6].state, 'engaged');
  assert.equal(c.noBand.samples[6].state, 'idle');
  assert.equal(c.stateFlipsWithBoth, 1);
  assert.equal(c.stateFlipsNoBand, 3);
});

test('without the filter the raw sequence commands motor moves', () => {
  const c = H.compareMechanisms(HOVER, { panel: 'LED' });
  assert.equal(c.movesWithBoth, 0);
  assert.equal(c.movesNoFilter, 2);
  // Hand-derived: raw[3] = 3.2 -> (3.2 - 3) * 5 = 1.0000000000000009 > deadband.
  assert.equal(c.noFilter.samples[3].target, 1.0000000000000009);
  assert.equal(c.noFilter.samples[3].moved, true);
  assert.equal(c.noFilter.samples[4].target, 0);
  assert.equal(c.noFilter.samples[4].moved, true);
});

// The deadband test is strict too: a correction that lands EXACTLY on the
// 1 deg deadband is not worth the noise and wear. The module comment calls it
// "the same deadband test the .ino applies in loop()", and the .ino line 255 is
// `if (abs(next - currentAngle) > DEADBAND_DEG)`. Without this the comparison
// could be relaxed to >= and the whole suite would stay green.
test('a correction exactly equal to the deadband does not command a move', () => {
  // Hand-derived: window 1 so filtered = 1.5; enter 0.5 so the state engages;
  // gain 1 so target = (1.5 - 0.5) * 1 = 1 exactly; commanded starts at 0, so
  // |1 - 0| = 1, which is not > the deadband of 1.
  const r = H.computeTiltState([1.5], {
    panel: 'LED', enter: 0.5, band: 0.1, gain: 1, deadband: 1, window: 1,
  });
  assert.equal(r.samples[0].filtered, 1.5);
  assert.equal(r.samples[0].state, 'engaged');
  assert.equal(r.samples[0].target, 1);
  assert.equal(r.samples[0].commanded, 0);
  assert.equal(r.samples[0].moved, false);
  assert.equal(r.moves, 0);
  assert.equal(r.finalAngle, 0);
  // A hair over the deadband DOES move, so the assertion above is a boundary.
  const over = H.computeTiltState([1.6], {
    panel: 'LED', enter: 0.5, band: 0.1, gain: 1, deadband: 1, window: 1,
  });
  assert.equal(over.samples[0].moved, true);
  assert.equal(over.moves, 1);
  // ...and the mirror agrees at the same point.
  assert.equal(C.shouldMove(0, 1), false);
  assert.equal(C.shouldMove(0, 1.5), true);
});

test('a real glare step still engages and ramps to the panel cap', () => {
  const led = H.computeTiltState([1, 1, 1, 8, 8, 8, 8], { panel: 'LED' });
  assert.deepEqual(led.samples.map((s) => s.commanded), [
    0, 0, 0,
    1.6666666666666674,   // (10/3 - 3) * 5
    13.333333333333336,   // (17/3 - 3) * 5
    20,                   // (8 - 3) * 5 = 25, capped at the LED limit
    20,
  ]);
  assert.equal(led.moves, 3);
  assert.equal(led.finalAngle, PANEL_LIMITS.LED);

  // Same sequence on an OLED: 25° is inside its 40° limit, so no cap.
  const oled = H.computeTiltState([1, 1, 1, 8, 8, 8, 8], { panel: 'OLED' });
  assert.equal(oled.samples[5].target, 25);
  assert.equal(oled.finalAngle, 25);
  assert.equal(oled.moves, 3);
});

test('glare going away releases through the band and returns to flat', () => {
  const r = H.computeTiltState([8, 8, 8, 1, 1, 1], { panel: 'LED' });
  // filtered: 8, 8, 8, 17/3, 10/3, 1 — only the last is under exit (2.5).
  assert.deepEqual(
    r.samples.map((s) => s.state),
    ['engaged', 'engaged', 'engaged', 'engaged', 'engaged', 'idle']
  );
  assert.equal(r.moves, 4);
  assert.equal(r.finalState, 'idle');
  assert.equal(r.finalAngle, 0);
});

test('a failed reading holds: no filter update, no state change, no move', () => {
  const r = H.computeTiltState([8, 8, 8, NaN, -1, 8], { panel: 'LED' });
  assert.equal(r.samples[3].usable, false);
  assert.equal(r.samples[3].filtered, null);
  assert.equal(r.samples[3].commanded, 20);
  assert.equal(r.samples[4].usable, false);
  assert.equal(r.samples[4].filtered, null);
  // The two dropped samples never enter the window, so the average is still 8.
  assert.equal(r.samples[5].filtered, 8);
  assert.equal(r.moves, 1);
  assert.equal(r.finalState, 'engaged');
  assert.equal(r.finalAngle, 20);
});

test('the commanded angle never leaves [0, panel limit] on any sequence', () => {
  const seq = [];
  for (let i = 0; i <= 200; i++) seq.push(i / 10);
  for (const panel of Object.keys(PANEL_LIMITS)) {
    const r = H.computeTiltState(seq, { panel });
    for (const s of r.samples) {
      assert.ok(s.commanded >= 0, panel + ' went negative');
      assert.ok(s.commanded <= PANEL_LIMITS[panel], panel + ' exceeded its limit');
      assert.ok(s.target >= 0 && s.target <= PANEL_LIMITS[panel], panel + ' target out of range');
    }
  }
});

test('bad parameters are rejected rather than silently defaulted', () => {
  assert.throws(() => H.computeTiltState('not an array'), /sequence must be an array/);
  assert.throws(() => H.computeTiltState([1], { panel: 'PLASMA' }), /unknown panel type/);
  assert.throws(() => H.computeTiltState([1], { band: 3 }), /invalid hysteresis band/);
  assert.throws(() => H.computeTiltState([1], { band: -1 }), /invalid hysteresis band/);
  assert.throws(() => H.computeTiltState([1], { window: 0 }), /invalid filter window/);
  assert.throws(() => H.computeTiltState([1], { window: 1.5 }), /invalid filter window/);
  assert.throws(() => H.computeTiltState([1], { enter: NaN }), /invalid hysteresis params/);
  assert.throws(() => H.computeTiltState([1], { enter: 0 }), /invalid hysteresis params/);
  assert.throws(() => H.computeTiltState([1], { gain: -1 }), /invalid hysteresis params/);
});

test('an empty sequence is a legal, inert replay', () => {
  const r = H.computeTiltState([], { panel: 'LED' });
  assert.deepEqual(r.samples, []);
  assert.equal(r.moves, 0);
  assert.equal(r.finalState, 'idle');
  assert.equal(r.finalAngle, 0);
});

// Honesty guard. The .ino has no hysteresis and no averaging; if that ever
// changes, src/lib/control.js — the mirror — has to change with it, and this
// study stops being a study. Fail loudly instead of drifting.
test('the firmware still has none of this, and neither does the mirror', () => {
  const root = path.join(__dirname, '..');
  const ino = fs.readFileSync(path.join(root, 'firmware', 'smart_mount.ino'), 'utf8');
  const control = fs.readFileSync(path.join(root, 'src', 'lib', 'control.js'), 'utf8');
  for (const src of [ino, control]) {
    assert.doesNotMatch(src, /hysteresis|HYSTERESIS/);
    assert.doesNotMatch(src, /movingAverage|MOVING_AVERAGE|FILTER_WINDOW/);
  }
  assert.doesNotMatch(ino, /computeTiltState/);
  // ...and the band never reached the firmware bridge either.
  const spec = require('../config/control-params.json');
  assert.equal(spec.hysteresisBand, undefined);
  assert.equal(spec.filterWindow, undefined);
});
