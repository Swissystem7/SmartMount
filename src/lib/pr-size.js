// SmartMount — PR size budget: measure a branch's diff and plan a split.
//
// auto_merger only merges a pull request of at most MERGE_BUDGET_LINES changed
// lines (additions + deletions). An oversized PR is not rejected — it is simply
// never merged, so it sits open until somebody splits it by hand (that is what
// happened to #154, at 533 lines).
//
// This is the pure half: parse `git diff --numstat`, total the changed lines,
// pack them into batches that each fit the budget. scripts/pr-size.js is the
// CLI around it. Packing is per top-level area (firmware/, test/, src/, …) —
// the coarsest unit that still tends to stand on its own — and is a suggestion,
// not a verdict: only a human knows whether two areas have to land together.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SM_PR_SIZE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // auto_merger's ceiling. Keep in sync with .github/copilot-instructions.md.
  const MERGE_BUDGET_LINES = 400;

  const ROOT_AREA = '(root)';

  // git spells renames two ways in --numstat:
  //   "old/path.js => new/path.js"         (no shared prefix)
  //   "src/{old => new}/path.js"           (shared prefix and suffix)
  // Both describe one file; we bill it to its destination.
  function resolvePath(raw) {
    const path = raw.trim();
    const brace = path.match(/^(.*)\{(.*?) => (.*?)\}(.*)$/);
    if (brace) {
      const [, prefix, , to, suffix] = brace;
      return (prefix + to + suffix).replace(/\/{2,}/g, '/');
    }
    const arrow = path.split(' => ');
    return arrow.length === 2 ? arrow[1].trim() : path;
  }

  function areaOf(path) {
    const slash = path.indexOf('/');
    return slash === -1 ? ROOT_AREA : path.slice(0, slash);
  }

  // Parses `git diff --numstat`. Binary files report "-" for both counts;
  // they carry no reviewable lines, so they weigh 0 but stay in the listing.
  function parseNumstat(text) {
    const files = [];
    for (const line of String(text).split('\n')) {
      if (!line.trim()) continue;
      const parts = line.split('\t');
      if (parts.length < 3) continue;
      const [rawAdded, rawDeleted, ...rest] = parts;
      const binary = rawAdded === '-' || rawDeleted === '-';
      const added = binary ? 0 : Number.parseInt(rawAdded, 10);
      const deleted = binary ? 0 : Number.parseInt(rawDeleted, 10);
      if (!binary && (Number.isNaN(added) || Number.isNaN(deleted))) continue;
      const path = resolvePath(rest.join('\t'));
      files.push({ path, area: areaOf(path), added, deleted, binary, changed: added + deleted });
    }
    return files;
  }

  function totalChangedLines(files) {
    return files.reduce((sum, f) => sum + f.changed, 0);
  }

  // Biggest first, name as tie-break, so the same diff always plans the same way.
  function bySizeThenName(a, b) {
    return b.changed - a.changed || a.name.localeCompare(b.name);
  }

  function groupByArea(files) {
    const byArea = new Map();
    for (const file of files) {
      const group = byArea.get(file.area) || { name: file.area, files: [], changed: 0 };
      group.files.push(file);
      group.changed += file.changed;
      byArea.set(file.area, group);
    }
    return [...byArea.values()].sort(bySizeThenName);
  }

  // First-fit-decreasing. Good enough here: a diff has a handful of areas, and
  // a tighter packing would not make the batches any more reviewable.
  function packUnits(units, budget) {
    const batches = [];
    for (const unit of units) {
      let bin = batches.find((b) => b.changedLines + unit.changed <= budget);
      if (!bin) {
        bin = { index: batches.length + 1, units: [], files: [], changedLines: 0 };
        batches.push(bin);
      }
      bin.units.push(unit.name);
      bin.files.push(...unit.files);
      bin.changedLines += unit.changed;
    }
    return batches;
  }

  // Cuts a diff into PRs that each fit the budget. Areas that fit are packed
  // whole; an area larger than the budget on its own is re-packed file by file,
  // so src/ at 600 lines still yields a plan. A single *file* over the budget
  // cannot be split by path at all — it is named in `oversized` instead.
  function planSplit(files, budget = MERGE_BUDGET_LINES) {
    const limit = Number(budget) > 0 ? Number(budget) : MERGE_BUDGET_LINES;
    const total = totalChangedLines(files);
    const units = [];
    const oversized = [];

    for (const group of groupByArea(files)) {
      if (group.changed <= limit) {
        units.push(group);
        continue;
      }
      // Area too big on its own: drop to file granularity inside it.
      for (const file of [...group.files].sort((a, b) => b.changed - a.changed || a.path.localeCompare(b.path))) {
        if (file.changed > limit) oversized.push({ path: file.path, changed: file.changed });
        units.push({ name: file.path, files: [file], changed: file.changed });
      }
    }

    return {
      budget: limit,
      total,
      withinBudget: total <= limit,
      overBy: Math.max(0, total - limit),
      batches: packUnits(units.sort(bySizeThenName), limit),
      oversized,
    };
  }

  function formatPlan(plan, { base = 'origin/master' } = {}) {
    const head = `changed lines vs ${base}: ${plan.total} (auto_merger budget: ${plan.budget})`;
    if (plan.withinBudget) {
      return `${head}\nwithin budget — auto_merger can merge this PR as one piece.`;
    }
    return [
      head,
      `over budget by ${plan.overBy}. auto_merger will not merge this PR.`,
      `suggested split into ${plan.batches.length} PRs:`,
      ...plan.batches.map((b) => `  PR ${b.index} — ${b.changedLines} lines: ${b.units.join(', ')}`),
      ...plan.oversized.map((f) => `  note: ${f.path} is ${f.changed} lines on its own — split it by hand.`),
      'Each batch must still stand on its own; regroup them if one does not.',
    ].join('\n');
  }

  return {
    MERGE_BUDGET_LINES, ROOT_AREA, resolvePath, areaOf,
    parseNumstat, totalChangedLines, groupByArea, planSplit, formatPlan,
  };
});
