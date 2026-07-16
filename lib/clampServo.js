'use strict';

// clampServo(angle): clamp to [0,180], round to integer. NaN -> 90.
function clampServo(angle) {
  const n = Number(angle);
  if (Number.isNaN(n)) return 90;
  if (n <= 0) return 0;
  if (n >= 180) return 180;
  return Math.round(n);
}

module.exports = { clampServo };
