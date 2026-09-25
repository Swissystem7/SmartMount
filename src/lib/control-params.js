// GENERATED from config/control-params.json by scripts/sync-control-params.js — do not edit.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CONTROL_PARAMS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return Object.freeze({
    comment: "OLED ~178° viewing angle; VA/LED wash out off-axis so they get a tighter tilt cap.",
    // Deep-freeze each panel entry: a shallow freeze on the array alone still
    // lets callers mutate limitDeg and desync panels[] from limits{}.
    panels: Object.freeze([Object.freeze({"id":"OLED","limitDeg":40}), Object.freeze({"id":"QLED","limitDeg":30}), Object.freeze({"id":"LED","limitDeg":20})]),
    limits: Object.freeze({"OLED":40,"QLED":30,"LED":20}),
    limitsArray: Object.freeze([40,30,20]),
    panelNames: Object.freeze(["OLED","QLED","LED"]),
    glareThreshold: 3,
    gainDegPerRatio: 5,
    minLux: 1,
    deadbandDeg: 1,
    stepsPerRev: 200,
    gearRatio: 5,
    stepsPerDegree: 2.7777777777777777,
  });
});
