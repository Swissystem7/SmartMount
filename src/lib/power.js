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
    windingHoldW,
    logicW,
    motorW,
    dailyEnergy,
    verdict,
    sizeBudget,
  };
});
