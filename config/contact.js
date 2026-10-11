// SmartMount — the ONE place for a direct contact link.
//
// CONTACT: set on 28.9 to his Google Form
// "משוב על האפליקציות", with the app field pre-filled as SmartMount.
// Nobody invents contact details here. Other valid forms, for example
//   'mailto:<address>'  or  'https://www.linkedin.com/in/<profile>'  or  'tel:<number>'.
// Only mailto:, https: and tel: are accepted; anything else is ignored.
// If it is emptied, every page shows the Hebrew GitHub issue form instead.
(function (root) {
  const cfg = Object.freeze({
    CONTACT: 'https://docs.google.com/forms/d/e/1FAIpQLSdT8YduNx-VWKM3bWGUJdiSj4Sw9D-EA6R6c-oYVYCQmOVXxQ/viewform?usp=pp_url&entry.368039752=SmartMount',
    ISSUE_FORM: 'https://github.com/Swissystem7/SmartMount/issues/new?template=recruiter.yml',
  });
  if (typeof module === 'object' && module.exports) module.exports = cfg;
  else root.SM_CONTACT_CONFIG = cfg;
})(typeof globalThis !== 'undefined' ? globalThis : this);
