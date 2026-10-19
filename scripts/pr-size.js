#!/usr/bin/env node
'use strict';
/**
 * Does this branch fit auto_merger's 400-line budget? If not, how to slice it?
 *   npm run pr-size [-- <git range>] [--budget N] [--json]
 * Exit 0 when the diff fits, 1 when it does not (so it can gate a push),
 * 2 on a usage or git error. See docs/TESTING.md.
 */
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { MERGE_BUDGET_LINES, parseNumstat, planSplit, formatPlan } = require('./lib/pr-split.js');

function parseArgs(argv) {
  const opts = { range: 'master...HEAD', budget: MERGE_BUDGET_LINES, json: false };
  let sawRange = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--budget') {
      const value = Number(argv[i + 1]);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`--budget needs a positive integer, got ${argv[i + 1]}`);
      }
      opts.budget = value;
      i += 1;
    } else if (arg.startsWith('--')) {
      throw new Error(`unknown option ${arg}`);
    } else if (sawRange) {
      throw new Error(`unexpected extra argument ${arg}`);
    } else {
      opts.range = arg;
      sawRange = true;
    }
  }
  return opts;
}

function main(argv) {
  let opts;
  let raw;
  try {
    opts = parseArgs(argv);
    raw = execFileSync('git', ['diff', '--numstat', opts.range], {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (err) {
    console.error(`pr-size: ${err.message}`);
    return 2;
  }

  const plan = planSplit(parseNumstat(raw), opts.budget);
  console.log(opts.json ? JSON.stringify(plan, null, 2) : `${opts.range}\n${formatPlan(plan)}`);
  return plan.fits ? 0 : 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { parseArgs, main };
