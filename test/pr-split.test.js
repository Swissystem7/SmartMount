'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MERGE_BUDGET_LINES,
  featureKey,
  parseNumstat,
  totalChanged,
  planSplit,
  formatPlan,
} = require('../scripts/lib/pr-split.js');
const { parseArgs } = require('../scripts/pr-size.js');

// #159: PR #158 had 508 changed lines, so auto_merger (control#42) never
// touched it. The budget is the whole point of this module — pin it.
test('the auto_merger budget is 400 changed lines', () => {
  assert.equal(MERGE_BUDGET_LINES, 400);
});

test('parseNumstat reads added/deleted/path and sums them', () => {
  const rows = parseNumstat('12\t3\tsrc/lib/power.js\n0\t7\ttest/power.test.js\n');
  assert.deepEqual(rows, [
    { path: 'src/lib/power.js', added: 12, deleted: 3, changed: 15, binary: false },
    { path: 'test/power.test.js', added: 0, deleted: 7, changed: 7, binary: false },
  ]);
  assert.equal(totalChanged(rows), 22);
});

test('parseNumstat: blank lines, a tab in a path, binary as zero, renames', () => {
  const rows = parseNumstat(
    ['', '1\t1\tdocs/od\td.md', '-\t-\tassets/wiring.png', '2\t2\told.js => new.js', '4\t1\tsrc/{lib => core}/fsm.js', ''].join('\n'),
  );
  assert.deepEqual(
    rows.map((r) => r.path),
    ['docs/od\td.md', 'assets/wiring.png', 'new.js', 'src/core/fsm.js'],
  );
  assert.equal(rows[1].binary, true);
  assert.equal(rows[1].changed, 0, 'a binary file has no line count');
  assert.throws(() => parseNumstat('not a numstat line\n'), /unparsable numstat line/);
});

test('a diff inside the budget plans as one slice and reports fits', () => {
  const plan = planSplit(parseNumstat('100\t50\tsrc/lib/fsm.js\n'));
  assert.equal(plan.total, 150);
  assert.equal(plan.fits, true);
  assert.equal(plan.slices.length, 1);
  assert.match(formatPlan(plan), /no split needed/);
});

test('an over-budget diff is cut into slices that each fit, losing no file', () => {
  // 508 lines, the size of PR #158, plus a binary file that counts as zero.
  const files = parseNumstat(
    [
      '150\t20\tsrc/lib/power.js',
      '100\t10\tpower/index.html',
      '90\t8\ttest/power.test.js',
      '110\t20\tdocs/TESTING.md',
      '-\t-\tassets/wiring.png',
    ].join('\n'),
  );
  const plan = planSplit(files);
  assert.equal(plan.total, 508);
  assert.equal(plan.fits, false);
  assert.ok(plan.slices.length >= 2, 'an over-budget diff needs at least two slices');
  for (const slice of plan.slices) {
    assert.ok(slice.changed <= plan.budget, `slice of ${slice.changed} lines is over budget`);
    assert.equal(slice.changed, totalChanged(slice.files));
  }

  const placed = plan.slices.flatMap((s) => s.files.map((f) => f.path));
  assert.equal(placed.length, new Set(placed).size, 'a file was placed in two slices');
  assert.deepEqual([...placed].sort(), files.map((f) => f.path).sort());
});

test('featureKey names a page by its directory and a test by what it tests', () => {
  assert.equal(featureKey('power/index.html'), 'power');
  assert.equal(featureKey('src/lib/power.js'), 'power');
  assert.equal(featureKey('test/power-best-pack.test.js'), 'power');
  assert.equal(featureKey('config/control-params.json'), 'control');
  assert.equal(featureKey('404.html'), '404');
  assert.equal(featureKey('test/404-ui.test.js'), '404');
  assert.equal(featureKey('docs/TESTING.md'), 'testing');
});

test('a feature that fits stays whole, so each PR stands alone', () => {
  // Page + module + test per feature. Each feature fits; the two together
  // bust the budget, so the cut must fall between features, not inside one.
  const files = parseNumstat(
    [
      '80\t0\tpower/index.html',
      '80\t0\tsrc/lib/power.js',
      '80\t0\ttest/power-ui.test.js',
      '70\t0\tfsm/index.html',
      '70\t0\tsrc/lib/fsm.js',
      '70\t0\ttest/fsm-ui.test.js',
    ].join('\n'),
  );
  const plan = planSplit(files);
  assert.equal(plan.fits, false);
  const sliceOf = (p) => plan.slices.findIndex((s) => s.files.some((f) => f.path === p));
  for (const feature of ['power', 'fsm']) {
    const where = sliceOf(`${feature}/index.html`);
    const msg = `${feature} was split across PRs`;
    assert.equal(sliceOf(`src/lib/${feature}.js`), where, msg);
    assert.equal(sliceOf(`test/${feature}-ui.test.js`), where, msg);
  }
  assert.notEqual(sliceOf('power/index.html'), sliceOf('fsm/index.html'));
});

test('a feature bigger than the budget is broken down per file', () => {
  const files = parseNumstat(
    ['300\t0\tsrc/lib/power.js', '300\t0\ttest/power.test.js', '10\t0\tREADME.md'].join('\n'),
  );
  const plan = planSplit(files);
  const sliceOf = (p) => plan.slices.findIndex((s) => s.files.some((f) => f.path === p));
  assert.notEqual(sliceOf('src/lib/power.js'), sliceOf('test/power.test.js'));
  for (const slice of plan.slices) assert.ok(slice.changed <= plan.budget);
  assert.deepEqual(plan.oversized, []);
});

test('a single file over the budget is flagged, not hidden in a slice', () => {
  const plan = planSplit(parseNumstat('500\t50\tfirmware/smart_mount.ino\n10\t0\tREADME.md\n'));
  assert.deepEqual(
    plan.oversized.map((f) => f.path),
    ['firmware/smart_mount.ino'],
  );
  assert.match(formatPlan(plan), /no split can fix these single files/);
  assert.match(formatPlan(plan), /firmware\/smart_mount\.ino — 550 changed lines/);
});

test('planSplit honours a custom budget and rejects a nonsense one', () => {
  const files = parseNumstat('60\t0\tsrc/lib/a.js\n60\t0\ttest/b.test.js\n');
  assert.equal(planSplit(files, 100).fits, false);
  assert.equal(planSplit(files, 400).fits, true);
  for (const bad of [0, -1, 1.5, NaN, '400']) {
    assert.throws(() => planSplit(files, bad), /budget must be a positive integer/);
  }
});

test('an empty diff is zero lines and no slices, not a crash', () => {
  const plan = planSplit(parseNumstat(''));
  assert.equal(plan.total, 0);
  assert.equal(plan.fits, true);
  assert.deepEqual(plan.slices, []);
});

test('pr-size defaults to master...HEAD at the budget, and refuses bad flags', () => {
  assert.deepEqual(parseArgs([]), {
    range: 'master...HEAD',
    budget: MERGE_BUDGET_LINES,
    json: false,
  });
  assert.deepEqual(parseArgs(['master...topic', '--budget', '200', '--json']), {
    range: 'master...topic',
    budget: 200,
    json: true,
  });
  assert.throws(() => parseArgs(['--budget', 'lots']), /--budget needs a positive integer/);
  assert.throws(() => parseArgs(['--nope']), /unknown option --nope/);
  assert.throws(() => parseArgs(['a...b', 'c...d']), /unexpected extra argument/);
});
