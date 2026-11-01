const test = require('node:test');
const assert = require('node:assert/strict');
const UV = require('../src/lib/userValidation');

test('userValidation exports threshold constants and question', () => {
  assert.equal(UV.MIN_POSITIVE_THRESHOLD, 0.2);
  assert.equal(UV.TARGET_SAMPLE_SIZE, 10);
  assert.match(UV.PRIMARY_SURVEY_QUESTION, /150–\$300/);
});

test('evaluateValidationSurvey yields INSUFFICIENT_DATA on empty sample', () => {
  const result = UV.evaluateValidationSurvey([]);
  assert.equal(result.totalResponses, 0);
  assert.equal(result.decision, 'INSUFFICIENT_DATA');
});

test('evaluateValidationSurvey declares PARK when < 2 of 10 owners say yes', () => {
  const responses = [
    { willPayExtra: false },
    { willPayExtra: false },
    { willPayExtra: true },
    { willPayExtra: false },
    { willPayExtra: false },
    { willPayExtra: false },
    { willPayExtra: false },
    { willPayExtra: false },
    { willPayExtra: false },
    { willPayExtra: false },
  ];

  const result = UV.evaluateValidationSurvey(responses);
  assert.equal(result.totalResponses, 10);
  assert.equal(result.positiveResponses, 1);
  assert.equal(result.positiveRatio, 0.1);
  assert.equal(result.decision, 'PARK');
});

test('evaluateValidationSurvey declares PROCEED when >= 20% agree', () => {
  const responses = Array.from({ length: 10 }, (_, i) => ({ willPayExtra: i < 3 }));
  const result = UV.evaluateValidationSurvey(responses);
  assert.equal(result.totalResponses, 10);
  assert.equal(result.positiveResponses, 3);
  assert.equal(result.decision, 'PROCEED');
});
