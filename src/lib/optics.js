// SmartMount — why two lux readings are not "how bright the glare looks".
//
// BH1750 reports illuminance E (lux) = lumens per m² incident on the chip.
// A viewer sees luminance L (cd/m²) of a surface in a direction.
//
// Specular highlight luminance ≈ source luminance × reflectance.
// A small distant lamp can miss both sensors (ratio stays below threshold)
// and still put a high-nits spot into the eye. That is the documented limit
// of calcOptimalAngle — not a missing if-statement.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SM_OPTICS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DEFAULT_THRESHOLD = 3;
  const SDR_CONTENT_NITS = 150;
  // Glossy cover glass ~4–8% per air-glass surface; matte / Glare Free is lower.
  const GLOSSY_R = 0.06;
  const MATTE_R = 0.015;

  function sourceIntensityCd(luminanceNits, areaM2) {
    const L = Number(luminanceNits);
    const A = Number(areaM2);
    if (![L, A].every(Number.isFinite) || L < 0 || A < 0) {
      throw new Error('invalid source');
    }
    // Lambertian toward the sensor: I ≈ L · A
    return L * A;
  }

  function illuminanceLux({ ambientLux, intensityCd, distanceM }) {
    const E0 = Number(ambientLux);
    const I = Number(intensityCd);
    const r = Number(distanceM);
    if (![E0, I, r].every(Number.isFinite) || E0 < 0 || I < 0 || r <= 0) {
      throw new Error('invalid illuminance inputs');
    }
    return E0 + I / (r * r);
  }

  function highlightNits({ sourceLuminanceNits, reflectance, rayHitsEye }) {
    const L = Number(sourceLuminanceNits);
    const R = Number(reflectance);
    if (![L, R].every(Number.isFinite) || L < 0 || R < 0 || R > 1) {
      throw new Error('invalid highlight inputs');
    }
    if (!rayHitsEye) return 0;
    return L * R;
  }

  function sensorRatio(luxTop, luxBot, minLux = 1) {
    if (!Number.isFinite(luxTop) || !Number.isFinite(luxBot)) return null;
    if (luxTop < 0 || luxBot < 0) return null;
    return luxTop / Math.max(luxBot, minLux);
  }

  // Highlight competes with content when it is a large fraction of SDR nits.
  function viewerGlare(highlight, contentNits = SDR_CONTENT_NITS) {
    return highlight > contentNits * 0.3;
  }

  // Every label below is a claim about BOTH halves of the comparison: what
  // the sensor pair told the control law, and what the viewer's eye got. If
  // either half is outside its domain the honest answer is 'unknown'.
  //
  // Non-finite highlight already returned 'unknown'. What did not: an
  // unreadable or out-of-domain SENSOR pair. sensorRatio() returns null for a
  // negative or non-finite lux — the BH1750's failed-read signature — and the
  // old code folded that null into "the law is quiet", so a dead sensor next
  // to a calm room came back 'agrees-clear' and a dead sensor next to a
  // blinding highlight came back 'blind-but-quiet'. Both read as a verdict
  // about the control law when in fact there was no reading to judge it on.
  function disagreement({
    luxTop,
    luxBot,
    threshold = DEFAULT_THRESHOLD,
    highlight,
    contentNits = SDR_CONTENT_NITS,
  }) {
    // A highlight is a luminance: finite and non-negative or we know nothing.
    if (!Number.isFinite(highlight) || highlight < 0) return 'unknown';
    // A ratio threshold of 0 or below would make every reading "glare", and a
    // content luminance of 0 would make every highlight infinitely dominant.
    if (!Number.isFinite(threshold) || threshold <= 0) return 'unknown';
    if (!Number.isFinite(contentNits) || contentNits <= 0) return 'unknown';
    const ratio = sensorRatio(luxTop, luxBot);
    if (ratio === null) return 'unknown';
    const lawMoves = ratio > threshold;
    const eye = viewerGlare(highlight, contentNits);
    if (!lawMoves && eye) return 'blind-but-quiet';
    if (lawMoves && !eye) return 'tilts-for-nothing';
    if (lawMoves && eye) return 'agrees-glare';
    return 'agrees-clear';
  }

  function sampleScene(input) {
    const sourceNits = Number(input.sourceNits);
    const sourceAreaM2 = Number(input.sourceAreaM2);
    const distanceTopM = Number(input.distanceTopM);
    const distanceBotM = Number(input.distanceBotM);
    const ambientTop = Number(input.ambientTop);
    const ambientBot = Number(input.ambientBot);
    const reflectance = Number(input.reflectance);
    const rayHitsEye = Boolean(input.rayHitsEye);
    const threshold = input.threshold != null ? Number(input.threshold) : DEFAULT_THRESHOLD;
    const contentNits = input.contentNits != null ? Number(input.contentNits) : SDR_CONTENT_NITS;

    const I = sourceIntensityCd(sourceNits, sourceAreaM2);
    const luxTop = illuminanceLux({ ambientLux: ambientTop, intensityCd: I, distanceM: distanceTopM });
    // Bottom sensor faces the panel. It does not see the source directly unless
    // the caller puts a short distanceBotM. Default scenes keep it near ambient.
    const luxBot = illuminanceLux({
      ambientLux: ambientBot,
      intensityCd: I * Number(input.botCoupling != null ? input.botCoupling : 0.05),
      distanceM: distanceBotM,
    });
    const highlight = highlightNits({
      sourceLuminanceNits: sourceNits,
      reflectance,
      rayHitsEye,
    });
    const ratio = sensorRatio(luxTop, luxBot);
    const kind = disagreement({ luxTop, luxBot, threshold, highlight, contentNits });

    return { intensityCd: I, luxTop, luxBot, ratio, highlight, kind, threshold, contentNits };
  }

  // The complete set a caller — including geometry/index.html — has to handle.
  const KINDS = Object.freeze([
    'agrees-clear',
    'agrees-glare',
    'blind-but-quiet',
    'tilts-for-nothing',
    'unknown',
  ]);

  return {
    KINDS,
    DEFAULT_THRESHOLD,
    SDR_CONTENT_NITS,
    GLOSSY_R,
    MATTE_R,
    sourceIntensityCd,
    illuminanceLux,
    highlightNits,
    sensorRatio,
    viewerGlare,
    disagreement,
    sampleScene,
  };
});
