'use strict';

const assert = require('node:assert');
const { clampServo } = require('./clampServo.js');

// normal case: rounds to integer within range
assert.strictEqual(clampServo(92.6), 93);
assert.strictEqual(clampServo(45), 45);

// clamp low
assert.strictEqual(clampServo(-20), 0);
assert.strictEqual(clampServo(0), 0);

// clamp high
assert.strictEqual(clampServo(200), 180);
assert.strictEqual(clampServo(180), 180);

// NaN -> 90 (both literal NaN and non-numeric strings)
assert.strictEqual(clampServo(NaN), 90);
assert.strictEqual(clampServo('banana'), 90);
assert.strictEqual(clampServo(undefined), 90);

console.log('ok');
