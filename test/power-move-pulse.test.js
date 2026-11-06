const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/lib/power');

// CT-001: the 'pack-cannot-motor-rail' branch gated on holdW (the winding
// I²R, > 0 even with a worm), so 'pack-cannot-move-pulse' — which power/
// has its own sentence for — could never be returned.
const BASE = { movesPerDay: 24, moveDurationSec: 1.2, hoursWanted: 24 };

for (const packId of ['usb-10ah', '2s18650']) {
  test(`${packId}: coils held idle is a motor-rail problem`, () => {
    const r = P.sizeBattery(Object.assign({}, BASE, { packId, selfLocking: false }));
    assert.equal(r.kind, 'pack-cannot-motor-rail');
  });

  test(`${packId}: a worm makes idle cheap, but the move pulse is still 12 V`, () => {
    const worm = P.sizeBattery(Object.assign({}, BASE, { packId, selfLocking: true }));
    assert.equal(worm.daily.coilsIdle, 0);
    assert.equal(worm.kind, 'pack-cannot-move-pulse');
    const off = P.sizeBattery(Object.assign({}, BASE, { packId, disableCoilsWhenIdle: true }));
    assert.equal(off.kind, 'pack-cannot-move-pulse');
  });
}

test('every kind sizeBattery can return has a sentence on the power page', () => {
  const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'power', 'index.html'), 'utf8');
  const kinds = new Set();
  for (const packId of P.PACKS.map((p) => p.id)) {
    for (const selfLocking of [false, true]) {
      for (const movesPerDay of [0, 24]) {
        kinds.add(P.sizeBattery({ packId, selfLocking, movesPerDay, hoursWanted: 24 }).kind);
      }
    }
  }
  assert.ok(kinds.has('pack-cannot-move-pulse'));
  for (const k of kinds) {
    if (k === 'hours-ok') continue;
    assert.ok(html.includes(`'${k}'`), `power/index.html has no text for ${k}`);
  }
});
