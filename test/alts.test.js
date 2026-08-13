const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../src/lib/alts');

test('five decisions cover actuator, sensing, placement, hold, and zero', () => {
  assert.deepEqual(A.DECISIONS.map((d) => d.id), [
    'actuator', 'sensing', 'placement', 'hold', 'zero',
  ]);
});

test('the demo chose stepper + ratio + bezel + hold-current + the zero lie', () => {
  assert.equal(A.chosenOf('actuator').id, 'stepper');
  assert.equal(A.chosenOf('sensing').id, 'ratio');
  assert.equal(A.chosenOf('placement').id, 'bezel');
  assert.equal(A.chosenOf('hold').id, 'hold-current');
  assert.equal(A.chosenOf('zero').id, 'lie');
  assert.equal(A.chosenOf('actuator').verdict, 'chosen-for-demo');
  assert.match(A.chosenOf('zero').why, /שקר/);
});

test('rejected options stay rejected, with a reason long enough to be a reason', () => {
  const servo = A.rejectedOf('actuator').find((o) => o.id === 'servo');
  const abs = A.rejectedOf('sensing').find((o) => o.id === 'absolute');
  const wall = A.rejectedOf('placement').find((o) => o.id === 'wall');
  const stall = A.rejectedOf('zero').find((o) => o.id === 'stall');
  assert.ok(servo && servo.why.length > 40);
  assert.ok(abs && /חדר מואר/.test(abs.why));
  assert.ok(wall && /החזרה/.test(wall.why));
  assert.ok(stall && stall.verdict === 'rejected-as-home');
});

test('a real mount is pointed at a linear actuator + worm + endstop, not the demo BOM', () => {
  const linear = A.byId('actuator').options.find((o) => o.id === 'linear');
  const worm = A.byId('hold').options.find((o) => o.id === 'worm');
  const endstop = A.byId('zero').options.find((o) => o.id === 'endstop');
  assert.equal(linear.verdict, 'better-for-a-real-mount');
  assert.equal(worm.verdict, 'required-for-a-product');
  assert.equal(endstop.verdict, 'required-for-a-product');
});

test('unknown ids do not invent a decision', () => {
  assert.equal(A.byId('plasma'), null);
  assert.equal(A.chosenOf('plasma'), null);
  assert.deepEqual(A.rejectedOf('plasma'), []);
});
