// SmartMount — prefilled Google Form link for site feedback.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SM_FEEDBACK = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const FEEDBACK_URL =
    'https://docs.google.com/forms/d/e/1FAIpQLSdT8YduNx-VWKM3bWGUJdiSj4Sw9D-EA6R6c-oYVYCQmOVXxQ/viewform?usp=pp_url&entry.368039752=SmartMount';

  function getFeedbackUrl() {
    return FEEDBACK_URL;
  }

  return {
    FEEDBACK_URL,
    getFeedbackUrl,
  };
});
