const assert = require('node:assert');
const { easeSteps } = require('./easeSteps.js');

// Normal case: 0 -> 90 in 3 steps, cosine ease-in-out, rounded to 1 decimal.
// i=1: 90*(1-cos(pi/3))/2 = 90*(1-0.5)/2 = 22.5
// i=2: 90*(1-cos(2pi/3))/2 = 90*(1+0.5)/2 = 67.5
// i=3: 90*(1-cos(pi))/2 = 90*(1+1)/2 = 90
assert.deepStrictEqual(easeSteps(0, 90, 3), [22.5, 67.5, 90]);

// Last value always reaches target exactly (cos(pi) = -1).
assert.strictEqual(easeSteps(0, 90, 3).at(-1), 90);

// Edge: n < 1 -> []
assert.deepStrictEqual(easeSteps(0, 90, 0), []);
assert.deepStrictEqual(easeSteps(10, 20, -5), []);

// Edge: n = 1 -> single step lands on target.
assert.deepStrictEqual(easeSteps(10, 20, 1), [20]);

// Rounding to 1 decimal is applied.
assert.deepStrictEqual(easeSteps(0, 10, 4), [1.5, 5, 8.5, 10]);

// current == target -> flat.
assert.deepStrictEqual(easeSteps(45, 45, 3), [45, 45, 45]);

console.log('ok');
