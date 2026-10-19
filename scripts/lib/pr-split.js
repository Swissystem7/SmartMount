'use strict';
/**
 * auto_merger merges a pull request only if it changes at most 400 lines
 * (additions + deletions). A bigger PR just sits open — #158 stood at 508 and
 * was never touched — so the work has to arrive pre-sliced. This module turns
 * `git diff --numstat` output into a size and, when that is over budget, into
 * a plan of slices that each fit. Pure functions; `scripts/pr-size.js` is the
 * CLI.
 */

// The auto_merger ceiling (control#42). A PR at exactly 400 still merges.
const MERGE_BUDGET_LINES = 400;

/**
 * A rename is `old => new`, either whole-path (`a.js => b.js`) or with a
 * braced common part (`src/{a => b}/c.js`). The plan cares where the lines
 * land, so keep the new path.
 */
function renamedTo(rawPath) {
  const braced = rawPath.match(/^(.*)\{(.*) => (.*)\}(.*)$/);
  if (braced) {
    const [, prefix, , to, suffix] = braced;
    return (prefix + to + suffix).replace(/\/{2,}/g, '/');
  }
  const plain = rawPath.split(' => ');
  return plain.length === 2 ? plain[1] : rawPath;
}

/**
 * Parse `git diff --numstat` into `{ path, added, deleted, changed }` rows. A
 * binary file is reported as `-\t-\tpath`; it has no line count, so it counts
 * as 0 changed lines — the same arithmetic auto_merger does.
 */
function parseNumstat(text) {
  const rows = [];
  for (const line of String(text).split('\n')) {
    if (!line.trim()) continue;
    // Only the first two tabs separate: a path may itself contain tabs.
    const match = line.match(/^(-|\d+)\t(-|\d+)\t(.*)$/);
    if (!match) throw new Error(`unparsable numstat line: ${JSON.stringify(line)}`);
    const [, rawAdded, rawDeleted, rawPath] = match;
    const binary = rawAdded === '-' || rawDeleted === '-';
    const added = binary ? 0 : Number(rawAdded);
    const deleted = binary ? 0 : Number(rawDeleted);
    rows.push({ path: renamedTo(rawPath), added, deleted, changed: added + deleted, binary });
  }
  return rows;
}

function totalChanged(files) {
  return files.reduce((sum, f) => sum + f.changed, 0);
}

/**
 * The feature a file belongs to. One feature here spans a page, a lib module
 * and its tests — `power/index.html`, `src/lib/power.js`,
 * `test/power-ui.test.js` — so the top-level directory is the wrong unit:
 * grouping by it would ship a page without the module it loads. The feature
 * name is the first dash-separated token of the file's own name; a directory
 * page is named by its directory.
 */
function featureKey(filePath) {
  const parts = filePath.split('/');
  const base = parts[parts.length - 1];
  const name = /^index\.html?$/i.test(base) && parts.length > 1 ? parts[parts.length - 2] : base;
  const stem = name.replace(/\.test\.js$/i, '').replace(/\.[^.]+$/, '');
  return (stem.split('-')[0] || stem).toLowerCase();
}

/**
 * The units we are allowed to pack. A feature that fits stays whole, because
 * splitting a feature is what produces a PR that cannot stand on its own. A
 * feature over budget is broken down per file; nothing smaller than a file is
 * possible, so a single over-budget file is called out, not packed silently.
 */
function unitsFor(files, budget) {
  const byFeature = new Map();
  for (const file of files) {
    const key = featureKey(file.path);
    if (!byFeature.has(key)) byFeature.set(key, []);
    byFeature.get(key).push(file);
  }

  const units = [];
  for (const [key, group] of [...byFeature].sort((a, b) => a[0].localeCompare(b[0]))) {
    const changed = totalChanged(group);
    if (changed <= budget) units.push({ key, files: group, changed });
    else for (const f of group) units.push({ key: f.path, files: [f], changed: f.changed });
  }
  return units;
}

/**
 * Plan a split into slices of at most `budget` changed lines each, by
 * first-fit-decreasing: not provably minimal, but deterministic, and in
 * practice it lands on the obvious grouping. `fits` is true when the whole
 * diff is already inside the budget; `oversized` lists files no split can
 * rescue — shrink them or land them by hand.
 */
function planSplit(files, budget = MERGE_BUDGET_LINES) {
  if (!Number.isInteger(budget) || budget <= 0) {
    throw new Error(`budget must be a positive integer, got ${budget}`);
  }

  const units = unitsFor(files, budget).sort(
    (a, b) => b.changed - a.changed || a.key.localeCompare(b.key),
  );

  const slices = [];
  for (const unit of units) {
    const slice = slices.find((s) => s.changed + unit.changed <= budget);
    if (slice) {
      slice.files.push(...unit.files);
      slice.changed += unit.changed;
    } else {
      // An over-budget unit gets a slice of its own; `oversized` flags it.
      slices.push({ files: [...unit.files], changed: unit.changed });
    }
  }
  for (const slice of slices) slice.files.sort((a, b) => a.path.localeCompare(b.path));

  const total = totalChanged(files);
  return {
    budget,
    total,
    fits: total <= budget,
    slices,
    oversized: files.filter((f) => f.changed > budget).map((f) => ({ ...f })),
  };
}

/** One-screen report for the CLI. English: this is developer tooling. */
function formatPlan(plan) {
  const lines = [`changed lines: ${plan.total} (auto_merger budget: ${plan.budget})`];
  if (plan.fits) {
    lines.push('within budget — no split needed');
    return lines.join('\n');
  }

  lines.push(`over budget by ${plan.total - plan.budget} — split into ${plan.slices.length} PRs:`);
  plan.slices.forEach((slice, i) => {
    lines.push('', `  PR ${i + 1}/${plan.slices.length} — ${slice.changed} changed lines`);
    for (const f of slice.files) lines.push(`    ${f.path} (+${f.added} -${f.deleted})`);
  });

  if (plan.oversized.length) {
    lines.push('', '  no split can fix these single files — shrink them or land them by hand:');
    for (const f of plan.oversized) lines.push(`    ${f.path} — ${f.changed} changed lines`);
  }
  return lines.join('\n');
}

module.exports = { MERGE_BUDGET_LINES, featureKey, parseNumstat, totalChanged, planSplit, formatPlan };
