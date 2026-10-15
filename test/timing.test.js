const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const T = require('../src/lib/timing');
const C = require('../src/lib/control');

const ino = fs.readFileSync(path.join(__dirname, '../firmware/smart_mount.ino'), 'utf8');
const spec = require('../config/control-params.json');

test('firmware still publishes the numbers this model is built on', () => {
  // The motor envelope and sample period are generated into the .ino from
  // config/control-params.json; the firmware must use those names, not a
  // literal that can drift from what this model was built on.
  assert.match(ino, /setMaxSpeed\(MAX_SPEED_SPS\)/);
  assert.match(ino, /setAcceleration\(ACCEL_SPS2\)/);
  assert.match(ino, /lastRead > SAMPLE_PERIOD_MS/);
  assert.doesNotMatch(ino, /setMaxSpeed\(\d/);
  assert.doesNotMatch(ino, /setAcceleration\(\d/);
  assert.doesNotMatch(ino, /lastRead > \d/);
  assert.match(ino, new RegExp('MAX_SPEED_SPS = ' + spec.motion.maxSpeedSps + '\\.0f'));
  assert.match(ino, new RegExp('ACCEL_SPS2    = ' + spec.motion.accelSps2 + '\\.0f'));
  assert.match(ino, new RegExp('SAMPLE_PERIOD_MS = ' + spec.motion.samplePeriodMs + ';'));
  assert.match(ino, /WIFI_CONNECT_TIMEOUT_MS = 10000/);
  assert.match(ino, /delay\(200\)/);
  assert.match(ino, /lroundf\(clamped \* STEPS_PER_DEGREE\)/);
  assert.equal(T.MAX_SPEED_SPS, spec.motion.maxSpeedSps);
  assert.equal(T.ACCEL_SPS2, spec.motion.accelSps2);
  assert.equal(T.SAMPLE_PERIOD_MS, spec.motion.samplePeriodMs);
  assert.equal(T.STEPS_PER_DEGREE, (spec.stepper.stepsPerRev * spec.stepper.gearRatio) / 360);
  // The numbers the rest of this file asserts against.
  assert.equal(T.MAX_SPEED_SPS, 500);
  assert.equal(T.ACCEL_SPS2, 200);
  assert.equal(T.SAMPLE_PERIOD_MS, 2000);
});

test('timing.js has no private copy of the motion constants', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/lib/timing.js'), 'utf8');
  assert.match(src, /require\('\.\/control-params'\)/);
  assert.match(src, /globalThis\.CONTROL_PARAMS/);
  assert.doesNotMatch(src, /MAX_SPEED_SPS = \d/);
  assert.doesNotMatch(src, /ACCEL_SPS2 = \d/);
  assert.doesNotMatch(src, /SAMPLE_PERIOD_MS = \d/);
  assert.doesNotMatch(src, /STEPS_PER_REV = \d/);
  assert.doesNotMatch(src, /GEAR_RATIO = \d/);
  // Pages that load timing.js in a browser must load the params first.
  for (const rel of ['runtime/index.html', 'power/index.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
    const params = html.indexOf('src/lib/control-params.js');
    const timing = html.indexOf('src/lib/timing.js');
    assert.ok(params >= 0, rel + ' does not load control-params.js');
    assert.ok(params < timing, rel + ' loads timing.js before control-params.js');
  }
});

test('stepsForDeg is from-zero lround magnitude (integer pulses)', () => {
  // Prefer R13 absolute |lround| semantics (supersedes relative round of R3).
  assert.equal(T.stepsForDeg(20), 56);
  assert.equal(T.stepsForDeg(-20), 56);
  assert.equal(T.stepsForDeg(40), 111);
  assert.equal(T.stepsForDeg(0), 0);
  assert.equal(T.stepsForDeg(20), Math.abs(C.moveToAngle(20).steps));
  assert.equal(T.stepsForDeg(40), Math.abs(C.moveToAngle(40, 'OLED').steps));
  assert.notEqual(T.stepsForDeg(20), 20 * T.STEPS_PER_DEGREE);
});

test('20° AccelStepper profile: absolute lround from home, exact triangle', () => {
  const p = T.moveProfile({ fromDeg: 0, toDeg: 20 });
  assert.equal(p.kind, 'triangle');
  assert.equal(p.hitsVmax, false);
  assert.equal(p.distanceSteps, 56);
  assert.equal(p.distanceSteps, Math.abs(C.moveToAngle(20).steps - C.moveToAngle(0).steps));
  assert.equal(p.stepsCruise, 0);
  assert.equal(p.stepsAccel, 28);
  // v_peak = √(a · s) = √(200 · 56); t = 2 · v_peak / a
  assert.equal(p.vPeakSps, Math.sqrt(200 * 56));
  assert.equal(p.tAccelSec, Math.sqrt(200 * 56) / 200);
  assert.equal(p.tCruiseSec, 0);
  assert.equal(p.tTotalSec, 2 * Math.sqrt(200 * 56) / 200);
  assert.ok(p.vPeakSps < 120);
  assert.ok(p.tTotalSec > 0.9 && p.tTotalSec < 1.2);
});

test('absolute moveTo delta is |lround(to)-lround(from)|, not round(|Δ|·k)', () => {
  // Residual after relative-only rounding: 20°→21° firmware = 2, round(1·k) = 3.
  const p = T.moveProfile({ fromDeg: 20, toDeg: 21 });
  assert.equal(p.distanceSteps, 2);
  assert.equal(
    p.distanceSteps,
    Math.abs(C.moveToAngle(21, 'OLED').steps - C.moveToAngle(20, 'OLED').steps),
  );
  assert.notEqual(p.distanceSteps, Math.round(Math.abs(21 - 20) * T.STEPS_PER_DEGREE));
  const wide = T.moveProfile({ fromDeg: 20, toDeg: 40 });
  assert.equal(wide.distanceSteps, 55);
  assert.equal(
    wide.distanceSteps,
    Math.abs(C.moveToAngle(40, 'OLED').steps - C.moveToAngle(20, 'OLED').steps),
  );
  assert.notEqual(wide.distanceSteps, Math.round(20 * T.STEPS_PER_DEGREE));
});

test('OLED 40° AccelStepper profile: absolute 111 steps under firmware accel', () => {
  const p = T.typicalPanelMove(40);
  assert.equal(p.kind, 'triangle');
  assert.equal(p.distanceSteps, 111);
  assert.equal(p.vPeakSps, Math.sqrt(200 * 111));
  assert.equal(p.tTotalSec, 2 * Math.sqrt(200 * 111) / 200);
  assert.ok(p.tTotalSec < 1.7);
  assert.equal(p.sampleDominates, true);
  assert.ok(p.worstSec > 3);
  assert.equal(p.worstSec, 2 + p.tTotalSec);
  assert.equal(p.bestSec, p.tTotalSec);
});

test('a long enough move does become a trapezoid and reaches vmax', () => {
  const p = T.profile({ distanceSteps: 4000, vmax: 500, accel: 200 });
  assert.equal(p.kind, 'trapezoid');
  assert.equal(p.hitsVmax, true);
  assert.equal(p.vPeakSps, 500);
  assert.equal(p.tAccelSec, 500 / 200);
  assert.equal(p.stepsAccel, (500 * 500) / (2 * 200));
  assert.equal(p.stepsCruise, 4000 - 2 * 625);
  assert.equal(p.tCruiseSec, 2750 / 500);
  assert.equal(p.tTotalSec, 10.5);
  const expected = 2 * (500 / 200) + (4000 - 2 * (500 * 500) / (2 * 200)) / 500;
  assert.equal(p.tTotalSec, expected);
});

test('trapezoid/triangle boundary is exactly 2 · v²/(2a) steps', () => {
  const sAccVmax = (500 * 500) / (2 * 200); // 625
  const at = T.profile({ distanceSteps: 2 * sAccVmax, vmax: 500, accel: 200 });
  assert.equal(at.kind, 'trapezoid');
  assert.equal(at.tCruiseSec, 0);
  assert.equal(at.vPeakSps, 500);
  assert.equal(at.tTotalSec, 5);
  const below = T.profile({ distanceSteps: 2 * sAccVmax - 1, vmax: 500, accel: 200 });
  assert.equal(below.kind, 'triangle');
  assert.equal(below.hitsVmax, false);
  assert.equal(below.vPeakSps, Math.sqrt(200 * 1249));
});

test('zero distance is a no-op profile', () => {
  const p = T.profile({ distanceSteps: 0 });
  assert.equal(p.kind, 'none');
  assert.equal(p.tTotalSec, 0);
  assert.equal(p.vPeakSps, 0);
});

test('glare latency is sample-dominated for every panel limit in the firmware', () => {
  for (const deg of [20, 30, 40]) {
    const p = T.typicalPanelMove(deg);
    assert.ok(p.sampleDominates, deg + '° motor should be faster than the 2 s poll');
    assert.equal(p.worstSec, 2 + p.tTotalSec);
    assert.equal(p.bestSec, p.tTotalSec);
    assert.equal(p.distanceSteps, T.stepsForDeg(deg));
  }
});

test('a 20 ms HTTP handler starves both 500 step/s and a typical 20° triangle', () => {
  const cruise = T.loopBudget({ handleClientMs: 20, i2cReadMs: 2, vPeakSps: 500 });
  assert.equal(cruise.stepStarved, true);
  assert.equal(cruise.wdtTrip, false);
  assert.equal(cruise.firmwareWdtConfigured, false);

  // 20° → √(200·56) ≈ 105.83 step/s peak → ≈9.45 ms between pulses. handleClient = 20 ms misses.
  const short = T.moveProfile({ fromDeg: 0, toDeg: 20 });
  assert.equal(short.vPeakSps, Math.sqrt(200 * 56));
  const live = T.loopBudget({
    handleClientMs: 20, i2cReadMs: 2, vPeakSps: short.vPeakSps,
  });
  assert.equal(live.stepStarved, true);
  assert.equal(live.stepIntervalMs, 1000 / Math.sqrt(200 * 56));

  const polite = T.loopBudget({
    handleClientMs: 2, i2cReadMs: 1, vPeakSps: short.vPeakSps,
  });
  assert.equal(polite.stepStarved, false);
});

test('an I²C lockup longer than the WDT would trip — and the .ino never arms one', () => {
  const hung = T.loopBudget({ handleClientMs: 1, i2cReadMs: 8000, vPeakSps: 100 });
  assert.equal(hung.wdtTrip, true);
  assert.equal(hung.firmwareWdtConfigured, false);
});

test('WiFi setup blocks the motor: timeout is 10 s of delay(200)', () => {
  const miss = T.wifiBlock({});
  assert.equal(miss.blockedMs, 10000);
  assert.equal(miss.polls, 50);
  assert.equal(miss.motorRunsDuringSetup, false);
  assert.equal(miss.localAutoAfterTimeout, true);

  const hit = T.wifiBlock({ connectedAfterMs: 1400 });
  assert.equal(hit.blockedMs, 1400);
  assert.equal(hit.localAutoAfterTimeout, false);
});

test('WiFi setup only sees the link on a delay(200) boundary', () => {
  // while (status != CONNECTED && elapsed < TIMEOUT) delay(200);
  // if (status == CONNECTED) ... — the status is read after the loop too.
  assert.match(ino, /while \(WiFi\.status\(\) != WL_CONNECTED &&\s+millis\(\) - wifiStart < WIFI_CONNECT_TIMEOUT_MS\)/);
  assert.match(ino, /delay\(200\);\s+\}\s+if \(WiFi\.status\(\) == WL_CONNECTED\)/);

  const mid = T.wifiBlock({ connectedAfterMs: 1450 });
  assert.equal(mid.blockedMs, 1600);
  assert.equal(mid.polls, 8);

  const now = T.wifiBlock({ connectedAfterMs: 0 });
  assert.equal(now.blockedMs, 0);
  assert.equal(now.polls, 0);

  // Up during the last delay: the post-loop check sees it.
  const late = T.wifiBlock({ connectedAfterMs: 9950 });
  assert.equal(late.blockedMs, 10000);
  assert.equal(late.localAutoAfterTimeout, false);
  assert.equal(T.wifiBlock({ connectedAfterMs: 10000 }).localAutoAfterTimeout, false);

  const missed = T.wifiBlock({ connectedAfterMs: 10001 });
  assert.equal(missed.blockedMs, 10000);
  assert.equal(missed.localAutoAfterTimeout, true);

  // A timeout off the poll grid still ends on one: 10100 → checks at 10000, 10200.
  const odd = T.wifiBlock({ timeoutMs: 10100 });
  assert.equal(odd.blockedMs, 10200);
  assert.equal(odd.polls, 51);
  assert.equal(T.wifiBlock({ timeoutMs: 10100, connectedAfterMs: 10150 }).localAutoAfterTimeout, false);

  assert.throws(() => T.wifiBlock({ connectedAfterMs: -1 }), /invalid/);
});

test('bad inputs are rejected', () => {
  assert.throws(() => T.profile({ distanceSteps: 10, vmax: 0 }), /invalid/);
  assert.throws(() => T.glareLatency({ moveSec: -1 }), /invalid/);
  assert.throws(() => T.loopBudget({ handleClientMs: 1, i2cReadMs: 1, vPeakSps: 0 }), /invalid/);
  assert.throws(() => T.loopPhases({ handleClientMs: -1 }), /invalid/);
  assert.throws(() => T.missProbability({ flashMs: -4 }), /invalid/);
  assert.throws(() => T.stepsForDeg(10, 0), /invalid/);
});

test('a sample loop is still handleClient-dominated; a non-sample loop is tiny', () => {
  const sample = T.loopPhases({
    handleClientMs: 8, i2cReadMs: 2, thisLoopSamples: true, vPeakSps: 105,
  });
  assert.equal(sample.phases.length, 5);
  assert.ok(sample.phases[0].ms > sample.phases[2].ms, 'HTTP dwarfs the law');
  assert.ok(sample.busyMs < 15);
  assert.equal(sample.firmwareWdtConfigured, false);

  const idle = T.loopPhases({
    handleClientMs: 8, i2cReadMs: 2, thisLoopSamples: false, vPeakSps: 105,
  });
  assert.equal(idle.phases.find((p) => p.id === 'i2c').ms, 0);
  assert.ok(idle.busyMs < sample.busyMs);
});

test('latency chain: just-missed sample is the 2 s plant lag', () => {
  const due = T.latencyChain({ fromDeg: 0, toDeg: 20, samplePhase01: 1 });
  const missed = T.latencyChain({ fromDeg: 0, toDeg: 20, samplePhase01: 0 });
  assert.ok(due.waitSampleMs < 1);
  assert.equal(missed.waitSampleMs, 2000);
  assert.equal(missed.bottleneck, 'sample');
  assert.ok(missed.totalMs > due.totalMs + 1.9 * 1000);
  // motorMs pinned to AccelStepper envelope for 56 integer steps
  assert.equal(due.motorMs, 2 * Math.sqrt(200 * 56) / 200 * 1000);
  assert.equal(due.move.distanceSteps, 56);
});

test('a 400 ms sun-flash is usually invisible to a 2 s poll', () => {
  const flash = T.missProbability({ flashMs: 400, periodMs: 2000 });
  assert.equal(flash.miss, 0.8);
  assert.equal(flash.alwaysSeen, false);
  const long = T.missProbability({ flashMs: 2500, periodMs: 2000 });
  assert.equal(long.miss, 0);
  assert.equal(long.alwaysSeen, true);
});
