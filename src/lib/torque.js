// SmartMount — pivot torque vs the NEMA17 + 1:5 the firmware assumes.
//
// Honest static model, not a FEA of a VESA arm:
//   τ_gravity = m · g · d · cos(θ)
//   θ = tilt from vertical (0° = screen upright, CoG is d in front of the pivot)
//   geared hold = motor_hold · gear · efficiency   (energized stepper only)
//
// A stepper's holding torque is ~0 when the driver is unpowered. Without a
// worm / brake the screen falls — that is the unsolved spec question, not a
// software bug. Numbers exist so a reviewer can see why ₪35–50 is not a mount.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SM_TORQUE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const G = 9.80665;
  const NEMA17_HOLD_NM = 0.45; // typical 17HS4401-class, not a specific SKU
  const DEFAULT_EFFICIENCY = 0.85; // spur / planetary. Worm is lower (~0.4–0.6)
  const DEFAULT_GEAR = 5; // firmware GEAR_RATIO

  const PRESETS = Object.freeze([
    Object.freeze({ id: '43', label: '43″', massKg: 8, cogCm: 6 }),
    Object.freeze({ id: '55', label: '55″', massKg: 18, cogCm: 8 }),
    Object.freeze({ id: '65', label: '65″', massKg: 28, cogCm: 10 }),
    Object.freeze({ id: '75', label: '75″', massKg: 35, cogCm: 12 }),
  ]);

  function gravityTorqueNm({ massKg, cogOffsetM, tiltFromVerticalDeg }) {
    const m = Number(massKg);
    const d = Number(cogOffsetM);
    const th = Number(tiltFromVerticalDeg);
    if (![m, d, th].every(Number.isFinite) || m < 0 || d <= 0) {
      throw new Error('invalid torque inputs');
    }
    return m * G * d * Math.cos((th * Math.PI) / 180);
  }

  function gearedHoldingNm({ motorHoldingNm, gearRatio, efficiency = DEFAULT_EFFICIENCY }) {
    const t = Number(motorHoldingNm);
    const g = Number(gearRatio);
    const e = Number(efficiency);
    if (![t, g, e].every(Number.isFinite) || t < 0 || g <= 0 || e <= 0 || e > 1) {
      throw new Error('invalid drivetrain inputs');
    }
    return t * g * e;
  }

  function safetyFactor(availableNm, requiredNm) {
    if (!Number.isFinite(availableNm) || !Number.isFinite(requiredNm)) {
      throw new Error('invalid safety-factor inputs');
    }
    if (requiredNm <= 0) return Infinity;
    return availableNm / requiredNm;
  }

  // Unpowered stepper hold is treated as 0. Self-locking (worm / brake) keeps
  // the last angle without motor current — the commercial-mount reason to exist.
  function verdict({ factor, selfLocking, unpowered }) {
    if (unpowered && !selfLocking) return 'drop-on-power-loss';
    if (factor < 1) return 'cannot-hold';
    if (factor < 2) return 'marginal';
    return 'holds';
  }

  function sizeMount(input) {
    const massKg = Number(input.massKg);
    const cogOffsetM = Number(input.cogOffsetM);
    const tiltFromVerticalDeg = Number(input.tiltFromVerticalDeg || 0);
    const motorHoldingNm = Number(input.motorHoldingNm != null ? input.motorHoldingNm : NEMA17_HOLD_NM);
    const gearRatio = Number(input.gearRatio != null ? input.gearRatio : DEFAULT_GEAR);
    const efficiency = Number(input.efficiency != null ? input.efficiency : DEFAULT_EFFICIENCY);
    const selfLocking = Boolean(input.selfLocking);

    const requiredNm = gravityTorqueNm({ massKg, cogOffsetM, tiltFromVerticalDeg });
    const availableNm = gearedHoldingNm({ motorHoldingNm, gearRatio, efficiency });
    const factor = safetyFactor(availableNm, requiredNm);
    const powered = verdict({ factor, selfLocking, unpowered: false });
    const unpowered = verdict({ factor, selfLocking, unpowered: true });

    return {
      requiredNm,
      availableNm,
      safetyFactor: factor,
      powered,
      unpowered,
      selfLocking,
    };
  }

  return {
    G,
    NEMA17_HOLD_NM,
    DEFAULT_EFFICIENCY,
    DEFAULT_GEAR,
    PRESETS,
    gravityTorqueNm,
    gearedHoldingNm,
    safetyFactor,
    verdict,
    sizeMount,
  };
});
