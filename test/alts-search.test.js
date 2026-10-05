// F1 — keyword search over the alternative solutions.
// The user-visible promise: searching «תריס חכם» or «זרוע מוניטור» returns the
// smart-blind and monitor-arm alternatives to the glare problem, and the
// חלופות page lets a visitor type that keyword and see only those cards.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../src/lib/alts');

const page = fs.readFileSync(
  path.join(__dirname, '..', 'alts', 'index.html'),
  'utf8'
);

test('the glare decision lists a smart blind and a monitor arm next to the motor', () => {
  const glare = A.byId('glare');
  assert.ok(glare, 'a «should we move the screen at all» decision must exist');
  assert.deepEqual(glare.options.map((o) => o.id), [
    'tilt', 'smart-blind', 'monitor-arm', 'coating',
  ]);
  assert.equal(A.chosenOf('glare').id, 'tilt');
  assert.equal(A.chosenOf('glare').verdict, 'chosen-for-demo');
  const blind = glare.options.find((o) => o.id === 'smart-blind');
  const arm = glare.options.find((o) => o.id === 'monitor-arm');
  assert.match(blind.label, /תריס חכם/);
  assert.match(arm.label, /זרוע מוניטור/);
  // Honest about the trade: both are cheaper, and the page has to say so.
  assert.ok(blind.why.length > 40 && arm.why.length > 40);
  assert.match(blind.why, /במקור/);
  assert.match(arm.why, /0 W/);
});

test('searching «תריס חכם» returns the smart blind with its decision context', () => {
  const hits = A.searchSolutions('תריס חכם');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].id, 'smart-blind');
  assert.equal(hits[0].decision, 'glare');
  assert.equal(hits[0].question, A.byId('glare').question);
  assert.equal(hits[0].verdict, 'out-of-scope');
  assert.deepEqual(hits[0].matched, ['תריס חכם']);
  assert.ok(hits[0].why.length > 40);
});

test('searching «זרוע מוניטור» returns the manual arm', () => {
  const hits = A.searchSolutions('זרוע מוניטור');
  assert.deepEqual(hits.map((h) => h.id), ['monitor-arm']);
  assert.equal(hits[0].verdict, 'rejected');
});

test('both keywords together return both solutions, in DECISIONS order', () => {
  const hits = A.searchSolutions(['תריס חכם', 'זרוע מוניטור']);
  assert.deepEqual(hits.map((h) => h.id), ['smart-blind', 'monitor-arm']);
  assert.deepEqual(hits.map((h) => h.matched), [['תריס חכם'], ['זרוע מוניטור']]);
  // These are the glare alternatives the owner asked to be visible.
  for (const h of hits) assert.equal(h.decision, 'glare');
});

test('keywords are OR-ed, not AND-ed, and reach across decisions', () => {
  const hits = A.searchSolutions(['תריס חכם', 'סרבו']);
  assert.deepEqual(hits.map((h) => h.decision), ['glare', 'actuator']);
  assert.deepEqual(hits.map((h) => h.id), ['smart-blind', 'servo']);
});

test('an option that matches two keywords reports both of them once', () => {
  const hits = A.searchSolutions(['זרוע מוניטור', 'קפיץ גז', 'זרוע מוניטור']);
  assert.deepEqual(hits.map((h) => h.id), ['monitor-arm']);
  assert.deepEqual(hits[0].matched, ['זרוע מוניטור', 'קפיץ גז']);
});

test('search is whitespace tolerant and case insensitive', () => {
  assert.deepEqual(
    A.searchSolutions('  זרוע   מוניטור \n').map((h) => h.id),
    ['monitor-arm']
  );
  // «Samsung» is written once in the glare row and once in the placement row.
  assert.deepEqual(A.searchSolutions('SAMSUNG').map((h) => h.id), ['coating', 'camera']);
  assert.deepEqual(
    A.searchSolutions('SAMSUNG').map((h) => h.id),
    A.searchSolutions('samsung').map((h) => h.id)
  );
  assert.deepEqual(
    A.searchSolutions('accelstepper').map((h) => h.id),
    A.searchSolutions('AccelStepper').map((h) => h.id)
  );
  assert.ok(A.searchSolutions('accelstepper').length >= 1);
});

test('plural phrasing still finds the same alternatives', () => {
  assert.deepEqual(A.searchSolutions('תריסים חכמים').map((h) => h.id), ['smart-blind']);
  assert.deepEqual(A.searchSolutions('זרועות מוניטור').map((h) => h.id), ['monitor-arm']);
});

test('ids and verdicts are searchable too', () => {
  assert.deepEqual(A.searchSolutions('smart-blind').map((h) => h.id), ['smart-blind']);
  assert.deepEqual(
    A.searchSolutions('required-for-a-product').map((h) => h.id),
    ['worm', 'endstop']
  );
});

test('empty, blank and non-string input returns an empty list, never everything', () => {
  for (const bad of ['', '   ', [], ['', '  '], null, undefined, 7, {}, [null, 3]]) {
    assert.deepEqual(A.searchSolutions(bad), [], JSON.stringify(bad) || String(bad));
  }
});

test('a keyword nobody wrote down returns nothing', () => {
  assert.deepEqual(A.searchSolutions('פלזמה'), []);
  assert.deepEqual(A.searchSolutions(['פלזמה', 'VHS']), []);
});

test('results are frozen copies, so a caller cannot edit the source decisions', () => {
  const hits = A.searchSolutions('תריס חכם');
  assert.ok(Object.isFrozen(hits[0]));
  assert.ok(Object.isFrozen(hits[0].matched));
  hits.push('junk');
  hits.length = 0;
  assert.equal(A.searchSolutions('תריס חכם').length, 1);
  assert.equal(A.byId('glare').options.length, 4);
});

test('every hit carries the four fields the חלופות card renders', () => {
  const hits = A.searchSolutions(['תריס חכם', 'זרוע מוניטור', 'סרבו', 'תולעת']);
  assert.ok(hits.length >= 4);
  for (const h of hits) {
    assert.equal(typeof h.label, 'string');
    assert.equal(typeof h.why, 'string');
    assert.ok(h.label.length > 0 && h.why.length > 0, h.id);
    assert.ok(A.byId(h.decision).options.some((o) => o.id === h.id), h.id);
  }
});

test('the חלופות page wires a keyword box to searchSolutions and renders the hits', () => {
  assert.match(page, /src\/lib\/alts\.js/);
  assert.match(page, /id="q"/);
  assert.match(page, /type="search"/);
  assert.match(page, /<label for="q">/);
  assert.match(page, /חיפוש חלופה לפי מילת מפתח/);
  assert.match(page, /SM_ALTS\.searchSolutions\(/);
  assert.match(page, /aria-live="polite"/);
  // No private copy of the data or of the matching rule on the page.
  assert.doesNotMatch(page, /function searchSolutions/);
  assert.doesNotMatch(page, /smart-blind|monitor-arm/);
});

test('the page still shows every decision when the keyword box is empty', () => {
  assert.match(page, /if \(!term\)/);
  assert.match(page, /SM_ALTS\.DECISIONS\.forEach/);
  assert.match(page, /addEventListener\('input', render\)/);
  assert.match(page, /אין חלופה שמכילה/);
  // The two keywords the owner asked for are offered as examples.
  assert.match(page, /תריס חכם/);
  assert.match(page, /זרוע מוניטור/);
});
