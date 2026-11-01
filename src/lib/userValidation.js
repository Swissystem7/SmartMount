// SmartMount — User Validation & Willingness-to-Pay Evaluation Module (Refs #8)
// Encodes the empirical market validation gate from RESEARCH.md and MONETIZATION.md:
// 10 motorized mount owner interviews, stop-rule: < 20% positive willingness to pay => PARK.

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SM_USER_VALIDATION = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MIN_POSITIVE_THRESHOLD = 0.2; // 2 out of 10 owners must say yes
  const TARGET_SAMPLE_SIZE = 10;

  const PRIMARY_SURVEY_QUESTION =
    'האם היית משלם תוספת של $150–$300 עבור הטיה אוטומטית מבוססת חיישן אור במקום שליטה ידנית/שלט?';

  function evaluateValidationSurvey(responses) {
    const list = Array.isArray(responses) ? responses : [];
    const valid = list.filter(function (r) {
      return r && typeof r === 'object' && typeof r.willPayExtra === 'boolean';
    });

    const positiveCount = valid.filter(function (r) { return r.willPayExtra; }).length;
    const totalCount = valid.length;
    const positiveRatio = totalCount > 0 ? positiveCount / totalCount : 0;

    let decision = 'INSUFFICIENT_DATA';
    if (totalCount >= TARGET_SAMPLE_SIZE) {
      decision = positiveRatio >= MIN_POSITIVE_THRESHOLD ? 'PROCEED' : 'PARK';
    } else if (totalCount > 0 && positiveRatio < MIN_POSITIVE_THRESHOLD && totalCount >= 5) {
      decision = 'TRENDING_PARK';
    }

    return {
      primaryQuestion: PRIMARY_SURVEY_QUESTION,
      totalResponses: totalCount,
      positiveResponses: positiveCount,
      positiveRatio: Math.round(positiveRatio * 100) / 100,
      thresholdRatio: MIN_POSITIVE_THRESHOLD,
      decision: decision,
      liabilityRiskFlag: 'UL 2442 & Product Liability insurance required before commercial sale',
    };
  }

  return {
    MIN_POSITIVE_THRESHOLD: MIN_POSITIVE_THRESHOLD,
    TARGET_SAMPLE_SIZE: TARGET_SAMPLE_SIZE,
    PRIMARY_SURVEY_QUESTION: PRIMARY_SURVEY_QUESTION,
    evaluateValidationSurvey: evaluateValidationSurvey,
  };
});
