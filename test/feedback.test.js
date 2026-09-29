const test = require('node:test');
const assert = require('node:assert');

let getFeedbackUrl;
try {
  const feedback = require('../src/lib/feedback');
  if (typeof feedback === 'function') {
    getFeedbackUrl = feedback;
  } else if (feedback && typeof feedback.getFeedbackUrl === 'function') {
    getFeedbackUrl = feedback.getFeedbackUrl;
  } else {
    getFeedbackUrl = () => null;
  }
} catch {
  getFeedbackUrl = () => null;
}

test('feedback link generation function returns the exact form URL with no other parameters', () => {
  const expected = 'https://docs.google.com/forms/d/e/1FAIpQLSdT8YduNx-VWKM3bWGUJdiSj4Sw9D-EA6R6c-oYVYCQmOVXxQ/viewform?usp=pp_url&entry.368039752=SmartMount';
  const actual = getFeedbackUrl();
  assert.strictEqual(actual, expected);
});
