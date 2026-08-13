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

const root = path.join(__dirname, '..');
const jsonPath = path.join(root, 'config', 'control-params.json');
const spec = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const limits = spec.panels.map((p) => p.limitDeg);
const names = spec.panels.map((p) => p.id);
const stepsPerDegree = (spec.stepper.stepsPerRev * spec.stepper.gearRatio) / 360;
const limitsObj = Object.fromEntries(spec.panels.map((p) => [p.id, p.limitDeg]));

const BEGIN = '// >>> BEGIN GENERATED control-params';
const END = '// <<< END GENERATED control-params';

const inoBlock = [
  BEGIN,
  '// Generated from config/control-params.json by scripts/sync-control-params.js — do not edit.',
  `// ${spec.comment}`,
  `const float PANEL_LIMITS[] = { ${limits.map((n) => n.toFixed(1)).join(', ')} };  // ${names.join(', ')}`,
  `const int   PANEL_COUNT    = ${spec.panels.length};`,
  `const float GLARE_THRESHOLD = ${spec.glareThreshold.toFixed(1)}f;`,
  `const float GAIN_DEG_PER_RATIO = ${spec.gainDegPerRatio.toFixed(1)}f;`,
  `const float MIN_LUX = ${spec.minLux.toFixed(1)}f;`,
  `const float DEADBAND_DEG = ${spec.deadbandDeg.toFixed(1)}f;`,
  `const float STEPS_PER_REV = ${spec.stepper.stepsPerRev.toFixed(1)}f;`,
  `const float GEAR_RATIO = ${spec.stepper.gearRatio.toFixed(1)}f;`,
  `const float STEPS_PER_DEGREE = (STEPS_PER_REV * GEAR_RATIO) / 360.0f;`,
  END,
].join('\n');

const inoPath = path.join(root, 'firmware', 'smart_mount.ino');
let ino = fs.readFileSync(inoPath, 'utf8');
const re = new RegExp(
  BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    '[\\s\\S]*?' +
    END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
);
if (!re.test(ino)) {
  throw new Error('smart_mount.ino is missing the GENERATED control-params markers');
}
ino = ino.replace(re, inoBlock);
fs.writeFileSync(inoPath, ino);

const js = `// GENERATED from config/control-params.json by scripts/sync-control-params.js — do not edit.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CONTROL_PARAMS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return Object.freeze({
    comment: ${JSON.stringify(spec.comment)},
    panels: Object.freeze(${JSON.stringify(spec.panels)}),
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
fs.writeFileSync(path.join(root, 'src', 'lib', 'control-params.js'), js);
console.log('synced control-params → firmware/smart_mount.ino + src/lib/control-params.js');
