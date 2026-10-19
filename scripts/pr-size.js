#!/usr/bin/env node
/**
 * Reports a branch's changed-line count against auto_merger's merge budget,
 * and — when over — suggests how to cut it into PRs that fit.
 *
 *   node scripts/pr-size.js                 # vs origin/master, exits 1 if over
 *   node scripts/pr-size.js --base master --budget 250
 *   node scripts/pr-size.js --warn-only     # report, always exit 0
 *
 * The count is additions + deletions over the merge base (`base...HEAD`), the
 * same number GitHub shows on the PR, so a green run means auto_merger will
 * pick the PR up.
 */
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const PR = require(path.join(__dirname, '..', 'src', 'lib', 'pr-size'));

function parseArgs(argv) {
  const opts = { base: 'origin/master', budget: PR.MERGE_BUDGET_LINES, warnOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--warn-only') opts.warnOnly = true;
    else if (arg === '--base') opts.base = argv[++i];
    else if (arg === '--budget') opts.budget = Number.parseInt(argv[++i], 10);
    else if (arg.startsWith('--base=')) opts.base = arg.slice('--base='.length);
    else if (arg.startsWith('--budget=')) opts.budget = Number.parseInt(arg.slice('--budget='.length), 10);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!opts.base) throw new Error('--base needs a ref');
  if (!Number.isInteger(opts.budget) || opts.budget <= 0) throw new Error('--budget needs a positive integer');
  return opts;
}

function numstat(base) {
  // `base...HEAD` measures against the merge base, so commits that landed on
  // master after the branch started are not billed to this PR.
  return execFileSync('git', ['diff', '--numstat', `${base}...HEAD`], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
  });
}

function main(argv) {
  const opts = parseArgs(argv);
  let raw;
  try {
    raw = numstat(opts.base);
  } catch {
    process.stderr.write(
      `pr-size: cannot diff against "${opts.base}" — fetch it first, or pass --base.\n`
    );
    return opts.warnOnly ? 0 : 1;
  }
  const plan = PR.planSplit(PR.parseNumstat(raw), opts.budget);
  process.stdout.write(`${PR.formatPlan(plan, { base: opts.base })}\n`);
  return plan.withinBudget || opts.warnOnly ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`pr-size: ${err.message}\n`);
    process.exitCode = 2;
  }
}

module.exports = { parseArgs, main };
