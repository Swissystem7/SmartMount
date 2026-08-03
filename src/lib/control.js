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
// Panel limits are viewing-angle limits: an OLED washes out far sooner than a
// QLED, so it is allowed less tilt.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const PANEL_LIMITS = Object.freeze({ OLED: 20, QLED: 40, LED: 30 });
  const GLARE_THRESHOLD = 3.0;   // below this, ambient light is not glare
  const GAIN_DEG_PER_RATIO = 5.0;
  const DEADBAND_DEG = 1.0;      // ignore corrections smaller than this
  const MIN_LUX = 1.0;           // never divide by a dark sensor

  function glareRatio(luxTop, luxBot) {
    if (!Number.isFinite(luxTop) || !Number.isFinite(luxBot)) return null;
    // A BH1750 reports a negative value when a read fails; treat that as
    // "no reading" rather than as darkness, which would look like glare.
    if (luxTop < 0 || luxBot < 0) return null;
    return luxTop / Math.max(luxBot, MIN_LUX);
  }

  function calcOptimalAngle(luxTop, luxBot, panel = 'LED') {
    const limit = PANEL_LIMITS[panel];
    if (limit === undefined) throw new Error('unknown panel type: ' + panel);

    const ratio = glareRatio(luxTop, luxBot);
    if (ratio === null) return 0;              // bad reading: hold still
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

  return {
    calcOptimalAngle,
    glareRatio,
    shouldMove,
    clampToPanel,
    PANEL_LIMITS,
    GLARE_THRESHOLD,
    GAIN_DEG_PER_RATIO,
    DEADBAND_DEG,
  };
});
