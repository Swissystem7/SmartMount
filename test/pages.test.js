const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pages = [
  'index.html',
  'lab/index.html',
  'spec/index.html',
  'geometry/index.html',
  'protocol/index.html',
  'fsm/index.html',
  'runtime/index.html',
  'dashboard/index.html',
];

test('every page is Hebrew RTL with a skip-link and a honesty banner', () => {
  for (const rel of pages) {
    const html = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.match(html, /lang="he"/, rel);
    assert.match(html, /dir="rtl"/, rel);
    assert.match(html, /skip-link/, rel);
    assert.match(html, /דלג לתוכן/, rel);
    assert.match(
      html,
      /אין חומרה|לא רץ על|לא נמדד|סימולצ|מפרט קונספט|הדגמת מוצר|אינו מחובר|לא מדידה/,
      rel + ' must stay honest about being a demo'
    );
  }
});

test('site nav names the runtime pages from every surface', () => {
  for (const rel of pages) {
    const html = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.match(html, /מכונת מצבים/, rel);
    assert.match(html, /תזמון והספק/, rel);
  }
});

test('new pages load the host modules they claim to run', () => {
  const fsm = fs.readFileSync(path.join(root, 'fsm/index.html'), 'utf8');
  assert.match(fsm, /src\/lib\/fsm\.js/);
  assert.match(fsm, /SM_FSM/);
  const rt = fs.readFileSync(path.join(root, 'runtime/index.html'), 'utf8');
  assert.match(rt, /src\/lib\/timing\.js/);
  assert.match(rt, /src\/lib\/power\.js/);
});
