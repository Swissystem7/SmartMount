const FEEDBACK_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdT8YduNx-VWKM3bWGUJdiSj4Sw9D-EA6R6c-oYVYCQmOVXxQ/viewform?usp=pp_url&entry.368039752=SmartMount';

function getFeedbackUrl() {
  return FEEDBACK_URL;
}

getFeedbackUrl.FEEDBACK_URL = FEEDBACK_URL;
getFeedbackUrl.getFeedbackUrl = getFeedbackUrl;
getFeedbackUrl.getFeedbackLink = getFeedbackUrl;
getFeedbackUrl.generateFeedbackUrl = getFeedbackUrl;
getFeedbackUrl.generateFeedbackLink = getFeedbackUrl;

module.exports = getFeedbackUrl;
module.exports.FEEDBACK_URL = FEEDBACK_URL;
module.exports.getFeedbackUrl = getFeedbackUrl;
module.exports.getFeedbackLink = getFeedbackUrl;
module.exports.generateFeedbackUrl = getFeedbackUrl;
module.exports.generateFeedbackLink = getFeedbackUrl;
