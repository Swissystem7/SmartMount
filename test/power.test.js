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
  assert.throws(() => P.sizeBattery({ hoursWanted: 0 }), /invalid/);
});

test('idle-hold current is coil-dominated; worm idle is the MCU', () => {
  const modes = P.drawModes();
  assert.ok(modes['idle-hold'].totalW > 6);
  assert.ok(modes['idle-hold'].motor12vAvgMa > 400);
  assert.ok(modes['idle-worm'].totalW < 1);
  assert.equal(modes['idle-worm'].motor12vAvgMa, 0);
  assert.ok(modes.moving.totalW > modes['idle-hold'].totalW);
  assert.ok(modes['wifi-sleep-hold'].wifiMa < modes['idle-hold'].wifiMa);
  assert.equal(modes['idle-hold'].usbCanFeed, false);
  assert.equal(modes['idle-worm'].usbCanFeed, true);
});

test('a USB power bank cannot feed the 12 V motor rail', () => {
  const r = P.sizeBattery({
    packId: 'usb-10ah',
    movesPerDay: 24,
    moveDurationSec: 1.2,
    selfLocking: false,
    hoursWanted: 24,
  });
  assert.equal(r.pack.canMotor12v, false);
  assert.equal(r.kind, 'pack-cannot-motor-rail');
  assert.ok(r.hoursOnPack < 8, 'hold current empties 37 Wh in a workday');
});

test('a 3S LiPo can feed VMOT; a worm turns it into a viable UPS', () => {
  const hold = P.sizeBattery({
    packId: '3s2200',
    movesPerDay: 24,
    moveDurationSec: 1.2,
    selfLocking: false,
  });
  assert.equal(hold.canFeedMotorRail, true);
  assert.equal(hold.kind, 'hold-kills-pack');

  const worm = P.sizeBattery({
    packId: '3s2200',
    movesPerDay: 24,
    moveDurationSec: 1.2,
    selfLocking: true,
  });
  assert.equal(worm.kind, 'worm-makes-ups-viable');
  assert.ok(worm.hoursOnPack > 12);
  assert.ok(worm.requiredWh < hold.requiredWh);
});

test('every pack is labeled as typical, not a measured cell', () => {
  assert.equal(P.PACKS.length, 4);
  assert.ok(P.packById('pb12-7ah').cellWh > P.packById('3s2200').cellWh);
  assert.equal(P.packById('nope'), null);
});
