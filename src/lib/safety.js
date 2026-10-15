// SmartMount — assembly and wiring safety guidelines as data.
//
// Not a certification checklist. The board has never been wired on a bench.
// These entries exist so a builder sees electrical and mechanical hazards
// before powering a prototype — not so npm test claims UL/TÜV compliance.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SM_SAFETY = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function freezeGuidelines(items) {
    return Object.freeze(items.map((item) => Object.freeze({ ...item })));
  }

  const SAFETY_GUIDELINES = Object.freeze({
    electrical: freezeGuidelines([
      {
        id: 'ELEC-01',
        category: 'electrical',
        hazard: 'Short circuits and reverse polarity during power wiring',
        mitigation:
          'Disconnect all power sources before wiring and verify supply polarity with a multimeter prior to connection.',
        action:
          'Disconnect all power sources before wiring and verify supply polarity with a multimeter prior to connection.',
        step:
          'Disconnect all power sources before wiring and verify supply polarity with a multimeter prior to connection.',
      },
      {
        id: 'ELEC-02',
        category: 'electrical',
        hazard: 'Motor driver overcurrent and excessive thermal dissipation',
        mitigation:
          'Set driver reference voltage (Vref) to rated current limits and attach heatsinks with forced airflow cooling.',
        action:
          'Set driver reference voltage (Vref) to rated current limits and attach heatsinks with forced airflow cooling.',
        step:
          'Set driver reference voltage (Vref) to rated current limits and attach heatsinks with forced airflow cooling.',
      },
      {
        id: 'ELEC-03',
        category: 'electrical',
        hazard: 'Electrostatic discharge (ESD) damaging sensitive control electronics',
        mitigation:
          'Wear an anti-static wrist strap grounded to earth and handle printed circuit boards strictly by the edges.',
        action:
          'Wear an anti-static wrist strap grounded to earth and handle printed circuit boards strictly by the edges.',
        step:
          'Wear an anti-static wrist strap grounded to earth and handle printed circuit boards strictly by the edges.',
      },
      {
        id: 'ELEC-04',
        category: 'electrical',
        hazard: 'AC mains shock from uninsulated power supply terminals',
        mitigation:
          'Use fully enclosed certified power supplies and protect high-voltage terminals with insulated boots or covers.',
        action:
          'Use fully enclosed certified power supplies and protect high-voltage terminals with insulated boots or covers.',
        step:
          'Use fully enclosed certified power supplies and protect high-voltage terminals with insulated boots or covers.',
      },
    ]),
    mechanical: freezeGuidelines([
      {
        id: 'MECH-01',
        category: 'mechanical',
        hazard: 'Pinch points and hand entrapment in drive gears and timing belts',
        mitigation:
          'Keep hands and loose clothing clear of moving assemblies and install protective gear guards before powering axes.',
        action:
          'Keep hands and loose clothing clear of moving assemblies and install protective gear guards before powering axes.',
        step:
          'Keep hands and loose clothing clear of moving assemblies and install protective gear guards before powering axes.',
      },
      {
        id: 'MECH-02',
        category: 'mechanical',
        hazard: 'Unbalanced payload causing sudden uncontrolled axis swing or tipping',
        mitigation:
          'Securely clamp the mount to a rigid base and achieve neutral balance on altitude and azimuth axes before releasing clutches.',
        action:
          'Securely clamp the mount to a rigid base and achieve neutral balance on altitude and azimuth axes before releasing clutches.',
        step:
          'Securely clamp the mount to a rigid base and achieve neutral balance on altitude and azimuth axes before releasing clutches.',
      },
      {
        id: 'MECH-03',
        category: 'mechanical',
        hazard: 'Thread stripping in aluminum and 3D printed components from overtightening',
        mitigation:
          'Use calibrated torque tools and thread-locking compound where specified rather than excessive manual tightening.',
        action:
          'Use calibrated torque tools and thread-locking compound where specified rather than excessive manual tightening.',
        step:
          'Use calibrated torque tools and thread-locking compound where specified rather than excessive manual tightening.',
      },
      {
        id: 'MECH-04',
        category: 'mechanical',
        hazard: 'Over-travel collision with mechanical stops damaging optical payload',
        mitigation:
          'Configure software limits and verify endstop limit switch triggering at low speed before running full slews.',
        action:
          'Configure software limits and verify endstop limit switch triggering at low speed before running full slews.',
        step:
          'Configure software limits and verify endstop limit switch triggering at low speed before running full slews.',
      },
    ]),
  });

  function getSafetyGuidelines() {
    return {
      electrical: SAFETY_GUIDELINES.electrical.map((item) => ({ ...item })),
      mechanical: SAFETY_GUIDELINES.mechanical.map((item) => ({ ...item })),
    };
  }

  return {
    SAFETY_GUIDELINES,
    getSafetyGuidelines,
  };
});
