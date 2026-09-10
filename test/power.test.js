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

// ── invariants ─────────────────────────────────────────────────────────────
// Round-2 backlog item 5. The tests above check verdicts; these check that
// the arithmetic behind them is internally consistent, and that the fixed
// scenario power/index.html renders on load is the same arithmetic.
//
// Every literal below was derived by hand in a python3 scratch script before
// this block was written:
//   holdW      = 2 phases x (1.5 A)^2 x 1.5 ohm            = 6.75 W
//   logic mA   = 180 (ESP32 + WiFi) + 2 x 0.12 (BH1750) + 8 (A4988 logic)
//              = 188.24 mA -> 188.24/1000 x 3.3 V          = 0.6211920000000001 W
//   moveW      = 6.75 x 1.15                               = 7.762499999999999 W
//   12 V avg   = 6.75/12 x 1000 = 562.5 mA holding, 646.875 mA moving

const fsPower = require('node:fs');
const pathPower = require('node:path');
const T = require('../src/lib/timing');

test('per-rail currents add up to the rail total, in every draw mode', () => {
  const modes = P.drawModes();
  for (const id of Object.keys(modes)) {
    const d = modes[id];
    // 3.3 V rail: MCU + sensors + driver logic and nothing else.
    assert.equal(d.logic3v3Ma, d.wifiMa + d.sensorMa + d.driverLogicMa, id + ' 3v3 rail');
    assert.equal(d.logicW, (d.logic3v3Ma / 1000) * P.LOGIC_V, id + ' logic W');
    // 12 V rail: the average current is P/V, not the 1.5 A phase rating.
    assert.ok(
      Math.abs(d.motorW - (d.motor12vAvgMa / 1000) * P.MOTOR_V) < 1e-9,
      id + ' 12 V rail'
    );
    // The two rails are the whole budget.
    assert.equal(d.totalW, d.logicW + d.motorW, id + ' total');
    assert.equal(d.usbCanFeed, d.totalW <= P.USB_5V_BUDGET_W, id + ' usb verdict');
  }
});

test('the four draw modes are the hand-derived numbers', () => {
  const m = P.drawModes();
  assert.equal(m['idle-hold'].wifiMa, 180);
  assert.equal(m['idle-hold'].sensorMa, 0.24);
  assert.equal(m['idle-hold'].driverLogicMa, 8);
  assert.equal(m['idle-hold'].logic3v3Ma, 188.24);
  assert.equal(m['idle-hold'].logicW, 0.6211920000000001);
  assert.equal(m['idle-hold'].motorW, 6.75);
  assert.equal(m['idle-hold'].motor12vAvgMa, 562.5);
  assert.equal(m['idle-hold'].motorPhasePeakMa, 1500);
  assert.equal(m['idle-hold'].totalW, 7.371192);

  assert.equal(m.moving.motorW, 7.762499999999999);
  assert.equal(m.moving.motor12vAvgMa, 646.875);
  assert.equal(m.moving.totalW, 8.383692);

  assert.equal(m['idle-worm'].motorW, 0);
  assert.equal(m['idle-worm'].motor12vAvgMa, 0);
  assert.equal(m['idle-worm'].totalW, 0.6211920000000001);

  assert.equal(m['wifi-sleep-hold'].wifiMa, 20);
  assert.equal(m['wifi-sleep-hold'].logic3v3Ma, 28.24);
  assert.equal(m['wifi-sleep-hold'].totalW, 6.843192);
});

test('daily energy is the sum of its two rails, hour by hour', () => {
  const d = P.dailyEnergy({ movesPerDay: 24, moveDurationSec: 1.2, selfLocking: false });
  assert.equal(d.totalWh, d.motorWh + d.logicWh);
  assert.equal(d.logicWh, d.logicW * 24);
  assert.equal(d.movingHours + d.idleHours, 24);
  assert.ok(Math.abs(d.motorWh - (d.moveW * d.movingHours + d.coilsIdle * d.idleHours)) < 1e-9);
  // 24 moves x 1.2 s = 28.8 s = 0.008 h in decimal. In doubles 24 * 1.2 is
  // 28.799999999999997 and the quotient is 0.007999999999999998 — pinned as
  // the real value rather than rounded to the number a human would write.
  assert.equal(d.movingHours, 0.007999999999999998);
  assert.equal(d.moveW, 6.75 * 1.15);
});

test('runtime on a pack is usable capacity divided by average power', () => {
  const r = P.sizeBattery({
    packId: '3s2200', movesPerDay: 24, moveDurationSec: 1.2, selfLocking: true, hoursWanted: 24,
  });
  // 24.4 Wh cell x 0.8 DoD x 0.85 converter = 16.592 Wh usable
  assert.equal(r.usableWh, 16.592);
  assert.equal(r.usableWh, r.pack.cellWh * r.dod * r.converterEff);
  assert.equal(r.wAvg, r.daily.totalWh / 24);
  assert.ok(Math.abs(r.hoursOnPack * r.wAvg - r.usableWh) < 1e-9, 'runtime is not capacity/power');
  assert.ok(
    Math.abs(r.requiredWh - (r.wAvg * r.hoursWanted) / (r.dod * r.converterEff)) < 1e-9,
    'required Wh is not the target hours at the average draw'
  );
  // C-rate is the peak current over the pack's amp-hours, both from the label.
  assert.ok(Math.abs(r.peakW - (r.daily.moveW + r.daily.logicW)) < 1e-12);
  assert.ok(Math.abs(r.peakA - r.peakW / r.pack.railV) < 1e-12);
  assert.ok(Math.abs(r.cRate - r.peakA / (r.pack.cellWh / r.pack.railV)) < 1e-12);
});

