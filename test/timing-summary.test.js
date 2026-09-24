const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../src/lib/timing');

test('summaryHe summarizes latency chain and preserves existing fields', () => {
  const r1 = T.latencyChain({ fromDeg: 0, toDeg: 20, samplePhase01: 1 });
  assert.strictEqual(r1.summaryHe, '1.1 שניות · הכי מעכב: מעטפת מנוע');

  const r2 = T.latencyChain({ fromDeg: 0, toDeg: 20, samplePhase01: 0 });
  assert.strictEqual(r2.summaryHe, '3.1 שניות · הכי מעכב: המתנה לדגימה');

  const r3 = T.latencyChain({ fromDeg: 0, toDeg: 0, samplePhase01: 1, handleClientMs: 3000, i2cReadMs: 0 });
  assert.strictEqual(r3.summaryHe, '3.0 שניות · הכי מעכב: חישוב');

  assert.ok(r1.totalMs !== undefined && r1.bottleneck !== undefined && r1.waitSampleMs !== undefined);
});
