// SmartMount — explicit (state × event) spec for both machines in fsm.js.
//
// fsm.js is the executable mirror of the .ino / the proposed-safe design.
// This file is the table a reviewer can read without stepping through
// if-ladders. test/fsm-matrix.test.js walks every cell: walk() must match
// TABLE. Context-sensitive variants (no endstop, stall budget, invalid
// panel) live in VARIANTS and are stepped the same way.
//
// Default payloads are the ones the explorer buttons send. Changing a
// default without updating TABLE is a failed test, not a silent drift.
(function (root, factory) {
  const fsm = (typeof module === 'object' && module.exports)
    ? require('./fsm')
    : root.SM_FSM;
  const api = factory(fsm);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SM_FSM_TABLE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (F) {
  // next = resulting state. reject is null when the event is accepted
  // (including "accepted as a no-op stay"). Firmware BOOT swallows HOME /
  // STALL / CLEAR — those rejects only exist once the .ino is in RUN.
  const FIRMWARE_TABLE = Object.freeze({
    BOOT: Object.freeze({
      BOOT_DONE: { next: 'RUN', reject: null },
      SAMPLE: { next: 'BOOT', reject: null },
      SET_ANGLE: { next: 'BOOT', reject: null },
      SET_MODE: { next: 'BOOT', reject: null },
      SET_PANEL: { next: 'BOOT', reject: null },
      TICK: { next: 'BOOT', reject: null },
      ARRIVE: { next: 'BOOT', reject: null },
      HOME_START: { next: 'BOOT', reject: null },
      HOME_FOUND: { next: 'BOOT', reject: null },
      SENSOR_FAIL: { next: 'BOOT', reject: null },
      SENSOR_OK: { next: 'BOOT', reject: null },
      STALL: { next: 'BOOT', reject: null },
      LIMIT: { next: 'BOOT', reject: null },
      POWER_LOSS: { next: 'BOOT', reject: null },
      CLEAR: { next: 'BOOT', reject: null },
    }),
    RUN: Object.freeze({
      BOOT_DONE: { next: 'RUN', reject: null },
      SAMPLE: { next: 'RUN', reject: null },
      SET_ANGLE: { next: 'RUN', reject: null },
      SET_MODE: { next: 'RUN', reject: null },
      SET_PANEL: { next: 'RUN', reject: null },
      TICK: { next: 'RUN', reject: null },
      ARRIVE: { next: 'RUN', reject: null },
      HOME_START: { next: 'RUN', reject: 'no-such-state' },
      HOME_FOUND: { next: 'RUN', reject: 'no-such-state' },
      SENSOR_FAIL: { next: 'RUN', reject: null },
      SENSOR_OK: { next: 'RUN', reject: null },
      STALL: { next: 'RUN', reject: 'no-such-state' },
      LIMIT: { next: 'RUN', reject: 'no-such-state' },
      POWER_LOSS: { next: 'RUN', reject: null },
      CLEAR: { next: 'RUN', reject: 'no-such-state' },
    }),
  });

  const SAFE_TABLE = Object.freeze({
    BOOT: Object.freeze({
      BOOT_DONE: { next: 'UNHOMED', reject: null },
      SAMPLE: { next: 'BOOT', reject: null },
      SET_ANGLE: { next: 'BOOT', reject: null },
      SET_MODE: { next: 'BOOT', reject: null },
      SET_PANEL: { next: 'BOOT', reject: null },
      TICK: { next: 'BOOT', reject: null },
      ARRIVE: { next: 'BOOT', reject: null },
      HOME_START: { next: 'BOOT', reject: null },
      HOME_FOUND: { next: 'BOOT', reject: null },
      SENSOR_FAIL: { next: 'BOOT', reject: null },
      SENSOR_OK: { next: 'BOOT', reject: null },
      STALL: { next: 'BOOT', reject: null },
      LIMIT: { next: 'BOOT', reject: null },
      POWER_LOSS: { next: 'DEAD', reject: null },
      CLEAR: { next: 'BOOT', reject: null },
    }),
    UNHOMED: Object.freeze({
      BOOT_DONE: { next: 'UNHOMED', reject: null },
      SAMPLE: { next: 'UNHOMED', reject: 'unhomed' },
      SET_ANGLE: { next: 'UNHOMED', reject: 'unhomed' },
      SET_MODE: { next: 'UNHOMED', reject: 'unhomed' },
      SET_PANEL: { next: 'UNHOMED', reject: null },
      TICK: { next: 'UNHOMED', reject: null },
      ARRIVE: { next: 'UNHOMED', reject: null },
      HOME_START: { next: 'HOMING', reject: null },
      HOME_FOUND: { next: 'UNHOMED', reject: null },
      SENSOR_FAIL: { next: 'UNHOMED', reject: null },
      SENSOR_OK: { next: 'UNHOMED', reject: null },
      STALL: { next: 'UNHOMED', reject: null },
      LIMIT: { next: 'UNHOMED', reject: null },
      POWER_LOSS: { next: 'DEAD', reject: null },
      CLEAR: { next: 'UNHOMED', reject: null },
    }),
    HOMING: Object.freeze({
      BOOT_DONE: { next: 'HOMING', reject: null },
      SAMPLE: { next: 'HOMING', reject: null },
      SET_ANGLE: { next: 'HOMING', reject: null },
      SET_MODE: { next: 'HOMING', reject: null },
      SET_PANEL: { next: 'HOMING', reject: null },
      TICK: { next: 'HOMING', reject: null },
      ARRIVE: { next: 'HOMING', reject: null },
      HOME_START: { next: 'HOMING', reject: null },
      HOME_FOUND: { next: 'IDLE_AUTO', reject: null },
      SENSOR_FAIL: { next: 'HOMING', reject: null },
      SENSOR_OK: { next: 'HOMING', reject: null },
      STALL: { next: 'FAULT_HOME', reject: null },
      LIMIT: { next: 'FAULT_HOME', reject: null },
      POWER_LOSS: { next: 'DEAD', reject: null },
      CLEAR: { next: 'HOMING', reject: null },
    }),
    IDLE_AUTO: Object.freeze({
      BOOT_DONE: { next: 'IDLE_AUTO', reject: null },
      SAMPLE: { next: 'MOVING', reject: null },
      SET_ANGLE: { next: 'MOVING', reject: null },
      SET_MODE: { next: 'IDLE_MANUAL', reject: null },
      SET_PANEL: { next: 'IDLE_AUTO', reject: null },
      TICK: { next: 'IDLE_AUTO', reject: null },
      ARRIVE: { next: 'IDLE_AUTO', reject: null },
      HOME_START: { next: 'IDLE_AUTO', reject: 'already-homed' },
      HOME_FOUND: { next: 'IDLE_AUTO', reject: null },
      SENSOR_FAIL: { next: 'FAULT_SENSOR', reject: null },
      SENSOR_OK: { next: 'IDLE_AUTO', reject: null },
      STALL: { next: 'FAULT_STALL', reject: null },
      LIMIT: { next: 'FAULT_LIMIT', reject: null },
      POWER_LOSS: { next: 'DEAD', reject: null },
      CLEAR: { next: 'IDLE_AUTO', reject: null },
    }),
    IDLE_MANUAL: Object.freeze({
      BOOT_DONE: { next: 'IDLE_MANUAL', reject: null },
      SAMPLE: { next: 'IDLE_MANUAL', reject: null },
      SET_ANGLE: { next: 'MOVING', reject: null },
      SET_MODE: { next: 'IDLE_MANUAL', reject: null },
      SET_PANEL: { next: 'IDLE_MANUAL', reject: null },
      TICK: { next: 'IDLE_MANUAL', reject: null },
      ARRIVE: { next: 'IDLE_MANUAL', reject: null },
      HOME_START: { next: 'IDLE_MANUAL', reject: 'already-homed' },
      HOME_FOUND: { next: 'IDLE_MANUAL', reject: null },
      SENSOR_FAIL: { next: 'FAULT_SENSOR', reject: null },
      SENSOR_OK: { next: 'IDLE_MANUAL', reject: null },
      STALL: { next: 'FAULT_STALL', reject: null },
      LIMIT: { next: 'FAULT_LIMIT', reject: null },
      POWER_LOSS: { next: 'DEAD', reject: null },
      CLEAR: { next: 'IDLE_MANUAL', reject: null },
    }),
    MOVING: Object.freeze({
      BOOT_DONE: { next: 'MOVING', reject: null },
      SAMPLE: { next: 'MOVING', reject: null },
      SET_ANGLE: { next: 'MOVING', reject: null },
      SET_MODE: { next: 'MOVING', reject: null },
      SET_PANEL: { next: 'MOVING', reject: null },
      TICK: { next: 'MOVING', reject: null },
      ARRIVE: { next: 'IDLE_AUTO', reject: null },
      HOME_START: { next: 'MOVING', reject: null },
      HOME_FOUND: { next: 'MOVING', reject: null },
      SENSOR_FAIL: { next: 'MOVING', reject: null },
      SENSOR_OK: { next: 'MOVING', reject: null },
      STALL: { next: 'FAULT_STALL', reject: null },
      LIMIT: { next: 'FAULT_LIMIT', reject: null },
      POWER_LOSS: { next: 'DEAD', reject: null },
      CLEAR: { next: 'MOVING', reject: null },
    }),
    FAULT_SENSOR: Object.freeze({
      BOOT_DONE: { next: 'FAULT_SENSOR', reject: null },
      SAMPLE: { next: 'FAULT_SENSOR', reject: null },
      SET_ANGLE: { next: 'MOVING', reject: null },
      SET_MODE: { next: 'FAULT_SENSOR', reject: null },
      SET_PANEL: { next: 'FAULT_SENSOR', reject: null },
      TICK: { next: 'FAULT_SENSOR', reject: null },
      ARRIVE: { next: 'FAULT_SENSOR', reject: null },
      HOME_START: { next: 'FAULT_SENSOR', reject: null },
      HOME_FOUND: { next: 'FAULT_SENSOR', reject: null },
      SENSOR_FAIL: { next: 'FAULT_SENSOR', reject: null },
      SENSOR_OK: { next: 'IDLE_AUTO', reject: null },
      STALL: { next: 'FAULT_SENSOR', reject: null },
      LIMIT: { next: 'FAULT_SENSOR', reject: null },
      POWER_LOSS: { next: 'DEAD', reject: null },
      CLEAR: { next: 'FAULT_SENSOR', reject: null },
    }),
    FAULT_HOME: Object.freeze({
      BOOT_DONE: { next: 'FAULT_HOME', reject: null },
      SAMPLE: { next: 'FAULT_HOME', reject: null },
      SET_ANGLE: { next: 'FAULT_HOME', reject: null },
      SET_MODE: { next: 'FAULT_HOME', reject: null },
      SET_PANEL: { next: 'FAULT_HOME', reject: null },
      TICK: { next: 'FAULT_HOME', reject: null },
      ARRIVE: { next: 'FAULT_HOME', reject: null },
      HOME_START: { next: 'FAULT_HOME', reject: null },
      HOME_FOUND: { next: 'FAULT_HOME', reject: null },
      SENSOR_FAIL: { next: 'FAULT_HOME', reject: null },
      SENSOR_OK: { next: 'FAULT_HOME', reject: null },
      STALL: { next: 'FAULT_HOME', reject: null },
      LIMIT: { next: 'FAULT_HOME', reject: null },
      POWER_LOSS: { next: 'DEAD', reject: null },
      CLEAR: { next: 'UNHOMED', reject: null },
    }),
    FAULT_STALL: Object.freeze({
      BOOT_DONE: { next: 'FAULT_STALL', reject: null },
      SAMPLE: { next: 'FAULT_STALL', reject: null },
      SET_ANGLE: { next: 'FAULT_STALL', reject: null },
      SET_MODE: { next: 'FAULT_STALL', reject: null },
      SET_PANEL: { next: 'FAULT_STALL', reject: null },
      TICK: { next: 'FAULT_STALL', reject: null },
      ARRIVE: { next: 'FAULT_STALL', reject: null },
      HOME_START: { next: 'FAULT_STALL', reject: null },
      HOME_FOUND: { next: 'FAULT_STALL', reject: null },
      SENSOR_FAIL: { next: 'FAULT_STALL', reject: null },
      SENSOR_OK: { next: 'FAULT_STALL', reject: null },
      STALL: { next: 'FAULT_STALL', reject: null },
      LIMIT: { next: 'FAULT_STALL', reject: null },
      POWER_LOSS: { next: 'DEAD', reject: null },
      CLEAR: { next: 'UNHOMED', reject: null },
    }),
    FAULT_LIMIT: Object.freeze({
      BOOT_DONE: { next: 'FAULT_LIMIT', reject: null },
      SAMPLE: { next: 'FAULT_LIMIT', reject: null },
      SET_ANGLE: { next: 'FAULT_LIMIT', reject: null },
      SET_MODE: { next: 'FAULT_LIMIT', reject: null },
      SET_PANEL: { next: 'FAULT_LIMIT', reject: null },
      TICK: { next: 'FAULT_LIMIT', reject: null },
      ARRIVE: { next: 'FAULT_LIMIT', reject: null },
      HOME_START: { next: 'FAULT_LIMIT', reject: null },
      HOME_FOUND: { next: 'FAULT_LIMIT', reject: null },
      SENSOR_FAIL: { next: 'FAULT_LIMIT', reject: null },
      SENSOR_OK: { next: 'FAULT_LIMIT', reject: null },
      STALL: { next: 'FAULT_LIMIT', reject: null },
      LIMIT: { next: 'FAULT_LIMIT', reject: null },
      POWER_LOSS: { next: 'DEAD', reject: null },
      CLEAR: { next: 'UNHOMED', reject: null },
    }),
    DEAD: Object.freeze({
      BOOT_DONE: { next: 'DEAD', reject: null },
      SAMPLE: { next: 'DEAD', reject: null },
      SET_ANGLE: { next: 'DEAD', reject: null },
      SET_MODE: { next: 'DEAD', reject: null },
      SET_PANEL: { next: 'DEAD', reject: null },
      TICK: { next: 'DEAD', reject: null },
      ARRIVE: { next: 'DEAD', reject: null },
      HOME_START: { next: 'DEAD', reject: null },
      HOME_FOUND: { next: 'DEAD', reject: null },
      SENSOR_FAIL: { next: 'DEAD', reject: null },
      SENSOR_OK: { next: 'DEAD', reject: null },
      STALL: { next: 'DEAD', reject: null },
      LIMIT: { next: 'DEAD', reject: null },
      POWER_LOSS: { next: 'DEAD', reject: null },
      CLEAR: { next: 'UNHOMED', reject: null },
    }),
  });

  // Extra cells the default payload cannot express. Each is still a real
  // step() of a canonical occupant — not a hand-waved comment.
  const VARIANTS = Object.freeze([
    Object.freeze({
      id: 'unhomed-no-endstop',
      kind: 'safe',
      from: 'UNHOMED',
      event: { type: 'HOME_START' },
      patch: { hasEndstop: false },
      next: 'FAULT_HOME',
      reject: null,
    }),
    Object.freeze({
      id: 'fault-home-retry-with-switch',
      kind: 'safe',
      from: 'FAULT_HOME',
      event: { type: 'HOME_START' },
      patch: { hasEndstop: true },
      next: 'HOMING',
      reject: null,
    }),
    Object.freeze({
      id: 'homing-timeout',
      kind: 'safe',
      from: 'HOMING',
      event: { type: 'TICK', dtMs: 20000 },
      patch: {},
      next: 'FAULT_HOME',
      reject: null,
    }),
    Object.freeze({
      id: 'moving-stall-budget',
      kind: 'safe',
      from: 'MOVING',
      event: { type: 'TICK', dtMs: 5000 },
      patch: { moveBudgetMs: 800 },
      next: 'FAULT_STALL',
      reject: null,
    }),
    Object.freeze({
      id: 'idle-auto-dead-sensor-sample',
      kind: 'safe',
      from: 'IDLE_AUTO',
      event: { type: 'SAMPLE', luxTop: -1, luxBot: 40 },
      patch: {},
      next: 'FAULT_SENSOR',
      reject: null,
    }),
    Object.freeze({
      id: 'idle-auto-quiet-room',
      kind: 'safe',
      from: 'IDLE_AUTO',
      event: { type: 'SAMPLE', luxTop: 80, luxBot: 80 },
      patch: {},
      next: 'IDLE_AUTO',
      reject: null,
    }),
    Object.freeze({
      id: 'set-panel-invalid-run',
      kind: 'firmware',
      from: 'RUN',
      event: { type: 'SET_PANEL', panel: 9 },
      patch: {},
      next: 'RUN',
      reject: 'invalid panel type',
    }),
    Object.freeze({
      id: 'set-panel-invalid-idle',
      kind: 'safe',
      from: 'IDLE_AUTO',
      event: { type: 'SET_PANEL', panel: 9 },
      patch: {},
      next: 'IDLE_AUTO',
      reject: 'invalid panel type',
    }),
    Object.freeze({
      id: 'idle-set-angle-already-there',
      kind: 'safe',
      from: 'IDLE_AUTO',
      event: { type: 'SET_ANGLE', deg: 0 },
      patch: {},
      next: 'IDLE_MANUAL',
      reject: null,
    }),
    Object.freeze({
      id: 'set-mode-back-to-auto',
      kind: 'safe',
      from: 'IDLE_MANUAL',
      event: { type: 'SET_MODE', auto: true },
      patch: {},
      next: 'IDLE_AUTO',
      reject: null,
    }),
  ]);

  function defaultEvent(type) {
    if (F.EVENTS.indexOf(type) < 0) throw new Error('unknown event: ' + type);
    if (type === 'BOOT_DONE') return { type: type, wifiOk: true };
    if (type === 'SAMPLE') return { type: type, luxTop: 800, luxBot: 80 };
    if (type === 'SET_ANGLE') return { type: type, deg: 12 };
    if (type === 'SET_MODE') return { type: type, auto: false };
    if (type === 'SET_PANEL') return { type: type, panel: 0 };
    if (type === 'TICK') return { type: type, dtMs: 100 };
    return { type: type };
  }

  function tableFor(kind) {
    return kind === 'safe' ? SAFE_TABLE : FIRMWARE_TABLE;
  }

  function cell(kind, state, eventType) {
    const table = tableFor(kind);
    if (!table[state]) throw new Error('unknown state: ' + state);
    if (!table[state][eventType]) throw new Error('no cell ' + state + ' × ' + eventType);
    return table[state][eventType];
  }

  function statesOf(kind) {
    return kind === 'safe' ? F.SAFE_STATES : F.FIRMWARE_STATES;
  }

  // A typical occupant of `state`, built only from public step()/boot
  // helpers so the matrix cannot invent a snapshot the machine never
  // reaches. FAULT_HOME is the no-endstop path (the board as-built).
  // MOVING is a SAMPLE from IDLE_AUTO so ARRIVE returns to IDLE_AUTO.
  function canonical(kind, state, extras) {
    const states = statesOf(kind);
    if (states.indexOf(state) < 0) throw new Error('unknown state: ' + state);
    let s;
    if (kind === 'firmware') {
      s = state === 'BOOT' ? F.fresh('firmware') : F.firmwareBoot(true);
    } else if (state === 'BOOT') {
      s = F.fresh('safe', { hasEndstop: true });
    } else if (state === 'UNHOMED') {
      s = F.safeBoot(true, true);
    } else if (state === 'HOMING') {
      s = F.step(F.safeBoot(true, true), { type: 'HOME_START' });
    } else if (state === 'IDLE_AUTO') {
      s = F.applyAll(F.safeBoot(true, true), [
        { type: 'HOME_START' },
        { type: 'HOME_FOUND' },
      ]);
    } else if (state === 'IDLE_MANUAL') {
      s = F.applyAll(F.safeBoot(true, true), [
        { type: 'HOME_START' },
        { type: 'HOME_FOUND' },
        { type: 'SET_MODE', auto: false },
      ]);
    } else if (state === 'MOVING') {
      s = F.applyAll(F.safeBoot(true, true), [
        { type: 'HOME_START' },
        { type: 'HOME_FOUND' },
        { type: 'SAMPLE', luxTop: 800, luxBot: 80 },
      ]);
    } else if (state === 'FAULT_SENSOR') {
      s = F.applyAll(F.safeBoot(true, true), [
        { type: 'HOME_START' },
        { type: 'HOME_FOUND' },
        { type: 'SENSOR_FAIL' },
      ]);
    } else if (state === 'FAULT_HOME') {
      s = F.step(F.safeBoot(true, false), { type: 'HOME_START' });
    } else if (state === 'FAULT_STALL') {
      s = F.applyAll(F.safeBoot(true, true), [
        { type: 'HOME_START' },
        { type: 'HOME_FOUND' },
      ]);
      s.moveBudgetMs = 200;
      s = F.step(s, { type: 'SET_ANGLE', deg: 12 });
      s = F.step(s, { type: 'TICK', dtMs: 2000 });
    } else if (state === 'FAULT_LIMIT') {
      s = F.applyAll(F.safeBoot(true, true), [
        { type: 'HOME_START' },
        { type: 'HOME_FOUND' },
        { type: 'LIMIT' },
      ]);
    } else if (state === 'DEAD') {
      s = F.applyAll(F.safeBoot(true, true), [
        { type: 'HOME_START' },
        { type: 'HOME_FOUND' },
        { type: 'POWER_LOSS' },
      ]);
    }
    if (!s || s.state !== state) {
      throw new Error('canonical(' + kind + ',' + state + ') landed in ' + (s && s.state));
    }
    return extras ? Object.assign({}, s, extras) : s;
  }

  function walk(kind) {
    const states = statesOf(kind);
    const rows = [];
    for (let i = 0; i < states.length; i++) {
      const from = states[i];
      for (let j = 0; j < F.EVENTS.length; j++) {
        const type = F.EVENTS[j];
        const out = F.step(canonical(kind, from), defaultEvent(type));
        rows.push({
          kind: kind,
          from: from,
          event: type,
          to: out.state,
          reject: out.reject,
          reason: out.reason,
          moving: out.moving,
        });
      }
    }
    return rows;
  }

  function walkVariant(v) {
    const snap = canonical(v.kind, v.from, v.patch);
    return F.step(snap, v.event);
  }

  function edges(kind) {
    const seen = Object.create(null);
    const list = [];
    walk(kind).forEach(function (row) {
      if (row.to === row.from) return;
      const key = row.from + '>' + row.to + '@' + row.event;
      if (seen[key]) return;
      seen[key] = true;
      list.push({ from: row.from, to: row.to, event: row.event, reject: row.reject });
    });
    return list;
  }

  function counts(kind) {
    const rows = walk(kind);
    let stays = 0;
    let changes = 0;
    let rejects = 0;
    rows.forEach(function (r) {
      if (r.reject) rejects += 1;
      if (r.to === r.from) stays += 1;
      else changes += 1;
    });
    return {
      cells: rows.length,
      stays: stays,
      changes: changes,
      rejects: rejects,
    };
  }

  return {
    FIRMWARE_TABLE,
    SAFE_TABLE,
    VARIANTS,
    defaultEvent,
    tableFor,
    cell,
    statesOf,
    canonical,
    walk,
    walkVariant,
    edges,
    counts,
  };
});
