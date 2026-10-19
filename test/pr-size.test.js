// src/lib/pr-size.js — the changed-line budget auto_merger enforces, and the
// split plan it produces for a PR that busts it. The worked example below is
// PR #154: 533 changed lines against a budget of 400, so it was never merged.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const PR = require('../src/lib/pr-size');
const { parseArgs } = require('../scripts/pr-size');

test('parseNumstat reads counts, paths and areas', () => {
  const files = PR.parseNumstat(['12\t3\tsrc/lib/fsm.js', '0\t40\ttest/fsm.test.js', '', '5\t5\tREADME.md'].join('\n'));
  assert.equal(files.length, 3);
  assert.deepEqual(
    files.map((f) => [f.area, f.changed]),
    [['src', 15], ['test', 40], [PR.ROOT_AREA, 10]]
  );
  assert.equal(PR.totalChangedLines(files), 65);
});

test('binary files weigh nothing but stay listed', () => {
  const files = PR.parseNumstat('-\t-\tassets/logo.png\n7\t1\tassets/site.css');
  assert.deepEqual(files.map((f) => [f.binary, f.changed]), [[true, 0], [false, 8]]);
  assert.equal(PR.totalChangedLines(files), 8);
});

test('renames are billed to the destination path, in both git spellings', () => {
  assert.equal(PR.resolvePath('old/a.js => src/b.js'), 'src/b.js');
  assert.equal(PR.resolvePath('src/{lib => util}/a.js'), 'src/util/a.js');
  assert.equal(PR.resolvePath('{ => docs}/HIL.md'), 'docs/HIL.md');
  assert.equal(PR.areaOf(PR.resolvePath('old/a.js => src/b.js')), 'src');
});

test('a diff inside the budget needs no split', () => {
  const plan = PR.planSplit(PR.parseNumstat('100\t50\tsrc/lib/power.js'));
  assert.equal(plan.total, 150);
  assert.equal(plan.withinBudget, true);
  assert.equal(plan.overBy, 0);
  assert.equal(plan.batches.length, 1);
  assert.match(PR.formatPlan(plan), /within budget/);
});

test('PR #154 — 533 lines — splits into batches that each fit 400', () => {
  // Shape of the real diff: four areas, 533 changed lines in total.
  const plan = PR.planSplit(
    PR.parseNumstat(
      [
        '180\t40\tsrc/lib/protocol.js',
        '120\t30\ttest/protocol.test.js',
        '90\t20\tprotocol/index.html',
        '40\t13\tdocs/TESTING.md',
      ].join('\n')
    )
  );
  assert.equal(plan.total, 533);
  assert.equal(plan.withinBudget, false);
  assert.equal(plan.overBy, 133);
  assert.ok(plan.batches.length >= 2, 'must be cut into at least two PRs');
  for (const batch of plan.batches) {
    assert.ok(batch.changedLines <= 400, `batch ${batch.index} is ${batch.changedLines} lines`);
    assert.ok(batch.units.length > 0);
  }
  // Nothing is lost or double-counted in the split.
  assert.equal(
    plan.batches.reduce((sum, b) => sum + b.changedLines, 0),
    plan.total
  );
  const planned = plan.batches.flatMap((b) => b.files.map((f) => f.path));
  assert.equal(new Set(planned).size, 4);
});

test('an area bigger than the budget is re-packed file by file', () => {
  const plan = PR.planSplit(
    PR.parseNumstat(['300\t0\tsrc/a.js', '300\t0\tsrc/b.js', '10\t0\tREADME.md'].join('\n'))
  );
  assert.equal(plan.total, 610);
  for (const batch of plan.batches) assert.ok(batch.changedLines <= 400);
  // src/ did not survive as one unit — it was broken down to its files.
  assert.ok(plan.batches.every((b) => !b.units.includes('src')));
  assert.ok(plan.batches.some((b) => b.units.includes('src/a.js')));
});

test('a single file over the budget is flagged as unsplittable by path', () => {
  const plan = PR.planSplit(PR.parseNumstat('500\t0\tsrc/lib/huge.js\n10\t0\tREADME.md'));
  assert.deepEqual(plan.oversized, [{ path: 'src/lib/huge.js', changed: 500 }]);
  assert.match(PR.formatPlan(plan), /split it by hand/);
});

test('planning is deterministic for the same diff', () => {
  const numstat = ['50\t0\ta/x.js', '50\t0\tb/y.js', '320\t0\tc/z.js', '90\t0\td/w.js'].join('\n');
  const units = () => PR.planSplit(PR.parseNumstat(numstat)).batches.map((b) => b.units);
  assert.deepEqual(units(), units());
});

test('an explicit budget overrides the default, bad values fall back', () => {
  const files = PR.parseNumstat('150\t0\tsrc/a.js\n150\t0\ttest/b.js');
  assert.equal(PR.planSplit(files, 200).withinBudget, false);
  assert.equal(PR.planSplit(files, 400).withinBudget, true);
  assert.equal(PR.planSplit(files, 0).budget, PR.MERGE_BUDGET_LINES);
});

test('CLI flags: defaults, both --flag and --flag= forms, and rejections', () => {
  assert.deepEqual(parseArgs([]), { base: 'origin/master', budget: 400, warnOnly: false });
  assert.deepEqual(parseArgs(['--base', 'master', '--budget', '250', '--warn-only']), {
    base: 'master',
    budget: 250,
    warnOnly: true,
  });
  assert.deepEqual(parseArgs(['--base=rc/daily-SmartMount', '--budget=50']), {
    base: 'rc/daily-SmartMount',
    budget: 50,
    warnOnly: false,
  });
  assert.throws(() => parseArgs(['--nope']), /unknown argument/);
  assert.throws(() => parseArgs(['--budget', '0']), /positive integer/);
});

test('the budget is 400, and documented where contributors and CI will see it', () => {
  assert.equal(PR.MERGE_BUDGET_LINES, 400);
  const root = path.join(__dirname, '..');
  const instructions = fs.readFileSync(path.join(root, '.github/copilot-instructions.md'), 'utf8');
  assert.match(instructions, /400 changed lines/);
  assert.match(instructions, /scripts\/pr-size\.js|npm run pr-size/);

  const workflow = fs.readFileSync(path.join(root, '.github/workflows/validate.yml'), 'utf8');
  assert.match(workflow, /pr-size/);

  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['pr-size'], 'node scripts/pr-size.js');
});