test('runtime falls monotonically as the duty cycle rises', () => {
  // moveProfile(0 -> 20 deg): 20 x 1000/360 = 55.55555555555556 steps, a
  // triangle because 2 x 500^2/(2 x 200) = 1250 steps is further than that.
  // t = 2 x sqrt(200 x 55.55555555555556)/200 = 1.0540925533894598 s.
  const MOVE_SEC = 1.0540925533894598;
  let previous = Infinity;
  const hours = [];
  for (const movesPerDay of [0, 12, 24, 48, 96, 200]) {
    const r = P.sizeBattery({
      packId: '3s2200', movesPerDay, moveDurationSec: MOVE_SEC, selfLocking: true, hoursWanted: 24,
    });
    assert.ok(r.hoursOnPack < previous, 'runtime did not fall at ' + movesPerDay + ' moves/day');
    previous = r.hoursOnPack;
    hours.push(r.hoursOnPack);
  }
  // 16.592 Wh / 0.6211920000000001 W with the coils off and no moves at all.
  assert.equal(hours[0], 26.709938312148253);
  assert.equal(hours[hours.length - 1], 25.919624692299664);
});

// ── the page renders this library, on these defaults ───────────────────────
// power/index.html has no test runner and this repository has no browser one.
// What can be asserted from node:test is that the scenario the page loads
// with — parsed out of the HTML — produces, through the library, exactly the
// strings the page's own formatters would print.
test('power/index.html loads a fixed scenario the library reproduces exactly', () => {
  const html = fsPower.readFileSync(
    pathPower.join(__dirname, '..', 'power', 'index.html'), 'utf8'
  );
  const tag = (id) => {
    const m = html.match(new RegExp('<input[^>]*id="' + id + '"[^>]*>'));
    assert.ok(m, 'power/index.html lost its #' + id + ' control');
    return m[0];
  };
  const value = (id) => {
    const m = tag(id).match(/value="([^"]*)"/);
    assert.ok(m, '#' + id + ' has no default value');
    return Number(m[1]);
  };

  // The defaults, read from the page rather than assumed.
  const moves = value('moves');
  const hoursWanted = value('hoursWanted');
  const selfLocking = /checked/.test(tag('worm'));
  const wifiOn = /checked/.test(tag('wifiOn'));
  const packId = (html.match(/let packId = '([^']+)'/) || [])[1];
  assert.equal(moves, 24);
  assert.equal(hoursWanted, 24);
  assert.equal(selfLocking, false, 'the page must open on the firmware-as-written case');
  assert.equal(wifiOn, true);
  assert.equal(packId, '3s2200');

  // The page derives the move duration the same way; pin it by hand.
  assert.match(html, /SM_TIMING\.moveProfile\(\{ fromDeg: 0, toDeg: 20 \}\)/);
  assert.match(html, /moveDurationSec: Math\.max\(move\.tTotalSec, 0\.2\)/);
  const move = T.moveProfile({ fromDeg: 0, toDeg: 20 });
  assert.equal(move.kind, 'triangle');
  assert.equal(move.tTotalSec, 1.0540925533894598);
  const moveDurationSec = Math.max(move.tTotalSec, 0.2);
  assert.equal(moveDurationSec, 1.0540925533894598);

  const day = P.sizeBudget({ movesPerDay: moves, moveDurationSec, selfLocking, wifiOn });
  const r = P.sizeBattery({ packId, movesPerDay: moves, moveDurationSec, selfLocking, wifiOn, hoursWanted });

  // Hand-derived, then formatted the way the page formats them.
  assert.equal(day.holdW.toFixed(2), '6.75');
  assert.equal(day.totalWh.toFixed(1), '176.9');
  assert.equal(r.hoursOnPack.toFixed(1), '2.3');
  assert.equal(r.requiredWh.toFixed(1), '260.2');
  assert.equal(r.cRate.toFixed(2), '0.34');
  // ...and this is the story the page is there to tell: 24 h wanted, 2.3 h got.
  assert.ok(r.hoursOnPack < r.hoursWanted);
  assert.equal(r.kind, 'hold-kills-pack');

  // The page must still print those five fields at those five precisions.
  assert.match(html, /pHold'\)\.textContent = day\.holdW\.toFixed\(2\)/);
  assert.match(html, /pDay'\)\.textContent = day\.totalWh\.toFixed\(1\)/);
  assert.match(html, /bHours'\)\.textContent = r\.hoursOnPack\.toFixed\(1\)/);
  assert.match(html, /bNeed'\)\.textContent = r\.requiredWh\.toFixed\(1\)/);
  assert.match(html, /bC'\)\.textContent = r\.cRate\.toFixed\(2\)/);
});
