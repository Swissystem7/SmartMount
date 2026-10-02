const test = require('node:test');
const assert = require('node:assert');
const { latencyChain } = require('../src/lib/timing');

test('latencyChain summaryHe contract', () => {
  const case1 = latencyChain({ fromDeg: 0, toDeg: 20, samplePhase01: 1 });
  assert.strictEqual(case1.summaryHe, '1.1 שניות · הכי מעכב: מעטפת מנוע');

  const case2 = latencyChain({ fromDeg: 0, toDeg: 20, samplePhase01: 0 });
  assert.strictEqual(case2.summaryHe, '3.1 שניות · הכי מעכב: המתנה לדגימה');

  const case3 = latencyChain({ fromDeg: 0, toDeg: 0, samplePhase01: 1, handleClientMs: 3000, i2cReadMs: 0 });
  assert.strictEqual(case3.summaryHe, '3.0 שניות · הכי מעכב: חישוב');

  assert.ok(case1.totalMs !== undefined && case1.bottleneck !== undefined && case1.waitSampleMs !== undefined);
});
