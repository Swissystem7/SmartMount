// SmartMount — the ONE place for a direct contact link.
//
// CONTACT is empty on purpose: nobody invents contact details here.
// The owner fills exactly this one value, for example
//   'mailto:<address>'  or  'https://www.linkedin.com/in/<profile>'  or  'tel:<number>'.
// Only mailto:, https: and tel: are accepted; anything else is ignored.
// While it is empty, every page shows the Hebrew GitHub issue form instead.
(function (root) {
  const cfg = Object.freeze({
    CONTACT: '',
    ISSUE_FORM: 'https://github.com/Swissystem7/SmartMount/issues/new?template=recruiter.yml',
  });
  if (typeof module === 'object' && module.exports) module.exports = cfg;
  else root.SM_CONTACT_CONFIG = cfg;
})(typeof globalThis !== 'undefined' ? globalThis : this);
