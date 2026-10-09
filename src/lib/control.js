// SmartMount — reference implementation of the tilt control law.
//
// This mirrors calcOptimalAngle() and the deadband in firmware/smart_mount.ino
// so the control law can be exercised on a laptop instead of only on a board
// with two light sensors taped to a television. If the firmware changes, this
// file and its tests change with it — that is the point.
//
// The law itself:
//   glareRatio = luxTop / max(luxBot, 1)      how much brighter the room side
//                                             is than the screen side
//   below GLARE_THRESHOLD  -> no tilt at all
//   above it               -> tilt GAIN degrees per unit of excess ratio,
//                             capped by what the panel can take
//
// OLED ~178° viewing angle; VA/LED wash out off-axis so they get a tighter tilt cap.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const P = (typeof module === 'object' && module.exports)
    ? require('./control-params')
    : globalThis.CONTROL_PARAMS;
  const PANEL_LIMITS = P.limits;
  const GLARE_THRESHOLD = P.glareThreshold;
  const GAIN_DEG_PER_RATIO = P.gainDegPerRatio;
  const DEADBAND_DEG = P.deadbandDeg;
  const MIN_LUX = P.minLux;

  function glareRatio(luxTop, luxBot) {
    if (!Number.isFinite(luxTop) || !Number.isFinite(luxBot)) return null;
    // A BH1750 reports a negative value when a read fails; treat that as
    // "no reading" rather than as darkness, which would look like glare.
    if (luxTop < 0 || luxBot < 0) return null;
    return luxTop / Math.max(luxBot, MIN_LUX);
  }

  function getPanelLimit(panel, customLimit) {
    if (typeof panel === 'object' && panel !== null) {
      if (customLimit === undefined) {
        customLimit = panel.limit ?? panel.maxAngle ?? panel.max;
      }
      panel = panel.type ?? panel.panel ?? panel.name ?? 'CUSTOM';
    }
    if (typeof customLimit === 'object' && customLimit !== null) {
      customLimit = customLimit.limit ?? customLimit.maxAngle ?? customLimit.max;
    }
    if (typeof customLimit === 'number' && Number.isFinite(customLimit)) {
      return { panel, limit: customLimit };
    }
    if (panel === 'CUSTOM' && customLimit !== undefined) {
      return { panel, limit: customLimit };
    }
    const limit = PANEL_LIMITS ? PANEL_LIMITS[panel] : undefined;
    return { panel, limit };
  }

  function calcOptimalAngle(luxTop, luxBot, panel = 'LED', targetAngle = 0, customLimit) {
    const { panel: panelType, limit } = getPanelLimit(panel, customLimit);
    if (limit === undefined) throw new Error('unknown panel type: ' + panelType);

    const ratio = glareRatio(luxTop, luxBot);
    // Firmware returns targetAngle — the commanded target — on a failed BH1750
    // read (hold, never slam). Mid-move currentAngle lags the target, and
    // returning it would make loop() reverse the stepper under load (#41).
    if (ratio === null) return targetAngle;
    if (ratio <= GLARE_THRESHOLD) return 0;

    return Math.min((ratio - GLARE_THRESHOLD) * GAIN_DEG_PER_RATIO, limit);
  }

  // The mount only moves when the correction is worth the noise and wear.
  function shouldMove(currentAngle, targetAngle) {
    return Math.abs(targetAngle - currentAngle) > DEADBAND_DEG;
  }

  function clampToPanel(angle, panel = 'LED', customLimit) {
    const { panel: panelType, limit } = getPanelLimit(panel, customLimit);
    if (limit === undefined) throw new Error('unknown panel type: ' + panelType);
    if (Number.isNaN(angle)) return 0;
    return Math.min(Math.max(angle, -limit), limit);
  }

  // The board does this arithmetic in float, not double: clamped is a float,
  // STEPS_PER_DEGREE is `const float`, so the product is a float32 before
  // lroundf sees it. Math.fround on both operands and on the product is the
  // same arithmetic. 0.9° is 2.5 steps in double but 2.4999998 on the board,
  // so the board commands 2 steps where a double would have rounded to 3.
  const STEPS_PER_DEGREE_F32 = Math.fround(P.stepsPerDegree);

  // lroundf rounds half away from zero: -4.5 → -5. Math.round rounds half
  // toward +∞: Math.round(-4.5) is -4. Every negative half-step (−1.62° is
  // −4.5 steps) landed one step short of the board until this was spelled out.
  function lroundf(x) {
    return Math.sign(x) * Math.floor(Math.abs(x) + 0.5);
  }

  // stepsFor — ino: (long)lroundf(clamped * STEPS_PER_DEGREE), float math.
  function stepsFor(deg) {
    return lroundf(Math.fround(Math.fround(deg) * STEPS_PER_DEGREE_F32));
  }

  // moveToAngle — ino: constrain then stepsFor, then read the target back.
  // target is what the board stores in targetAngle and reports in /status:
  // the commanded step divided by the float STEPS_PER_DEGREE (long / float is
  // a float), so a request of 12.3° on a 1000-step rev reports 12.24 (as a
  // float32) and equals currentAngle, computed the same way, once the move ends.
  function moveToAngle(deg, panel = 'LED', customLimit) {
    const clamped = clampToPanel(deg, panel, customLimit);
    const steps = stepsFor(clamped);
    return { clamped: clamped, steps: steps, target: Math.fround(steps / STEPS_PER_DEGREE_F32) };
  }

  // No schedule, cloud, or calibration — those are not in the .ino.
  return {
    calcOptimalAngle,
    glareRatio,
    shouldMove,
    clampToPanel,
    lroundf,
    stepsFor,
    moveToAngle,
    STEPS_PER_DEGREE_F32,
    PANEL_LIMITS,
    GLARE_THRESHOLD,
    GAIN_DEG_PER_RATIO,
    DEADBAND_DEG,
  };
});
