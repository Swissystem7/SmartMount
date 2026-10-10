const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/lib/power.js');

test('moving time of exactly 24 h is a full day of moving, no idle', () => {
  const r = P.dailyEnergy({ movesPerDay: 86400, moveDurationSec: 1 });
  assert.equal(r.movingHours, 24);
  assert.equal(r.idleHours, 0);
  assert.ok(Math.abs(r.motorWh - r.moveW * 24) < 1e-9);
});

test('moving time beyond 24 h is rejected, not counted as a longer day', () => {
  assert.throws(() => P.dailyEnergy({ movesPerDay: 100000, moveDurationSec: 1 }), /invalid daily-energy/);
  assert.throws(() => P.sizeBudget({ movesPerDay: 200, moveDurationSec: 3600 }), /exceeds 24 h/);
});

test('motor energy never exceeds 24 h of the move draw', () => {
  for (const [moves, sec] of [[0, 1], [24, 2], [200, 5], [43200, 2]]) {
    const r = P.dailyEnergy({ movesPerDay: moves, moveDurationSec: sec });
    assert.ok(r.movingHours + r.idleHours === 24);
    assert.ok(r.motorWh <= r.moveW * 24 + 1e-9);
  }
});
