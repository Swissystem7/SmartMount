// SmartMount — control-loop Gantt data for dashboard / runtime views.
//
// One glare response is: optional wait for the 2 s BH1750 poll, one sample
// loop() slice (handleClient + I²C + law + moveTo + run), then the AccelStepper
// envelope. timing.js owns the milliseconds; control.js owns the phase names;
// fsm.js supplies hold / moving when a snapshot is passed in.
(function (root, factory) {
  const control = (typeof module === 'object' && module.exports)
    ? require('./control')
    : root;
  const fsm = (typeof module === 'object' && module.exports)
    ? require('./fsm')
    : root.SM_FSM;
  const timing = (typeof module === 'object' && module.exports)
    ? require('./timing')
    : root.SM_TIMING;
  const api = factory(control, fsm, timing);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SM_GANTT = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (control, fsm, timing) {
  function controlLoopGantt(input) {
    const src = input || {};
    const fromDeg = Number(src.fromDeg != null ? src.fromDeg : 0);
    const toDeg = Number(src.toDeg != null ? src.toDeg : 20);
    const samplePhase01 = Number(src.samplePhase01 != null ? src.samplePhase01 : 0);
    const handleClientMs = Number(src.handleClientMs != null ? src.handleClientMs : 8);
    const i2cReadMs = Number(src.i2cReadMs != null ? src.i2cReadMs : 2);
    const thisLoopSamples = src.thisLoopSamples !== false;
    const snapshot = src.snapshot;

    const chain = timing.latencyChain({
      fromDeg,
      toDeg,
      samplePhase01,
      handleClientMs,
      i2cReadMs,
      samplePeriodMs: src.samplePeriodMs,
    });
    const move = chain.move;
    const phases = timing.loopPhases({
      handleClientMs,
      i2cReadMs,
      thisLoopSamples,
      vPeakSps: Math.max(move.vPeakSps, 1),
      samplePeriodMs: src.samplePeriodMs,
      lawMs: src.lawMs,
      moveToMs: src.moveToMs,
      runMs: src.runMs,
    });

    const fsmStatus = fsm.controlLoopFsmStatus(snapshot);
    const ganttData = [];
    let start = 0;

    if (chain.waitSampleMs > 0) {
      ganttData.push({
        name: control.LOOP_PHASE_LABELS.waitSample,
        start,
        duration: chain.waitSampleMs,
        status: control.loopPhaseGanttStatus('waitSample', fsmStatus),
      });
      start += chain.waitSampleMs;
    }

    for (let i = 0; i < phases.phases.length; i++) {
      const ph = phases.phases[i];
      if (ph.ms <= 0) continue;
      ganttData.push({
        name: control.LOOP_PHASE_LABELS[ph.id] || ph.label,
        start,
        duration: ph.ms,
        status: control.loopPhaseGanttStatus(ph.id, fsmStatus),
      });
      start += ph.ms;
    }

    if (chain.motorMs > 0) {
      ganttData.push({
        name: control.LOOP_PHASE_LABELS.motor,
        start,
        duration: chain.motorMs,
        status: control.loopPhaseGanttStatus('motor', fsmStatus),
      });
      start += chain.motorMs;
    }

    return {
      ganttData,
      totalMs: start,
      waitSampleMs: chain.waitSampleMs,
      motorMs: chain.motorMs,
      bottleneck: chain.bottleneck,
      summaryHe: chain.summaryHe,
    };
  }

  return {
    controlLoopGantt,
  };
});
