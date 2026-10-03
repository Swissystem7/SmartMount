const test = require('node:test');
const assert = require('node:assert/strict');

let FEEDBACK_URL;
let getFeedbackUrl;
try {
  const feedback = require('../src/lib/feedback');
  if (feedback && typeof feedback.getFeedbackUrl === 'function') {
    FEEDBACK_URL = feedback.FEEDBACK_URL;
    getFeedbackUrl = feedback.getFeedbackUrl;
  } else if (typeof feedback === 'function') {
    getFeedbackUrl = feedback;
    FEEDBACK_URL = feedback.FEEDBACK_URL;
  } else {
    getFeedbackUrl = () => null;
  }
} catch {
  getFeedbackUrl = () => null;
}

const EXPECTED =
  'https://docs.google.com/forms/d/e/1FAIpQLSdT8YduNx-VWKM3bWGUJdiSj4Sw9D-EA6R6c-oYVYCQmOVXxQ/viewform?usp=pp_url&entry.368039752=SmartMount';

test('feedback link generation function returns the exact form URL with no other parameters', () => {
  assert.strictEqual(getFeedbackUrl(), EXPECTED);
});

test('FEEDBACK_URL matches the generator and stays a fixed prefilled form link', () => {
  assert.strictEqual(FEEDBACK_URL, EXPECTED);
  assert.strictEqual(getFeedbackUrl(), FEEDBACK_URL);
});
