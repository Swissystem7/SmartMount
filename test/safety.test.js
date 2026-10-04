const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let safety;
try {
  safety = require('../src/lib/safety');
} catch {
  safety = null;
}

test('getSafetyGuidelines returns grouped guidelines (electrical, mechanical) with actionable mitigations', () => {
  assert.notEqual(safety, null, 'safety module must be loadable');
  assert.strictEqual(typeof safety.getSafetyGuidelines, 'function', 'getSafetyGuidelines must be a function');
  assert.ok(safety.SAFETY_GUIDELINES, 'SAFETY_GUIDELINES must be exported');

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

test('every guideline has a stable id and matching category', () => {
  assert.notEqual(safety, null, 'safety module must be loadable');
  const guidelines = safety.getSafetyGuidelines();
  for (const [group, items] of Object.entries(guidelines)) {
    const ids = new Set();
    const idPattern = group === 'electrical' ? /^ELEC-\d{2}$/ : /^MECH-\d{2}$/;
    for (const item of items) {
      assert.match(item.id, idPattern, item.id);
      assert.equal(item.category, group);
      assert.equal(ids.has(item.id), false, item.id);
      ids.add(item.id);
    }
  }
});

test('getSafetyGuidelines returns copies that do not mutate canonical data', () => {
  assert.notEqual(safety, null, 'safety module must be loadable');
  const guidelines = safety.getSafetyGuidelines();
  const canonical = safety.SAFETY_GUIDELINES.electrical[0].hazard;
  guidelines.electrical[0].hazard = 'mutated hazard';
  assert.equal(safety.SAFETY_GUIDELINES.electrical[0].hazard, canonical);
});

test('safety.js follows the host module pattern (UMD + SM_SAFETY)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/lib/safety.js'), 'utf8');
  assert.match(src, /function \(root, factory\)/);
  assert.match(src, /root\.SM_SAFETY = api/);
});
