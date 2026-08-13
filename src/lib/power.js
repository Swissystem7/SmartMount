// SmartMount — rail power budget from datasheet-class typicals.
//
// Not a lab measurement. The board has never been current-probed. Numbers
// exist so a reviewer can see why the MCU is a rounding error next to a
// NEMA17 that holds against gravity, and why USB 5 V / 500 mA cannot be
// the motor rail.
//
// Holding torque of a stepper is ~0 when the driver is unpowered — see
// torque.js. This file answers the other half: what it *costs* to keep
// those coils on.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SM_POWER = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const LOGIC_V = 3.3;
  const MOTOR_V = 12;
  const USB_5V_BUDGET_W = 2.5; // 5 V × 500 mA, a phone-charger class port

  // ESP32-WROOM, Wi-Fi associated, modem on — order of 80–240 mA @ 3.3 V.
  const ESP32_WIFI_MA = 180;
  const ESP32_MODEM_SLEEP_MA = 20;
  const BH1750_ACTIVE_MA = 0.12;
  const BH1750_POWERDOWN_MA = 0.001;
  const A4988_LOGIC_MA = 8;

  // 17HS4401-class: ~1.5 A/phase, ~1.5 Ω. Chopped 12 V supply. I²R in the
  // windings is the honest floor; driver + supply losses sit on top.
  const NEMA17_PHASE_A = 1.5;
  const NEMA17_PHASE_OHM = 1.5;
  const NEMA17_PHASES = 2;

  function windingHoldW({ phaseA, phaseOhm, phases }) {
    const I = Number(phaseA != null ? phaseA : NEMA17_PHASE_A);
    const R = Number(phaseOhm != null ? phaseOhm : NEMA17_PHASE_OHM);
    const n = Number(phases != null ? phases : NEMA17_PHASES);
    if (![I, R, n].every(Number.isFinite) || I < 0 || R < 0 || n < 0) {
      throw new Error('invalid winding inputs');
    }
    return n * I * I * R;
  }

  function logicW({ wifiOn, sensorsOn, sensorCount }) {
    const wifi = wifiOn !== false;
    const sens = sensorsOn !== false;
    const n = Number(sensorCount != null ? sensorCount : 2);
    if (!Number.isFinite(n) || n < 0) throw new Error('invalid logic inputs');
    const espMa = wifi ? ESP32_WIFI_MA : ESP32_MODEM_SLEEP_MA;
    const sensMa = n * (sens ? BH1750_ACTIVE_MA : BH1750_POWERDOWN_MA);
    const ma = espMa + sensMa + A4988_LOGIC_MA;
    return (ma / 1000) * LOGIC_V;
  }

  function motorW({ holding, moveFactor, phaseA, phaseOhm, phases }) {
    const hold = windingHoldW({ phaseA, phaseOhm, phases });
    if (!holding) return 0;
    const f = Number(moveFactor != null ? moveFactor : 1);
    if (!Number.isFinite(f) || f < 0) throw new Error('invalid motor factor');
    return hold * f;
  }

  // Daily energy. Firmware never disables coils and never deep-sleeps.
  // selfLocking means a worm/brake can drop motor current to 0 after a move.
  function dailyEnergy(input) {
    const moves = Number(input.movesPerDay != null ? input.movesPerDay : 0);
    const moveSec = Number(input.moveDurationSec != null ? input.moveDurationSec : 1);
    const selfLocking = Boolean(input.selfLocking);
    const wifiOn = input.wifiOn !== false;
    const disableCoilsWhenIdle = Boolean(input.disableCoilsWhenIdle);
    const phaseA = input.phaseA;
    const phaseOhm = input.phaseOhm;

    if (![moves, moveSec].every(Number.isFinite) || moves < 0 || moveSec < 0) {
      throw new Error('invalid daily-energy inputs');
    }

    const logic = logicW({ wifiOn, sensorsOn: true, sensorCount: 2 });
    const hold = windingHoldW({ phaseA, phaseOhm });
    const moveW = hold * 1.15;
    const movingHours = (moves * moveSec) / 3600;
    const idleHours = Math.max(0, 24 - movingHours);

    const coilsIdle = selfLocking || disableCoilsWhenIdle ? 0 : hold;
    const motorWh = moveW * movingHours + coilsIdle * idleHours;
    const logicWh = logic * 24;
    const totalWh = motorWh + logicWh;

    let kind = 'hold-dominates';
    if (selfLocking || disableCoilsWhenIdle) {
      kind = motorWh < logicWh ? 'mcu-is-rounding-error' : 'worm-saves-energy';
    }
    if (hold > USB_5V_BUDGET_W) {
      // USB cannot be the motor rail even before we talk about daily Wh.
    }

    return {
      logicW: logic,
      holdW: hold,
      moveW,
      movingHours,
      idleHours,
      motorWh,
      logicWh,
      totalWh,
      usbBudgetW: USB_5V_BUDGET_W,
      usbCanFeedMotor: hold <= USB_5V_BUDGET_W,
      coilsIdle,
      selfLocking,
      kind,
    };
  }

  function verdict(result) {
    if (!result.usbCanFeedMotor && result.coilsIdle > 0) return 'usb-cannot-hold';
    if (!result.usbCanFeedMotor && result.coilsIdle === 0) return 'usb-cannot-move';
    return result.kind;
  }

  function sizeBudget(input) {
    const r = dailyEnergy(input || {});
    return Object.assign({}, r, { verdict: verdict(r) });
  }

  // Instantaneous draw, still datasheet-class. Chopped 12 V average
  // current is P/V — not the 1.5 A phase rating. Peak coil current is
  // the thing a PSU / pack must survive for a few hundred ms.
  function currentDraw(input) {
    const wifiOn = input && input.wifiOn !== false;
    const sensorsOn = !input || input.sensorsOn !== false;
    const sensorCount = Number(input && input.sensorCount != null ? input.sensorCount : 2);
    const holding = Boolean(input && input.holding);
    const moving = Boolean(input && input.moving);
    const phaseA = input && input.phaseA;
    const phaseOhm = input && input.phaseOhm;
    const moveFactor = Number(input && input.moveFactor != null ? input.moveFactor : 1.15);

    if (!Number.isFinite(sensorCount) || sensorCount < 0) throw new Error('invalid current-draw inputs');
    if (!Number.isFinite(moveFactor) || moveFactor < 0) throw new Error('invalid current-draw inputs');

    const wifiMa = wifiOn ? ESP32_WIFI_MA : ESP32_MODEM_SLEEP_MA;
    const sensorMa = sensorCount * (sensorsOn ? BH1750_ACTIVE_MA : BH1750_POWERDOWN_MA);
    const logicMa = wifiMa + sensorMa + A4988_LOGIC_MA;
    const logic = (logicMa / 1000) * LOGIC_V;
    const hold = windingHoldW({ phaseA, phaseOhm });
    const coilsOn = holding || moving;
    const motor = coilsOn ? hold * (moving ? moveFactor : 1) : 0;
    const motor12vAvgMa = motor > 0 ? (motor / MOTOR_V) * 1000 : 0;
    const motorPhasePeakMa = coilsOn
      ? NEMA17_PHASE_A * 1000 * (moving ? moveFactor : 1)
      : 0;

    let mode = 'idle-worm';
    if (moving) mode = 'moving';
    else if (holding && wifiOn) mode = 'idle-hold';
    else if (holding && !wifiOn) mode = 'wifi-sleep-hold';
    else if (!holding && !wifiOn) mode = 'wifi-sleep-worm';

    return {
      mode,
      wifiOn,
      holding: coilsOn && !moving,
      moving,
      wifiMa,
      sensorMa,
      driverLogicMa: A4988_LOGIC_MA,
      logic3v3Ma: logicMa,
      motor12vAvgMa,
      motorPhasePeakMa,
      logicW: logic,
      motorW: motor,
      totalW: logic + motor,
      usbBudgetW: USB_5V_BUDGET_W,
      usbCanFeed: logic + motor <= USB_5V_BUDGET_W,
    };
  }

  function drawModes() {
    return Object.freeze({
      'idle-hold': currentDraw({ wifiOn: true, holding: true, moving: false }),
      'idle-worm': currentDraw({ wifiOn: true, holding: false, moving: false }),
      moving: currentDraw({ wifiOn: true, holding: true, moving: true }),
      'wifi-sleep-hold': currentDraw({ wifiOn: false, holding: true, moving: false }),
    });
  }

  // Pack figures are typical retail labels, not a cell we discharged.
  // cellWh is the chemistry energy (≈ 3.7 V × Ah). Marketing 5 V·Ah is larger.
  const PACKS = Object.freeze([
    Object.freeze({
      id: 'usb-10ah',
      label: 'פאוורבנק USB ‏10,000 mAh',
      cellWh: 37,
      railV: 5,
      maxA: 2.4,
      canMotor12v: false,
      note: 'התאים הם ~3.7 V × 10 Ah ≈ 37 Wh. היציאה 5 V לא מזינה VMOT.',
    }),
    Object.freeze({
      id: '2s18650',
      label: '2×18650 (2S, ~2,500 mAh)',
      cellWh: 18.5,
      railV: 7.4,
      maxA: 5,
      canMotor12v: false,
      note: 'שני תאים בטור. עדיין מתחת ל־12 V של המנהל.',
    }),
    Object.freeze({
      id: '3s2200',
      label: 'LiPo 3S 2,200 mAh',
      cellWh: 24.4,
      railV: 11.1,
      maxA: 22,
      canMotor12v: true,
      note: '3S טעון ~12.6 V יכול להזין A4988. לא נמדד.',
    }),
    Object.freeze({
      id: 'pb12-7ah',
      label: 'עופרת 12 V 7 Ah (UPS)',
      cellWh: 84,
      railV: 12,
      maxA: 7,
      canMotor12v: true,
      note: 'סוללת גיבוי טיפוסית. כבדה; מתאימה ל־hold ארוך יותר.',
    }),
  ]);

  function packById(id) {
    for (let i = 0; i < PACKS.length; i++) {
      if (PACKS[i].id === id) return PACKS[i];
    }
    return null;
  }

  function sizeBattery(input) {
    const src = input || {};
    const day = dailyEnergy(src);
    const hoursWanted = Number(src.hoursWanted != null ? src.hoursWanted : 24);
    const dod = Number(src.dod != null ? src.dod : 0.8);
    const converterEff = Number(src.converterEff != null ? src.converterEff : 0.85);
    if (![hoursWanted, dod, converterEff].every(Number.isFinite)
      || hoursWanted <= 0 || dod <= 0 || dod > 1 || converterEff <= 0 || converterEff > 1) {
      throw new Error('invalid battery inputs');
    }
    const pack = packById(src.packId) || PACKS[0];
    const wAvg = day.totalWh / 24;
    const requiredWh = (wAvg * hoursWanted) / (dod * converterEff);
    const usableWh = pack.cellWh * dod * converterEff;
    const hoursOnPack = wAvg > 0 ? usableWh / wAvg : Infinity;
    const peakW = day.moveW + day.logicW;
    const peakA = peakW / pack.railV;
    const packAh = pack.cellWh / pack.railV;
    const cRate = packAh > 0 ? peakA / packAh : Infinity;
    const motorNeeded = day.holdW > 0 || (src.movesPerDay || 0) > 0;

    let kind = 'hours-ok';
    if (!pack.canMotor12v && motorNeeded && day.holdW > 0) kind = 'pack-cannot-motor-rail';
    else if (!pack.canMotor12v && day.coilsIdle === 0 && day.moveW > 0) kind = 'pack-cannot-move-pulse';
    else if (day.coilsIdle > 0 && hoursOnPack < 6) kind = 'hold-kills-pack';
    else if (day.coilsIdle === 0 && hoursOnPack >= 12) kind = 'worm-makes-ups-viable';

    return {
      pack,
      wAvg,
      requiredWh,
      usableWh,
      hoursOnPack,
      hoursWanted,
      dod,
      converterEff,
      peakW,
      peakA,
      cRate,
      motorNeeded,
      canFeedMotorRail: pack.canMotor12v,
      kind,
      daily: day,
    };
  }

  return {
    LOGIC_V,
    MOTOR_V,
    USB_5V_BUDGET_W,
    ESP32_WIFI_MA,
    ESP32_MODEM_SLEEP_MA,
    BH1750_ACTIVE_MA,
    A4988_LOGIC_MA,
    NEMA17_PHASE_A,
    NEMA17_PHASE_OHM,
    NEMA17_PHASES,
    PACKS,
    windingHoldW,
    logicW,
    motorW,
    dailyEnergy,
    verdict,
    sizeBudget,
    currentDraw,
    drawModes,
    packById,
    sizeBattery,
  };
});
