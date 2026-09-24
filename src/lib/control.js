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

  function calcOptimalAngle(luxTop, luxBot, panel = 'LED', currentAngle = 0) {
    const limit = PANEL_LIMITS[panel];
    if (limit === undefined) throw new Error('unknown panel type: ' + panel);

    const ratio = glareRatio(luxTop, luxBot);
    // Firmware returns currentAngle on a failed BH1750 read (hold, never slam).
    if (ratio === null) return currentAngle;
    if (ratio <= GLARE_THRESHOLD) return 0;

    return Math.min((ratio - GLARE_THRESHOLD) * GAIN_DEG_PER_RATIO, limit);
  }

  // The mount only moves when the correction is worth the noise and wear.
  // Firmware deadband (loop): abs(next - currentAngle) > DEADBAND_DEG where
  // currentAngle = stepper.currentPosition() / STEPS_PER_DEGREE after lroundf
  // moveTo. Comparing against the commanded float (e.g. 20) desyncs from the
  // board's live angle (56/SPD ≈ 20.16) and can flip the move/hold decision.
  function liveAngleFromCommand(deg) {
    const steps = lroundf(Number(deg) * P.stepsPerDegree);
    return steps / P.stepsPerDegree;
  }

  function shouldMove(currentAngle, targetAngle) {
    const live = liveAngleFromCommand(currentAngle);
    return Math.abs(Number(targetAngle) - live) > DEADBAND_DEG;
  }

  function clampToPanel(angle, panel = 'LED') {
    const limit = PANEL_LIMITS[panel];
    if (limit === undefined) throw new Error('unknown panel type: ' + panel);
    return Math.min(Math.max(angle, -limit), limit);
  }

  // moveToAngle — ino: constrain then lroundf(deg * STEPS_PER_DEGREE).
  // C lroundf rounds halfway *away from zero*. ES Math.round is half-toward-+∞
  // (Math.round(-0.5) === 0), so a naive Math.round desyncs negative half-steps
  // from the AccelStepper pulse count the board actually queues.
  function lroundf(x) {
    return x < 0 ? -Math.round(-x) : Math.round(x);
  }

  function moveToAngle(deg, panel = 'LED') {
    const clamped = clampToPanel(deg, panel);
    return { clamped: clamped, steps: lroundf(clamped * P.stepsPerDegree) };
  }

  // No schedule, cloud, or calibration — those are not in the .ino.
  return {
    calcOptimalAngle,
    glareRatio,
    shouldMove,
    liveAngleFromCommand,
    clampToPanel,
    moveToAngle,
    PANEL_LIMITS,
    GLARE_THRESHOLD,
    GAIN_DEG_PER_RATIO,
    DEADBAND_DEG,
  };
});
