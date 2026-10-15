// SmartMount — contact box. Reads config/contact.js (SM_CONTACT_CONFIG).
//
// Markup contract (see case/index.html, index.html):
//   <div id="contactBox">
//     <a data-contact-direct hidden></a>           shown only when CONTACT is set
//     <span data-contact-issue> ... form link ... </span>   shown otherwise
//   </div>
// Without JavaScript the issue-form link is what the reader gets.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.SM_CONTACT = api;
    if (root.document) {
      const run = function () { api.render(root.document, root.SM_CONTACT_CONFIG); };
      if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', run);
      else run();
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function resolveContact(value, issueForm) {
    const v = typeof value === 'string' ? value.trim() : '';
    if (/^mailto:[^\s<>"']+$/i.test(v)) return { kind: 'direct', href: v, label: 'מייל' };
    if (/^tel:\+?[0-9\-() ]{6,}$/i.test(v)) return { kind: 'direct', href: v, label: 'טלפון' };
    if (/^https:\/\/[^\s<>"']+$/i.test(v)) {
      const label = /^https:\/\/([a-z]+\.)?linkedin\.com\//i.test(v) ? 'LinkedIn'
        : /^https:\/\/(docs\.google\.com\/forms\/|forms\.gle\/)/i.test(v) ? 'טופס Google'
        : 'קורות חיים / פרופיל';
      return { kind: 'direct', href: v, label: label };
    }
    return { kind: 'issue', href: issueForm };
  }

  function render(doc, cfg) {
    if (!doc || !cfg) return;
    const box = doc.getElementById('contactBox');
    if (!box) return;
    const r = resolveContact(cfg.CONTACT, cfg.ISSUE_FORM);
    const direct = box.querySelector('[data-contact-direct]');
    const issue = box.querySelector('[data-contact-issue]');
    if (r.kind === 'direct' && direct) {
      direct.href = r.href;
      direct.textContent = 'יצירת קשר: ' + r.label;
      direct.hidden = false;
      if (issue) issue.hidden = true;
    } else if (direct) {
      direct.hidden = true;
      direct.removeAttribute('href');
    }
  }

  return { resolveContact: resolveContact, render: render };
});
