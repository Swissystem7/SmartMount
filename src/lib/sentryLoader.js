// SmartMount — Optional Sentry Browser Loader (Refs #194)
// Stays inert and quiet unless a real SENTRY_DSN replaces the placeholder.
// No tokens stored in source. sendDefaultPii stays false.

(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SM_SENTRY = api;
  if (typeof document !== 'undefined' && document && typeof document.querySelector === 'function') {
    try { api.initSentry(document, root); } catch (e) { /* silent on absent DSN */ }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const PLACEHOLDER = '__SENTRY_DSN__';
  const SDK = 'https://browser.sentry-cdn.com/7.76.0/bundle.min.js';

  function dsnOf(doc) {
    if (!doc || typeof doc.querySelector !== 'function') return '';
    const meta = doc.querySelector('meta[name="sentry-dsn"]');
    const dsn = meta && meta.getAttribute ? meta.getAttribute('content') : '';
    if (!dsn || dsn === PLACEHOLDER) return '';
    return /^https:\/\/[^@\s]+@[^/\s]+\/\d+$/.test(dsn) ? dsn : '';
  }

  function scrubEvent(event) {
    if (!event || typeof event !== 'object') return event;
    try { delete event.user; } catch (e) { /* ignore */ }
    const req = event.request;
    if (req && typeof req === 'object') {
      try { delete req.data; } catch (e) { /* ignore */ }
    }
    return event;
  }

  function initSentry(doc, g) {
    const dsn = dsnOf(doc);
    if (!dsn) return { enabled: false };
    const scope = g || root;
    const script = doc.createElement('script');
    script.src = SDK;
    script.crossOrigin = 'anonymous';
    script.onload = function () {
      const Sentry = scope && scope.Sentry;
      if (Sentry && typeof Sentry.init === 'function') {
        Sentry.init({
          dsn: dsn,
          sendDefaultPii: false,
          beforeSend: function (event) {
            return scrubEvent(event);
          },
        });
      }
    };
    script.onerror = function () { /* CDN blocked: demo still functions */ };
    (doc.head || doc.documentElement).appendChild(script);
    return { enabled: true };
  }

  return {
    PLACEHOLDER: PLACEHOLDER,
    SDK: SDK,
    dsnOf: dsnOf,
    initSentry: initSentry,
    scrubEvent: scrubEvent,
  };
});
