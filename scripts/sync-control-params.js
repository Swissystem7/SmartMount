#!/usr/bin/env node
/**
 * Single source of truth: config/control-params.json
 * Generates:
 *   - marked block in firmware/smart_mount.ino  (npm test greps the block)
 *   - src/lib/control-params.js                 (browser + Node, no bundler)
 *
 * Edit the JSON, then: node scripts/sync-control-params.js
 */
const fs = require('fs');
const path = require('path');

const BEGIN = '// >>> BEGIN GENERATED control-params';
const END = '// <<< END GENERATED control-params';

/**
 * C float literal that preserves the JSON number.
 * Old code used n.toFixed(1), which rounded 2.75 → "2.8" in the .ino while
 * the generated JS kept 2.75 — host control law and firmware then disagreed
 * (e.g. glareRatio 2.76 tilted on the laptop and held on the board).
 */
function cFloatLiteral(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) throw new Error('non-finite control param: ' + n);
  let s = Object.is(x, -0) ? '0' : String(x);
  if (!/[.eE]/.test(s)) s += '.0';
  return s;
}

function buildInoBlock(spec) {
  const limits = spec.panels.map((p) => p.limitDeg);
  const names = spec.panels.map((p) => p.id);
  return [
    BEGIN,
    '// Generated from config/control-params.json by scripts/sync-control-params.js — do not edit.',
    `// ${spec.comment}`,
    `const float PANEL_LIMITS[] = { ${limits.map(cFloatLiteral).join(', ')} };  // ${names.join(', ')}`,
    `const int   PANEL_COUNT    = ${spec.panels.length};`,
    `const float GLARE_THRESHOLD = ${cFloatLiteral(spec.glareThreshold)}f;`,
    `const float GAIN_DEG_PER_RATIO = ${cFloatLiteral(spec.gainDegPerRatio)}f;`,
    `const float MIN_LUX = ${cFloatLiteral(spec.minLux)}f;`,
    `const float DEADBAND_DEG = ${cFloatLiteral(spec.deadbandDeg)}f;`,
    `const float STEPS_PER_REV = ${cFloatLiteral(spec.stepper.stepsPerRev)}f;`,
    `const float GEAR_RATIO = ${cFloatLiteral(spec.stepper.gearRatio)}f;`,
    `const float STEPS_PER_DEGREE = (STEPS_PER_REV * GEAR_RATIO) / 360.0f;`,
    END,
  ].join('\n');
}

function buildJsModule(spec) {
  const limits = spec.panels.map((p) => p.limitDeg);
  const names = spec.panels.map((p) => p.id);
  const stepsPerDegree = (spec.stepper.stepsPerRev * spec.stepper.gearRatio) / 360;
  const limitsObj = Object.fromEntries(spec.panels.map((p) => [p.id, p.limitDeg]));
  // Deep-freeze each panel entry: a shallow freeze on the array alone still
  // lets callers mutate limitDeg and desync panels[] from limits{}.
  const panelsLiteral = spec.panels
    .map((p) => `Object.freeze(${JSON.stringify(p)})`)
    .join(', ');
  return `// GENERATED from config/control-params.json by scripts/sync-control-params.js — do not edit.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CONTROL_PARAMS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return Object.freeze({
    comment: ${JSON.stringify(spec.comment)},
    // Deep-freeze each panel entry: a shallow freeze on the array alone still
    // lets callers mutate limitDeg and desync panels[] from limits{}.
    panels: Object.freeze([${panelsLiteral}]),
    limits: Object.freeze(${JSON.stringify(limitsObj)}),
    limitsArray: Object.freeze(${JSON.stringify(limits)}),
    panelNames: Object.freeze(${JSON.stringify(names)}),
    glareThreshold: ${spec.glareThreshold},
    gainDegPerRatio: ${spec.gainDegPerRatio},
    minLux: ${spec.minLux},
    deadbandDeg: ${spec.deadbandDeg},
    stepsPerRev: ${spec.stepper.stepsPerRev},
    gearRatio: ${spec.stepper.gearRatio},
    stepsPerDegree: ${stepsPerDegree},
  });
});
`;
}

/** Parse float literals out of a generated .ino block for host↔FW equality checks. */
function parseInoScalars(block) {
  const num = (re) => {
    const m = block.match(re);
    if (!m) return null;
    return parseFloat(m[1]);
  };
  const limitsM = block.match(/PANEL_LIMITS\[\] = \{([^}]*)\}/);
  const limits = limitsM
    ? limitsM[1].split(',').map((s) => parseFloat(s.trim()))
    : null;
  return {
    limits,
    glareThreshold: num(/GLARE_THRESHOLD = ([0-9eE.+-]+)f/),
    gainDegPerRatio: num(/GAIN_DEG_PER_RATIO = ([0-9eE.+-]+)f/),
    minLux: num(/MIN_LUX = ([0-9eE.+-]+)f/),
    deadbandDeg: num(/DEADBAND_DEG = ([0-9eE.+-]+)f/),
    stepsPerRev: num(/STEPS_PER_REV = ([0-9eE.+-]+)f/),
    gearRatio: num(/GEAR_RATIO = ([0-9eE.+-]+)f/),
  };
}

function syncFromSpec(spec, paths) {
  const inoBlock = buildInoBlock(spec);
  let ino = fs.readFileSync(paths.inoPath, 'utf8');
  const re = new RegExp(
    BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      '[\\s\\S]*?' +
      END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  if (!re.test(ino)) {
    throw new Error('smart_mount.ino is missing the GENERATED control-params markers');
  }
  ino = ino.replace(re, inoBlock);
  fs.writeFileSync(paths.inoPath, ino);
  fs.writeFileSync(paths.jsPath, buildJsModule(spec));
  return { inoBlock };
}

function main() {
  const root = path.join(__dirname, '..');
  const jsonPath = path.join(root, 'config', 'control-params.json');
  const spec = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  syncFromSpec(spec, {
    inoPath: path.join(root, 'firmware', 'smart_mount.ino'),
    jsPath: path.join(root, 'src', 'lib', 'control-params.js'),
  });
  console.log('synced control-params → firmware/smart_mount.ino + src/lib/control-params.js');
}

module.exports = {
  BEGIN,
  END,
  cFloatLiteral,
  buildInoBlock,
  buildJsModule,
  parseInoScalars,
  syncFromSpec,
  main,
};

if (require.main === module) {
  main();
}
