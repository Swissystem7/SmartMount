'use strict';

// glareTilt: smallest angular difference between two azimuths (0-360, wraparound),
// clamped to [0,45]. NaN input -> 0.
function glareTilt(sunAzimuth, screenAzimuth) {
  if (Number.isNaN(sunAzimuth) || Number.isNaN(screenAzimuth)) return 0;
  let d = Math.abs(sunAzimuth - screenAzimuth) % 360;
  if (d > 180) d = 360 - d;
  return Math.min(d, 45);
}

module.exports = { glareTilt };
