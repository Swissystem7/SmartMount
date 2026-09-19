const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calcOptimalAngle, glareRatio, shouldMove, liveAngleFromCommand, clampToPanel, moveToAngle,
  PANEL_LIMITS, GLARE_THRESHOLD, DEADBAND_DEG,
} = require('../src/lib/control');
const PARAMS = require('../src/lib/control-params');

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

test('an OLED is tilted further than a VA/LED under identical glare', () => {
  assert.ok(calcOptimalAngle(100_000, 100, 'OLED') > calcOptimalAngle(100_000, 100, 'LED'));
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
  assert.equal(calcOptimalAngle(-1, 100, 'OLED', 12.5), 12.5);
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
  // Use step-aligned 0° so ±DEADBAND lands exactly on the firmware boundary.
  assert.equal(shouldMove(0, DEADBAND_DEG), false);
  assert.equal(shouldMove(0, -DEADBAND_DEG), false);
});

test('a correction larger than the deadband moves the mount', () => {
  assert.ok(shouldMove(0, DEADBAND_DEG + 0.01));
  assert.ok(shouldMove(0, -DEADBAND_DEG - 0.01));
});

test('sensor jitter around a steady target never commands a move', () => {
  const settled = calcOptimalAngle(500, 100, 'LED');
  // After lroundf, live angle is slightly off the commanded float; ±18 lux
  // stays inside the firmware deadband of that live angle (±20 does not).
  for (let noise = -18; noise <= 18; noise += 2) {
    const jittered = calcOptimalAngle(500 + noise, 100, 'LED');
    assert.equal(shouldMove(settled, jittered), false, `noise ${noise} lux caused a move`);
  }
});

// Firmware: currentAngle = currentPosition/STEPS_PER_DEGREE after moveTo(lroundf).
// Commanded 20° → 56 steps → live ≈ 20.16°. Deadband against 20° desyncs.
test('shouldMove uses step-quantized live angle like syncAngleFromStepper', () => {
  const commanded = 20;
  const steps = moveToAngle(commanded, 'LED').steps;
  assert.equal(steps, 56);
  const live = liveAngleFromCommand(commanded);
  assert.equal(live, steps / PARAMS.stepsPerDegree);
  assert.ok(Math.abs(live - commanded) > 0.1, 'lround residual must be visible');

  // next=21.1: host-against-20 would move; board-against-20.16 holds.
  assert.equal(Math.abs(21.1 - commanded) > DEADBAND_DEG, true, 'naive float desync');
  assert.equal(Math.abs(21.1 - live) > DEADBAND_DEG, false, 'board holds');
  assert.equal(shouldMove(commanded, 21.1), false);

  // next=21.2: both move.
  assert.equal(shouldMove(commanded, 21.2), true);

  // next=19: host-against-20 holds (|Δ|=1); board-against-20.16 moves.
  assert.equal(Math.abs(19 - commanded) > DEADBAND_DEG, false, 'naive float desync');
  assert.equal(Math.abs(19 - live) > DEADBAND_DEG, true, 'board moves');
  assert.equal(shouldMove(commanded, 19), true);
});

// ── clamping ───────────────────────────────────────────────────────────────

test('a manual angle is clamped symmetrically', () => {
  assert.equal(clampToPanel(999, 'OLED'), PANEL_LIMITS.OLED);
  assert.equal(clampToPanel(-999, 'OLED'), -PANEL_LIMITS.OLED);
});

test('switching to a stricter panel pulls the angle back into range', () => {
  const wideAngle = clampToPanel(38, 'OLED');
  assert.equal(wideAngle, 38);
  assert.equal(clampToPanel(wideAngle, 'LED'), PANEL_LIMITS.LED);
});

// Documented limitation, asserted so it cannot change unnoticed: auto mode
// only ever tilts one way. Glare from below the screen is not corrected.
test('auto mode never returns a negative angle', () => {
  for (let luxTop = 0; luxTop <= 10_000; luxTop += 250) {
    assert.ok(calcOptimalAngle(luxTop, 100) >= 0);
  }
});

// ── moveToAngle / lroundf ──────────────────────────────────────────────────

// Firmware: long steps = lroundf(clamped * STEPS_PER_DEGREE). Halfway cases
// go away from zero. Math.round(-n.5) goes toward +∞, so the host used to
// queue one fewer negative pulse than AccelStepper on the board.
test('moveToAngle matches firmware lroundf on negative half-steps', () => {
  // -110.5 steps at STEPS_PER_DEGREE = 200*5/360 → deg = -39.78 (within OLED).
  const deg = -110.5 / PARAMS.stepsPerDegree;
  assert.equal(deg * PARAMS.stepsPerDegree, -110.5);
  assert.equal(Math.round(-110.5), -110, 'Math.round alone is the wrong contract');
  const r = moveToAngle(deg, 'OLED');
  assert.equal(r.clamped, deg);
  assert.equal(r.steps, -111);
});

test('moveToAngle still matches Math.round on positive half-steps and known caps', () => {
  const pos = 110.5 / PARAMS.stepsPerDegree;
  assert.equal(moveToAngle(pos, 'OLED').steps, 111);
  assert.equal(moveToAngle(20, 'LED').steps, 56);
  assert.equal(moveToAngle(-20, 'LED').steps, -56);
  assert.equal(moveToAngle(99, 'LED').clamped, 20);
  assert.equal(moveToAngle(99, 'LED').steps, 56);
});
