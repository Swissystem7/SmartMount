// SmartMount — AccelStepper timing + cooperative-loop budget.
//
// Firmware (smart_mount.ino):
//   stepper.setMaxSpeed(500);        // steps / s
//   stepper.setAcceleration(200);    // steps / s²
//   sample every 2000 ms
//   WiFi connect blocks with delay(200) up to 10 s — before loop()
//
// Host model of a trapezoid / triangle. AccelStepper is discrete; this is
// the continuous envelope an interviewer can compute on a whiteboard.
// Not a scope capture. The board has never been timed.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SM_TIMING = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const MAX_SPEED_SPS = 500;
  const ACCEL_SPS2 = 200;
  const SAMPLE_PERIOD_MS = 2000;
  const WIFI_CONNECT_TIMEOUT_MS = 10000;
  const WIFI_POLL_MS = 200;
  const STEPS_PER_REV = 200;
  const GEAR_RATIO = 5;
  const STEPS_PER_DEGREE = (STEPS_PER_REV * GEAR_RATIO) / 360;
  const DEFAULT_WDT_MS = 5000;

  function stepsForDeg(deg, stepsPerDegree) {
    const d = Number(deg);
    const k = Number(stepsPerDegree != null ? stepsPerDegree : STEPS_PER_DEGREE);
    if (![d, k].every(Number.isFinite) || k <= 0) throw new Error('invalid stepsForDeg');
    return Math.abs(d) * k;
  }

  function profile({ distanceSteps, vmax, accel }) {
    const s = Math.abs(Number(distanceSteps));
    const v = Number(vmax != null ? vmax : MAX_SPEED_SPS);
    const a = Number(accel != null ? accel : ACCEL_SPS2);
    if (![s, v, a].every(Number.isFinite) || v <= 0 || a <= 0) {
      throw new Error('invalid profile inputs');
    }
    if (s === 0) {
      return {
        kind: 'none',
        distanceSteps: 0,
        tAccelSec: 0,
        tCruiseSec: 0,
        tTotalSec: 0,
        vPeakSps: 0,
        stepsAccel: 0,
        stepsCruise: 0,
        hitsVmax: false,
      };
    }
    const tAccVmax = v / a;
    const sAccVmax = (v * v) / (2 * a);
    if (s >= 2 * sAccVmax) {
      const cruise = s - 2 * sAccVmax;
      return {
        kind: 'trapezoid',
        distanceSteps: s,
        tAccelSec: tAccVmax,
        tCruiseSec: cruise / v,
        tTotalSec: 2 * tAccVmax + cruise / v,
        vPeakSps: v,
        stepsAccel: sAccVmax,
        stepsCruise: cruise,
        hitsVmax: true,
      };
    }
    // Triangle: accel to mid-point, then decel. v_peak² = a · s
    const vPeak = Math.sqrt(a * s);
    const tAcc = vPeak / a;
    return {
      kind: 'triangle',
      distanceSteps: s,
      tAccelSec: tAcc,
      tCruiseSec: 0,
      tTotalSec: 2 * tAcc,
      vPeakSps: vPeak,
      stepsAccel: s / 2,
      stepsCruise: 0,
      hitsVmax: false,
    };
  }

  function moveProfile({ fromDeg, toDeg, stepsPerDegree, vmax, accel }) {
    const delta = Number(toDeg) - Number(fromDeg);
    if (![Number(fromDeg), Number(toDeg)].every(Number.isFinite)) {
      throw new Error('invalid angles');
    }
    const steps = stepsForDeg(delta, stepsPerDegree);
    const p = profile({ distanceSteps: steps, vmax, accel });
    return Object.assign({ fromDeg: Number(fromDeg), toDeg: Number(toDeg), deltaDeg: delta }, p);
  }

  // Glare appears at a random phase of the 2 s poll. Best case: sample is due.
  // Worst case: just missed a sample. Motor time sits on top of that.
  function glareLatency({ samplePeriodMs, moveSec, computeMs }) {
    const sample = Number(samplePeriodMs != null ? samplePeriodMs : SAMPLE_PERIOD_MS);
    const move = Number(moveSec);
    const compute = Number(computeMs != null ? computeMs : 0);
    if (![sample, move, compute].every(Number.isFinite) || sample < 0 || move < 0 || compute < 0) {
      throw new Error('invalid latency inputs');
    }
    const computeSec = compute / 1000;
    return {
      samplePeriodSec: sample / 1000,
      moveSec: move,
      computeSec,
      bestSec: move + computeSec,
      worstSec: sample / 1000 + move + computeSec,
      typicalSec: sample / 2000 + move + computeSec,
      sampleDominates: sample / 1000 > move,
    };
  }

  // AccelStepper run() must be called before the next step is due.
  // loop() is cooperative: handleClient() + a BH1750 read can starve pulses.
  // The Arduino core feeds the task WDT between loop iterations; a stuck
  // Wire transaction can starve both the stepper and the WDT.
  function loopBudget({ handleClientMs, i2cReadMs, vPeakSps, wdtMs }) {
    const http = Number(handleClientMs);
    const i2c = Number(i2cReadMs);
    const v = Number(vPeakSps != null ? vPeakSps : MAX_SPEED_SPS);
    const wdt = Number(wdtMs != null ? wdtMs : DEFAULT_WDT_MS);
    if (![http, i2c, v, wdt].every(Number.isFinite) || v <= 0 || wdt <= 0 || http < 0 || i2c < 0) {
      throw new Error('invalid loop-budget inputs');
    }
    const stepIntervalMs = 1000 / v;
    const loopMs = http + i2c;
    return {
      loopMs,
      stepIntervalMs,
      stepSlackMs: stepIntervalMs - loopMs,
      stepStarved: loopMs > stepIntervalMs,
      wdtMs: wdt,
      wdtTrip: loopMs > wdt,
      firmwareWdtConfigured: false,
    };
  }

  function wifiBlock({ connectedAfterMs, timeoutMs, pollMs }) {
    const t = Number(timeoutMs != null ? timeoutMs : WIFI_CONNECT_TIMEOUT_MS);
    const poll = Number(pollMs != null ? pollMs : WIFI_POLL_MS);
    const okAt = connectedAfterMs == null ? null : Number(connectedAfterMs);
    if (!Number.isFinite(t) || !Number.isFinite(poll) || t < 0 || poll <= 0) {
      throw new Error('invalid wifi-block inputs');
    }
    if (okAt != null && !Number.isFinite(okAt)) throw new Error('invalid wifi-block inputs');
    const blockedMs = okAt == null ? t : Math.min(okAt, t);
    const polls = Math.ceil(blockedMs / poll);
    return {
      blockedMs,
      polls,
      motorRunsDuringSetup: false,
      localAutoAfterTimeout: okAt == null || okAt >= t,
    };
  }

  // Typical panel moves in this firmware never reach 500 step/s — the
  // distance is too short. The 2 s poll, not the motor, is the plant lag.
  function typicalPanelMove(limitDeg, opts) {
    const p = moveProfile(Object.assign({
      fromDeg: 0,
      toDeg: Number(limitDeg),
    }, opts || {}));
    const lat = glareLatency({
      samplePeriodMs: (opts && opts.samplePeriodMs) || SAMPLE_PERIOD_MS,
      moveSec: p.tTotalSec,
    });
    return Object.assign({}, p, lat);
  }

  return {
    MAX_SPEED_SPS,
    ACCEL_SPS2,
    SAMPLE_PERIOD_MS,
    WIFI_CONNECT_TIMEOUT_MS,
    WIFI_POLL_MS,
    STEPS_PER_DEGREE,
    DEFAULT_WDT_MS,
    stepsForDeg,
    profile,
    moveProfile,
    glareLatency,
    loopBudget,
    wifiBlock,
    typicalPanelMove,
  };
});
