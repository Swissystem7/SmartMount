const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const T = require('../src/lib/timing');

const ino = fs.readFileSync(path.join(__dirname, '../firmware/smart_mount.ino'), 'utf8');

test('firmware still publishes the numbers this model is built on', () => {
  assert.match(ino, /setMaxSpeed\(500\)/);
  assert.match(ino, /setAcceleration\(200\)/);
  assert.match(ino, /lastRead > 2000/);
  assert.match(ino, /WIFI_CONNECT_TIMEOUT_MS = 10000/);
  assert.match(ino, /delay\(200\)/);
  assert.equal(T.MAX_SPEED_SPS, 500);
  assert.equal(T.ACCEL_SPS2, 200);
  assert.equal(T.SAMPLE_PERIOD_MS, 2000);
});

test('20° of firmware gearing is a short triangle that never hits 500 step/s', () => {
  const p = T.moveProfile({ fromDeg: 0, toDeg: 20 });
  assert.equal(p.kind, 'triangle');
  assert.equal(p.hitsVmax, false);
  assert.ok(Math.abs(p.distanceSteps - 20 * T.STEPS_PER_DEGREE) < 1e-9);
  assert.ok(p.vPeakSps < 120);
  assert.ok(p.tTotalSec > 0.9 && p.tTotalSec < 1.2);
});

test('OLED 40° is still a triangle under the firmware accel', () => {
  const p = T.typicalPanelMove(40);
  assert.equal(p.kind, 'triangle');
  assert.ok(p.tTotalSec < 1.7);
  assert.equal(p.sampleDominates, true);
  assert.ok(p.worstSec > 3);
});

test('a long enough move does become a trapezoid and reaches vmax', () => {
  const p = T.profile({ distanceSteps: 4000, vmax: 500, accel: 200 });
  assert.equal(p.kind, 'trapezoid');
  assert.equal(p.hitsVmax, true);
  assert.equal(p.vPeakSps, 500);
  assert.ok(p.tCruiseSec > 0);
  const expected = 2 * (500 / 200) + (4000 - 2 * (500 * 500) / (2 * 200)) / 500;
  assert.ok(Math.abs(p.tTotalSec - expected) < 1e-9);
});

test('zero distance is a no-op profile', () => {
  const p = T.profile({ distanceSteps: 0 });
  assert.equal(p.kind, 'none');
  assert.equal(p.tTotalSec, 0);
});

test('glare latency is sample-dominated for every panel limit in the firmware', () => {
  for (const deg of [20, 30, 40]) {
    const p = T.typicalPanelMove(deg);
    assert.ok(p.sampleDominates, deg + '° motor should be faster than the 2 s poll');
    assert.ok(Math.abs(p.worstSec - (2 + p.tTotalSec)) < 1e-9);
    assert.ok(Math.abs(p.bestSec - p.tTotalSec) < 1e-9);
  }
});

test('a 20 ms HTTP handler starves both 500 step/s and a typical 20° triangle', () => {
  const cruise = T.loopBudget({ handleClientMs: 20, i2cReadMs: 2, vPeakSps: 500 });
  assert.equal(cruise.stepStarved, true);
  assert.equal(cruise.wdtTrip, false);
  assert.equal(cruise.firmwareWdtConfigured, false);

  // 20° → ~105 step/s peak → ~9.5 ms between pulses. handleClient = 20 ms misses.
  const short = T.moveProfile({ fromDeg: 0, toDeg: 20 });
  assert.ok(short.vPeakSps < 120);
  const live = T.loopBudget({
    handleClientMs: 20, i2cReadMs: 2, vPeakSps: short.vPeakSps,
  });
  assert.equal(live.stepStarved, true);

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

test('bad inputs are rejected', () => {
  assert.throws(() => T.profile({ distanceSteps: 10, vmax: 0 }), /invalid/);
  assert.throws(() => T.glareLatency({ moveSec: -1 }), /invalid/);
  assert.throws(() => T.loopBudget({ handleClientMs: 1, i2cReadMs: 1, vPeakSps: 0 }), /invalid/);
  assert.throws(() => T.loopPhases({ handleClientMs: -1 }), /invalid/);
  assert.throws(() => T.missProbability({ flashMs: -4 }), /invalid/);
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
  assert.ok(Math.abs(missed.waitSampleMs - 2000) < 1e-9);
  assert.equal(missed.bottleneck, 'sample');
  assert.ok(missed.totalMs > due.totalMs + 1.9 * 1000);
  assert.ok(due.motorMs > 900 && due.motorMs < 1200);
});

test('a 400 ms sun-flash is usually invisible to a 2 s poll', () => {
  const flash = T.missProbability({ flashMs: 400, periodMs: 2000 });
  assert.ok(Math.abs(flash.miss - 0.8) < 1e-9);
  assert.equal(flash.alwaysSeen, false);
  const long = T.missProbability({ flashMs: 2500, periodMs: 2000 });
  assert.equal(long.miss, 0);
  assert.equal(long.alwaysSeen, true);
});
