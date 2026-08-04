const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calcOptimalAngle, glareRatio, shouldMove, clampToPanel,
  PANEL_LIMITS, GLARE_THRESHOLD, DEADBAND_DEG,
} = require('../src/lib/control');

test('an evenly lit room produces no tilt', () => {
  assert.equal(calcOptimalAngle(300, 300), 0);
});

test('the screen side being brighter is not glare', () => {
  assert.equal(calcOptimalAngle(100, 900), 0);
});

test('tilt only begins past the glare threshold', () => {
  assert.equal(calcOptimalAngle(GLARE_THRESHOLD * 100, 100), 0, 'exactly at threshold must not move');
  assert.ok(calcOptimalAngle((GLARE_THRESHOLD + 1) * 100, 100) > 0);
});

test('stronger glare tilts further', () => {
  const mild = calcOptimalAngle(400, 100);
  const harsh = calcOptimalAngle(700, 100);
  assert.ok(harsh > mild);
});

test('tilt never exceeds what the panel can take', () => {
  for (const panel of Object.keys(PANEL_LIMITS)) {
    const blinding = calcOptimalAngle(1_000_000, 1, panel);
    assert.equal(blinding, PANEL_LIMITS[panel], `${panel} exceeded its limit`);
  }
});

test('an OLED is tilted less than a QLED under identical glare', () => {
  assert.ok(calcOptimalAngle(100_000, 100, 'OLED') < calcOptimalAngle(100_000, 100, 'QLED'));
});

test('an unknown panel type is rejected rather than silently defaulted', () => {
  assert.throws(() => calcOptimalAngle(500, 100, 'PLASMA'), /unknown panel type/);
});

test('a dark screen-side sensor cannot divide by zero', () => {
  const angle = calcOptimalAngle(500, 0);
  assert.ok(Number.isFinite(angle) && angle > 0);
});

// A BH1750 returns a negative value when the read fails. Treating that as
// darkness would compute an enormous glare ratio and slam the panel to its
// limit, so a failed read must mean "hold position".
test('a failed sensor read holds position instead of slamming the panel', () => {
  assert.equal(calcOptimalAngle(-1, 100), 0);
  assert.equal(calcOptimalAngle(500, -2), 0);
  assert.equal(glareRatio(-1, 100), null);
});

test('non-numeric readings hold position too', () => {
  for (const bad of [NaN, Infinity, undefined, null]) {
    assert.equal(calcOptimalAngle(bad, 100), 0, `expected no motion for ${String(bad)}`);
  }
});

test('the response is monotonic across the whole glare range', () => {
  let previous = -1;
  for (let luxTop = 0; luxTop <= 5000; luxTop += 50) {
    const angle = calcOptimalAngle(luxTop, 100, 'QLED');
    assert.ok(angle >= previous, `angle dropped at luxTop=${luxTop}`);
    previous = angle;
  }
});

// ── deadband ───────────────────────────────────────────────────────────────

test('a correction smaller than the deadband is ignored', () => {
  assert.equal(shouldMove(10, 10 + DEADBAND_DEG), false);
  assert.equal(shouldMove(10, 10 - DEADBAND_DEG), false);
});

test('a correction larger than the deadband moves the mount', () => {
  assert.ok(shouldMove(10, 10 + DEADBAND_DEG + 0.01));
  assert.ok(shouldMove(10, 10 - DEADBAND_DEG - 0.01));
});

test('sensor jitter around a steady target never commands a move', () => {
  const settled = calcOptimalAngle(500, 100, 'LED');
  for (let noise = -20; noise <= 20; noise += 2) {
    const jittered = calcOptimalAngle(500 + noise, 100, 'LED');
    assert.equal(shouldMove(settled, jittered), false, `noise ${noise} lux caused a move`);
  }
});

// ── clamping ───────────────────────────────────────────────────────────────

test('a manual angle is clamped symmetrically', () => {
  assert.equal(clampToPanel(999, 'OLED'), PANEL_LIMITS.OLED);
  assert.equal(clampToPanel(-999, 'OLED'), -PANEL_LIMITS.OLED);
});

test('switching to a stricter panel pulls the angle back into range', () => {
  const wideAngle = clampToPanel(38, 'QLED');
  assert.equal(wideAngle, 38);
  assert.equal(clampToPanel(wideAngle, 'OLED'), PANEL_LIMITS.OLED);
});

// Documented limitation, asserted so it cannot change unnoticed: auto mode
// only ever tilts one way. Glare from below the screen is not corrected.
test('auto mode never returns a negative angle', () => {
  for (let luxTop = 0; luxTop <= 10_000; luxTop += 250) {
    assert.ok(calcOptimalAngle(luxTop, 100) >= 0);
  }
});
