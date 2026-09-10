// SmartMount — deterministic anti-oscillation study for the tilt decision.
//
// WHAT THIS IS NOT: firmware/smart_mount.ino has no hysteresis and no
// temporal filter. It reads two BH1750s every 2 s, runs calcOptimalAngle()
// on the raw pair and moves when the correction clears DEADBAND_DEG. This
// file does NOT mirror the .ino — src/lib/control.js is the mirror, and
// test/hysteresis.test.js asserts that the .ino still contains none of this.
//
// WHAT THIS IS: a pure, finite, offline replay. Feed it an array of glare
// ratios (luxTop / max(luxBot, MIN_LUX)) and it returns, per sample, what a
// controller with (a) a fixed-width moving average and (b) an enter/exit
// hysteresis band would have done. It exists to answer one question with a
// number instead of a hand wave: how many motor moves does a sequence that
// hovers on the threshold command, with and without those two mechanisms.
//
// The band and the window are NOT in config/control-params.json on purpose.
// That JSON generates the constants block inside the .ino, and putting a
// hysteresis constant there would compile a parameter the firmware never
// reads. The enter threshold, the gain, the panel caps and the deadband do
// come from the bridge, because those the firmware really uses.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SM_HYSTERESIS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const C = (typeof module === 'object' && module.exports)
    ? require('./control')
    : globalThis;

  // Width of the band below the enter threshold. 0.5 of a ratio unit is
  // 10% of the 3.0 threshold — chosen, not measured; nothing was calibrated.
  const DEFAULT_BAND = 0.5;
  // Samples in the moving average. At the firmware's 2 s poll, 3 samples is
  // a 6 s window: long enough to swallow a passing cloud shadow, short
  // enough that a real glare event still lands inside one ad break.
  const DEFAULT_WINDOW = 3;

  const IDLE = 'idle';
  const ENGAGED = 'engaged';

  function mean(values) {
    let sum = 0;
    for (let i = 0; i < values.length; i++) sum = sum + values[i];
    return sum / values.length;
  }

  // A ratio is usable only if it is finite and non-negative. glareRatio() in
  // control.js already returns null for a failed BH1750 read; a null, a NaN
  // or a negative here means the same thing and is treated the same way the
  // .ino treats it: hold, never slam.
  function isUsable(ratio) {
    return Number.isFinite(ratio) && ratio >= 0;
  }

  function resolveParams(params) {
    const p = params || {};
    const panel = p.panel != null ? p.panel : 'LED';
    const limit = C.PANEL_LIMITS[panel];
    if (limit === undefined) throw new Error('unknown panel type: ' + panel);

    const enter = Number(p.enter != null ? p.enter : C.GLARE_THRESHOLD);
    const band = Number(p.band != null ? p.band : DEFAULT_BAND);
    const window = Number(p.window != null ? p.window : DEFAULT_WINDOW);
    const gain = Number(p.gain != null ? p.gain : C.GAIN_DEG_PER_RATIO);
    const deadband = Number(p.deadband != null ? p.deadband : C.DEADBAND_DEG);

    if (![enter, band, gain, deadband].every(Number.isFinite)) {
      throw new Error('invalid hysteresis params');
    }
    if (enter <= 0) throw new Error('invalid hysteresis params');
    if (band < 0 || band >= enter) throw new Error('invalid hysteresis band');
    if (!Number.isInteger(window) || window < 1) throw new Error('invalid filter window');
    if (gain < 0 || deadband < 0) throw new Error('invalid hysteresis params');

    return { panel, limit, enter, exit: enter - band, band, window, gain, deadband };
  }

  // computeTiltState(sequence, params)
  //   sequence: finite array of glare ratios, oldest first.
  //   returns { ...params, samples: [...], moves, finalState, finalAngle }
  //
  // Per sample:
  //   filtered = mean of the last `window` USABLE ratios, inclusive.
  //   idle -> engaged when filtered >  enter
  //   engaged -> idle when filtered <  exit      (= enter - band)
  //   target  = engaged ? clamp((filtered - enter) * gain, 0, panel limit) : 0
  //   commanded moves only when |target - commanded| > deadband — the same
  //   deadband test the .ino applies in loop().
  function computeTiltState(sequence, params) {
    if (!Array.isArray(sequence)) throw new Error('sequence must be an array');
    const cfg = resolveParams(params);

    const usable = [];
    let state = IDLE;
    let commanded = 0;
    let moves = 0;
    const samples = [];

    for (let i = 0; i < sequence.length; i++) {
      const raw = sequence[i];
      if (!isUsable(raw)) {
        // Hold: no filter update, no state change, no move.
        samples.push({
          index: i, raw: raw, filtered: null, usable: false,
          state: state, target: commanded, commanded: commanded, moved: false,
        });
        continue;
      }
      usable.push(raw);
      const filtered = mean(usable.slice(Math.max(0, usable.length - cfg.window)));

      if (state === IDLE) {
        if (filtered > cfg.enter) state = ENGAGED;
      } else if (filtered < cfg.exit) {
        state = IDLE;
      }

      const target = state === ENGAGED
        ? Math.min(Math.max((filtered - cfg.enter) * cfg.gain, 0), cfg.limit)
        : 0;
      const moved = Math.abs(target - commanded) > cfg.deadband;
      if (moved) {
        commanded = target;
        moves++;
      }

      samples.push({
        index: i, raw: raw, filtered: filtered, usable: true,
        state: state, target: target, commanded: commanded, moved: moved,
      });
    }

    return {
      panel: cfg.panel,
      limit: cfg.limit,
      enter: cfg.enter,
      exit: cfg.exit,
      band: cfg.band,
      window: cfg.window,
      gain: cfg.gain,
      deadband: cfg.deadband,
      samples: samples,
      moves: moves,
      finalState: state,
      finalAngle: commanded,
    };
  }

  // Convenience for the comparison the study exists to make: same sequence,
  // same panel, with and without the two mechanisms.
  function compareMechanisms(sequence, params) {
    const p = params || {};
    const withBoth = computeTiltState(sequence, p);
    const noBand = computeTiltState(sequence, Object.assign({}, p, { band: 0 }));
    const noFilter = computeTiltState(sequence, Object.assign({}, p, { window: 1 }));
    const flips = (r) => {
      let n = 0;
      for (let i = 1; i < r.samples.length; i++) {
        if (r.samples[i].state !== r.samples[i - 1].state) n++;
      }
      return n;
    };
    return {
      withBoth: withBoth,
      noBand: noBand,
      noFilter: noFilter,
      movesWithBoth: withBoth.moves,
      movesNoFilter: noFilter.moves,
      stateFlipsWithBoth: flips(withBoth),
      stateFlipsNoBand: flips(noBand),
    };
  }

  return {
    DEFAULT_BAND,
    DEFAULT_WINDOW,
    IDLE,
    ENGAGED,
    computeTiltState,
    compareMechanisms,
  };
});
