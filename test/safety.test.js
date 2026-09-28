'use strict';

const test = require('node:test');
const assert = require('node:assert');

let safety;
try {
  safety = require('../src/lib/safety');
} catch {
  safety = null;
}

test('getSafetyGuidelines returns grouped guidelines (electrical, mechanical) with actionable mitigations', () => {
  assert.notStrictEqual(safety, null, 'safety module must be loadable');
  assert.strictEqual(typeof safety.getSafetyGuidelines, 'function', 'getSafetyGuidelines must be a function');

  const guidelines = safety.getSafetyGuidelines();
  assert.ok(guidelines && typeof guidelines === 'object', 'guidelines must be an object');
  assert.ok(Array.isArray(guidelines.electrical), 'guidelines must have electrical group');
  assert.ok(Array.isArray(guidelines.mechanical), 'guidelines must have mechanical group');
  assert.ok(guidelines.electrical.length > 0, 'electrical group must not be empty');
  assert.ok(guidelines.mechanical.length > 0, 'mechanical group must not be empty');

  for (const item of guidelines.electrical) {
    assert.strictEqual(typeof item.hazard, 'string', 'electrical item must have a hazard description');
    assert.ok(item.hazard.trim().length > 0, 'electrical hazard must not be empty');
    assert.strictEqual(typeof item.mitigation, 'string', 'electrical item must have an actionable mitigation step');
    assert.ok(item.mitigation.trim().length > 0, 'electrical mitigation step must not be empty');
  }

  for (const item of guidelines.mechanical) {
    assert.strictEqual(typeof item.hazard, 'string', 'mechanical item must have a hazard description');
    assert.ok(item.hazard.trim().length > 0, 'mechanical hazard must not be empty');
    assert.strictEqual(typeof item.mitigation, 'string', 'mechanical item must have an actionable mitigation step');
    assert.ok(item.mitigation.trim().length > 0, 'mechanical mitigation step must not be empty');
  }
});
