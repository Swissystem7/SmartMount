const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/lib/power');
const Tq = require('../src/lib/torque');

test('I²R hold of a 17HS4401-class pair is several watts — above a USB 5 V port', () => {
  const w = P.windingHoldW({});
  assert.equal(w, 2 * 1.5 * 1.5 * 1.5);
  assert.ok(w > 6);
  assert.ok(w > P.USB_5V_BUDGET_W);
});

test('the MCU + two BH1750 is a rounding error next to coil hold', () => {
  const logic = P.logicW({ wifiOn: true, sensorsOn: true, sensorCount: 2 });
  const hold = P.windingHoldW({});
  assert.ok(logic < 1);
  assert.ok(hold / logic > 8);
});

test('firmware-as-written (coils on 24 h, no worm) is a heater', () => {
  const r = P.sizeBudget({ movesPerDay: 24, moveDurationSec: 1.2, selfLocking: false });
  assert.equal(r.verdict, 'usb-cannot-hold');
  assert.equal(r.kind, 'hold-dominates');
  assert.ok(r.totalWh > 140);
  assert.ok(r.motorWh > r.logicWh);
  assert.equal(r.usbCanFeedMotor, false);
});

test('a self-locking worm drops idle coil power to 0 and the MCU shows up', () => {
  const r = P.sizeBudget({
    movesPerDay: 24,
    moveDurationSec: 1.2,
    selfLocking: true,
  });
  assert.equal(r.coilsIdle, 0);
  assert.ok(r.motorWh < 1);
  assert.equal(r.kind, 'mcu-is-rounding-error');
  assert.ok(r.logicWh > r.motorWh);
  // USB still cannot feed the *move* current, even if idle is cheap.
  assert.equal(r.usbCanFeedMotor, false);
  assert.equal(r.verdict, 'usb-cannot-move');
});

test('disable-coils-when-idle matches the worm energy story, not the torque story', () => {
  const r = P.sizeBudget({
    movesPerDay: 12,
    moveDurationSec: 1,
    disableCoilsWhenIdle: true,
    selfLocking: false,
  });
  assert.equal(r.coilsIdle, 0);
  assert.ok(r.totalWh < 20);
  // torque.js: unpowered hold without a worm is a drop. Energy saved ≠ safe.
  const mech = Tq.verdict({ factor: 0.13, selfLocking: false, unpowered: true });
  assert.equal(mech, 'drop-on-power-loss');
});

test('zero moves still burns hold energy if coils stay on', () => {
  const r = P.dailyEnergy({ movesPerDay: 0, selfLocking: false });
  assert.equal(r.movingHours, 0);
  assert.ok(Math.abs(r.motorWh - r.holdW * 24) < 1e-9);
});

test('bad inputs throw', () => {
  assert.throws(() => P.windingHoldW({ phaseA: -1 }), /invalid/);
  assert.throws(() => P.dailyEnergy({ movesPerDay: -3 }), /invalid/);
});
