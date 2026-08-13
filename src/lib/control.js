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
  function shouldMove(currentAngle, targetAngle) {
    return Math.abs(targetAngle - currentAngle) > DEADBAND_DEG;
  }

  function clampToPanel(angle, panel = 'LED') {
    const limit = PANEL_LIMITS[panel];
    if (limit === undefined) throw new Error('unknown panel type: ' + panel);
    return Math.min(Math.max(angle, -limit), limit);
  }

  // moveToAngle — ino: constrain then lroundf(deg * STEPS_PER_DEGREE).
  // JS Math.round matches lroundf for the half-away-from-zero cases we hit.
  function moveToAngle(deg, panel = 'LED') {
    const clamped = clampToPanel(deg, panel);
    return { clamped: clamped, steps: Math.round(clamped * P.stepsPerDegree) };
  }

  // No schedule, cloud, or calibration — those are not in the .ino.
  return {
    calcOptimalAngle,
    glareRatio,
    shouldMove,
    clampToPanel,
    moveToAngle,
    PANEL_LIMITS,
    GLARE_THRESHOLD,
    GAIN_DEG_PER_RATIO,
    DEADBAND_DEG,
  };
});
