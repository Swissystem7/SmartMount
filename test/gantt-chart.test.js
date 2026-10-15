const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../src/lib/gantt-chart');
const C = require('../src/lib/control');
const F = require('../src/lib/fsm');
const T = require('../src/lib/timing');

function assertTaskShape(task) {
  assert.equal(typeof task.name, 'string');
  assert.ok(Number.isFinite(task.start));
  assert.ok(Number.isFinite(task.duration));
  assert.equal(typeof task.status, 'string');
}

test('controlLoopGantt returns ganttData tasks for the control-loop latency chain', () => {
  const r = G.controlLoopGantt({ fromDeg: 0, toDeg: 20, samplePhase01: 0 });
  assert.ok(Array.isArray(r.ganttData));
  assert.ok(r.ganttData.length >= 3);
  for (const task of r.ganttData) assertTaskShape(task);

  const chain = T.latencyChain({ fromDeg: 0, toDeg: 20, samplePhase01: 0 });
  const move = chain.move;
  const phases = T.loopPhases({ vPeakSps: Math.max(move.vPeakSps, 1) });
  const span = r.ganttData.reduce((end, t) => Math.max(end, t.start + t.duration), 0);
  assert.equal(span, chain.waitSampleMs + phases.busyMs + chain.motorMs);
  assert.equal(r.totalMs, span);
});

test('sample-wait delay appears when the poll was just missed', () => {
  const r = G.controlLoopGantt({ fromDeg: 0, toDeg: 20, samplePhase01: 0 });
  assert.equal(r.ganttData[0].name, C.LOOP_PHASE_LABELS.waitSample);
  assert.equal(r.ganttData[0].duration, 2000);
  assert.equal(r.ganttData[0].status, 'delay');
  assert.equal(r.ganttData[0].start, 0);

  const due = G.controlLoopGantt({ fromDeg: 0, toDeg: 20, samplePhase01: 1 });
  assert.ok(!due.ganttData.some((t) => t.name === C.LOOP_PHASE_LABELS.waitSample));
});

test('in-loop phases use control labels and stack after any wait', () => {
  const r = G.controlLoopGantt({
    fromDeg: 0, toDeg: 20, samplePhase01: 1, handleClientMs: 8, i2cReadMs: 2,
  });
  const law = r.ganttData.find((t) => t.name === C.LOOP_PHASE_LABELS.law);
  const motor = r.ganttData.find((t) => t.name === C.LOOP_PHASE_LABELS.motor);
  assert.ok(law);
  assert.ok(motor);
  assert.equal(law.status, 'control');
  assert.equal(motor.status, 'moving');
  assert.ok(law.start < motor.start);
});

test('FSM sensor hold marks control phases as hold', () => {
  let s = F.firmwareBoot(true);
  s = F.step(s, { type: 'SENSOR_FAIL' });
  const r = G.controlLoopGantt({
    fromDeg: 0, toDeg: 20, samplePhase01: 1, snapshot: s,
  });
  const law = r.ganttData.find((t) => t.name === C.LOOP_PHASE_LABELS.law);
  const moveTo = r.ganttData.find((t) => t.name === C.LOOP_PHASE_LABELS.moveTo);
  assert.equal(law.status, 'hold');
  assert.equal(moveTo.status, 'hold');
  assert.equal(F.controlLoopFsmStatus(s), 'hold');
});
