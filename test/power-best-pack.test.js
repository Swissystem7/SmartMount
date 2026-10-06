// «איזו סוללה לקנות» — sizeBattery.bestPackId answers the one question a
// reader asks in front of the power page. Still a model: typical pack labels,
// datasheet-class coil numbers, no cell we ever discharged.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/lib/power');

const WORM = {
  packId: '3s2200',
  movesPerDay: 24,
  moveDurationSec: 1.2,
  selfLocking: true,
  hoursWanted: 24,
};

test('with a worm, the smallest pack that holds 24 h on the 12 V rail is the 3S LiPo', () => {
  const r = P.sizeBattery(WORM);
  assert.equal(r.requiredWh, 22.015747058823532);
  assert.equal(r.bestPackId, '3s2200');

  // Why not the others, in the module's own numbers.
  const best = P.packById(r.bestPackId);
  assert.ok(best.cellWh >= r.requiredWh, '24.4 Wh covers the 22.0 Wh target');
  assert.equal(best.canMotor12v, true);
  assert.ok(P.packById('2s18650').cellWh < r.requiredWh, '18.5 Wh is short');
  assert.ok(P.packById('usb-10ah').cellWh > best.cellWh, 'the USB bank holds more Wh');
  assert.equal(P.packById('usb-10ah').canMotor12v, false, 'and still cannot feed VMOT');
  assert.ok(P.packById('pb12-7ah').cellWh > best.cellWh, 'the lead UPS is the heavy answer');
});

test('without a worm, no pack on the list is an answer', () => {
  const r = P.sizeBattery(Object.assign({}, WORM, { selfLocking: false }));
  assert.equal(r.requiredWh, 260.1716294117646);
  assert.equal(r.bestPackId, null);
  for (const p of P.PACKS) assert.ok(p.cellWh < r.requiredWh, p.id);
});

test('the recommendation really reaches hoursWanted, and the pack below it does not', () => {
  const r = P.sizeBattery(WORM);
  const onBest = P.sizeBattery(Object.assign({}, WORM, { packId: r.bestPackId }));
  assert.ok(onBest.hoursOnPack >= onBest.hoursWanted);
  assert.equal(onBest.canFeedMotorRail, true);

  const onSmaller = P.sizeBattery(Object.assign({}, WORM, { packId: '2s18650' }));
  assert.ok(onSmaller.hoursOnPack < onSmaller.hoursWanted);
});

test('asking for more hours moves the answer up the list, never down', () => {
  const at24 = P.sizeBattery(WORM);
  const at27 = P.sizeBattery(Object.assign({}, WORM, { hoursWanted: 27 }));
  assert.equal(at24.bestPackId, '3s2200');
  // 24.77 Wh is just past the 3S pack's 24.4 Wh label.
  assert.ok(at27.requiredWh > P.packById('3s2200').cellWh);
  assert.equal(at27.bestPackId, 'pb12-7ah');

  let prev = 0;
  for (const h of [2, 12, 24, 27, 48, 72]) {
    const r = P.sizeBattery(Object.assign({}, WORM, { hoursWanted: h }));
    const wh = r.bestPackId === null ? Infinity : P.packById(r.bestPackId).cellWh;
    assert.ok(wh >= prev, 'hoursWanted=' + h + ' must not recommend a smaller pack');
    prev = wh;
  }
});

test('the 12 V gate only applies when the coils are in the budget', () => {
  // Model the motor out entirely: logic-only load, no moves, no winding.
  const r = P.sizeBattery({ packId: '3s2200', movesPerDay: 0, phaseA: 0, hoursWanted: 20 });
  assert.equal(r.daily.holdW, 0);
  assert.equal(r.motorNeeded, false);
  assert.equal(r.bestPackId, '2s18650', 'with no 12 V load the 2S pack is legal and smallest');
  assert.equal(P.packById(r.bestPackId).canMotor12v, false);
});

test('bestPackId is a property of the budget, not of the pack the caller clicked', () => {
  const ids = P.PACKS.map((p) => p.id).concat(['nope']);
  for (const packId of ids) {
    const r = P.sizeBattery(Object.assign({}, WORM, { packId }));
    assert.equal(r.bestPackId, '3s2200', 'asked about ' + packId);
  }
});
