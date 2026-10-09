// currentDraw.motorPhasePeakMa is the peak the PSU / pack must survive for a
// few hundred ms. It has to be the caller's phase current — the same number
// that windingHoldW squared for the I²R hold — not the 17HS4401 label. Before
// this test a 0.8 A motor reported 1.9 W of hold next to a 1500 mA peak.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/lib/power');

test('defaults are unchanged: the 17HS4401 label is still the peak when no phaseA is given', () => {
  const hold = P.currentDraw({ holding: true });
  assert.equal(hold.phaseA, P.NEMA17_PHASE_A);
  assert.equal(hold.motorPhasePeakMa, 1500);
  const move = P.currentDraw({ holding: true, moving: true });
  assert.equal(move.motorPhasePeakMa, 1500 * 1.15);

  const modes = P.drawModes();
  assert.equal(modes['idle-hold'].motorPhasePeakMa, 1500);
  assert.ok(Math.abs(modes.moving.motorPhasePeakMa - 1725) < 1e-9, '1.5 A × 1.15 in float');
  assert.equal(modes['idle-worm'].motorPhasePeakMa, 0);
});

test('a 0.8 A motor reports 800 mA peaks, not 1500', () => {
  const r = P.currentDraw({ holding: true, phaseA: 0.8 });
  assert.equal(r.phaseA, 0.8);
  assert.equal(r.motorPhasePeakMa, 800);
  // and the I²R hold that goes with it: 2 × 0.8² × 1.5 Ω
  assert.equal(r.motorW, 2 * 0.8 * 0.8 * 1.5);
  assert.equal(r.motor12vAvgMa, (r.motorW / 12) * 1000);

  const moving = P.currentDraw({ holding: true, moving: true, phaseA: 0.8 });
  assert.ok(Math.abs(moving.motorPhasePeakMa - 920) < 1e-9, '0.8 A × 1.15');
});

test('peak and hold agree: hold W == phases × (peak A)² × R for any phase current', () => {
  for (const phaseA of [0.4, 0.8, 1.2, 1.5, 1.68, 2.0]) {
    const r = P.currentDraw({ holding: true, phaseA });
    const peakA = r.motorPhasePeakMa / 1000;
    const expectW = P.NEMA17_PHASES * peakA * peakA * P.NEMA17_PHASE_OHM;
    assert.ok(Math.abs(r.motorW - expectW) < 1e-9, 'phaseA=' + phaseA);
  }
});

test('a motor with 0 A of phase current draws nothing and peaks at nothing', () => {
  const r = P.currentDraw({ holding: true, moving: true, phaseA: 0 });
  assert.equal(r.motorW, 0);
  assert.equal(r.motor12vAvgMa, 0);
  assert.equal(r.motorPhasePeakMa, 0);
  assert.equal(r.usbCanFeed, true, 'logic alone fits a 5 V port');
});

test('coils off means no peak, whatever the phase current is', () => {
  const r = P.currentDraw({ holding: false, moving: false, phaseA: 2.5 });
  assert.equal(r.motorPhasePeakMa, 0);
  assert.equal(r.motorW, 0);
  assert.equal(r.phaseA, 2.5, 'the motor on the bench is still a 2.5 A motor');
});

test('a bad phase current throws before any peak is reported', () => {
  assert.throws(() => P.currentDraw({ holding: true, phaseA: -1 }), /invalid winding/);
  assert.throws(() => P.currentDraw({ holding: true, phaseA: 'a lot' }), /invalid winding/);
});
