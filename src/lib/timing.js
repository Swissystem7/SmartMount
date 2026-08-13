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

  // One cooperative loop() as a Gantt the firmware actually runs:
  // handleClient always, I²C + law only on the 2 s sample, stepper.run
  // every pass. law/moveTo are tens of microseconds — rounding error
  // next to a blocking HTTP handler.
  function loopPhases(input) {
    const src = input || {};
    const http = Number(src.handleClientMs != null ? src.handleClientMs : 8);
    const i2c = Number(src.i2cReadMs != null ? src.i2cReadMs : 2);
    const lawMs = Number(src.lawMs != null ? src.lawMs : 0.05);
    const moveToMs = Number(src.moveToMs != null ? src.moveToMs : 0.02);
    const runMs = Number(src.runMs != null ? src.runMs : 0.02);
    const samplePeriodMs = Number(src.samplePeriodMs != null ? src.samplePeriodMs : SAMPLE_PERIOD_MS);
    const thisLoopSamples = src.thisLoopSamples !== false;
    const vPeakSps = Number(src.vPeakSps != null ? src.vPeakSps : MAX_SPEED_SPS);
    if (![http, i2c, lawMs, moveToMs, runMs, samplePeriodMs, vPeakSps].every(Number.isFinite)
      || http < 0 || i2c < 0 || lawMs < 0 || moveToMs < 0 || runMs < 0
      || samplePeriodMs <= 0 || vPeakSps <= 0) {
      throw new Error('invalid loop-phase inputs');
    }
    const phases = [
      { id: 'handleClient', label: 'handleClient()', ms: http, everyLoop: true },
      { id: 'i2c', label: 'BH1750 ×2', ms: thisLoopSamples ? i2c : 0, everyLoop: false },
      { id: 'law', label: 'calcOptimalAngle', ms: thisLoopSamples ? lawMs : 0, everyLoop: false },
      { id: 'moveTo', label: 'moveToAngle', ms: thisLoopSamples ? moveToMs : 0, everyLoop: false },
      { id: 'run', label: 'stepper.run()', ms: runMs, everyLoop: true },
    ];
    const busyMs = phases.reduce(function (a, p) { return a + p.ms; }, 0);
    const stepIntervalMs = 1000 / vPeakSps;
    return {
      phases,
      busyMs,
      samplePeriodMs,
      thisLoopSamples,
      idleUntilSampleMs: Math.max(0, samplePeriodMs - busyMs),
      stepIntervalMs,
      stepSlackMs: stepIntervalMs - busyMs,
      stepStarved: busyMs > stepIntervalMs,
      firmwareWdtConfigured: false,
    };
  }

  // Glare appears at a random phase of the 2 s poll, then I²C + law, then
  // the AccelStepper envelope. Best case: sample is due. Worst: just missed.
  function latencyChain(input) {
    const src = input || {};
    const fromDeg = Number(src.fromDeg != null ? src.fromDeg : 0);
    const toDeg = Number(src.toDeg != null ? src.toDeg : 20);
    const phase = Number(src.samplePhase01 != null ? src.samplePhase01 : 0);
    const handleClientMs = Number(src.handleClientMs != null ? src.handleClientMs : 8);
    const i2cReadMs = Number(src.i2cReadMs != null ? src.i2cReadMs : 2);
    const samplePeriodMs = Number(src.samplePeriodMs != null ? src.samplePeriodMs : SAMPLE_PERIOD_MS);
    if (![fromDeg, toDeg, phase, handleClientMs, i2cReadMs, samplePeriodMs].every(Number.isFinite)
      || phase < 0 || phase > 1 || handleClientMs < 0 || i2cReadMs < 0 || samplePeriodMs < 0) {
      throw new Error('invalid latency-chain inputs');
    }
    const move = moveProfile({ fromDeg, toDeg });
    const waitSampleMs = (1 - phase) * samplePeriodMs;
    const computeMs = handleClientMs + i2cReadMs;
    const motorMs = move.tTotalSec * 1000;
    const stages = [
      { id: 'wait-sample', label: 'המתנה לדגימה', ms: waitSampleMs },
      { id: 'sense-compute', label: 'I²C + חוק', ms: computeMs },
      { id: 'motor', label: 'מעטפת מנוע', ms: motorMs },
    ];
    const totalMs = waitSampleMs + computeMs + motorMs;
    let bottleneck = 'motor';
    if (waitSampleMs >= motorMs && waitSampleMs >= computeMs) bottleneck = 'sample';
    else if (computeMs >= motorMs && computeMs >= waitSampleMs) bottleneck = 'compute';
    return {
      stages,
      totalMs,
      waitSampleMs,
      computeMs,
      motorMs,
      bottleneck,
      move,
      samplePeriodMs,
    };
  }

  // Instantaneous sample in a uniform phase. A flash shorter than the
  // period can miss the BH1750 entirely — the law never sees it.
  function missProbability(input) {
    const flashMs = Number(input && input.flashMs);
    const periodMs = Number(input && input.periodMs != null ? input.periodMs : SAMPLE_PERIOD_MS);
    if (![flashMs, periodMs].every(Number.isFinite) || flashMs < 0 || periodMs <= 0) {
      throw new Error('invalid miss-probability inputs');
    }
    const miss = flashMs >= periodMs ? 0 : 1 - flashMs / periodMs;
    return {
      flashMs,
      periodMs,
      miss,
      hit: 1 - miss,
      alwaysSeen: flashMs >= periodMs,
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
    loopPhases,
    latencyChain,
    missProbability,
    typicalPanelMove,
  };
});
