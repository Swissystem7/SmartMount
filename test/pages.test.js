const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pages = [
  'index.html',
  '404.html',
  'case/index.html',
  'lab/index.html',
  'spec/index.html',
  'geometry/index.html',
  'protocol/index.html',
  'fsm/index.html',
  'runtime/index.html',
  'power/index.html',
  'hil/index.html',
  'alts/index.html',
  'dashboard/index.html',
];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('every page is Hebrew RTL with a skip-link, #main, and a honesty banner', () => {
  for (const rel of pages) {
    const html = read(rel);
    assert.match(html, /lang="he"/, rel);
    assert.match(html, /dir="rtl"/, rel);
    assert.match(html, /skip-link/, rel);
    assert.match(html, /דלג לתוכן/, rel);
    assert.match(html, /id="main"/, rel);
    assert.match(html, /tabindex="-1"/, rel);
    assert.match(html, /href="#main"/, rel);
    assert.match(html, /assets\/favicon\.svg/, rel);
    assert.match(html, /nav-more/, rel);
    assert.match(
      html,
      /אין חומרה|לא רץ על|לא רצה על|לא נמדד|סימולצ|מפרט קונספט|הדגמת מוצר|אינו מחובר|לא מדידה|תיק עבודות|לא קיים/,
      rel + ' must stay honest about being a demo'
    );
  }
});

test('site nav names the engineering pages from every surface', () => {
  for (const rel of pages) {
    if (rel === '404.html') continue;
    const html = read(rel);
    assert.match(html, /מקרה הנדסי/, rel);
    assert.match(html, /מכונת מצבים/, rel);
    assert.match(html, /תזמון והספק/, rel);
    assert.match(html, /תקציב הספק/, rel);
    assert.match(html, /תוכנית HIL/, rel);
    assert.match(html, /חלופות/, rel);
  }
});

test('live HTML has no fake Cloud product, login wall, or ₪9.90 plan', () => {
  for (const rel of pages) {
    const html = read(rel);
    assert.doesNotMatch(html, /SmartMount Cloud|הפעל ניסיון|₪9\.90|החשבון שלי|צור חשבון/, rel);
    assert.doesNotMatch(html, /openAuth\(|startTrial\(|sm_cloud_trial/, rel);
  }
});

test('dashboard and lab run the shared control law, not a private copy', () => {
  const dash = read('dashboard/index.html');
  assert.match(dash, /src\/lib\/control\.js/);
  assert.match(dash, /src\/lib\/control-params\.js/);
  assert.match(dash, /calcOptimalAngle/);
  assert.doesNotMatch(dash, /function calcOptimalAngle/);
  const lab = read('lab/index.html');
  assert.match(lab, /src\/lib\/control\.js/);
  assert.match(lab, /src\/lib\/protocol\.js/);
  assert.doesNotMatch(lab, /function calcOptimalAngle/);
});

test('new pages load the host modules they claim to run', () => {
  const fsm = read('fsm/index.html');
  assert.match(fsm, /src\/lib\/fsm\.js/);
  assert.match(fsm, /src\/lib\/fsm-table\.js/);
  assert.match(fsm, /SM_FSM_TABLE/);
  const rt = read('runtime/index.html');
  assert.match(rt, /src\/lib\/timing\.js/);
  assert.match(rt, /src\/lib\/power\.js/);
  assert.match(rt, /loopPhases|latencyChain|missProbability/);
  const power = read('power/index.html');
  assert.match(power, /src\/lib\/power\.js/);
  assert.match(power, /sizeBattery/);
  const hil = read('hil/index.html');
  assert.match(hil, /src\/lib\/hil\.js/);
  assert.match(hil, /never-run/);
  const alts = read('alts/index.html');
  assert.match(alts, /src\/lib\/alts\.js/);
  assert.match(alts, /SM_ALTS/);
  const cse = read('case/index.html');
  assert.match(cse, /src\/lib\/case\.js/);
  assert.match(cse, /SM_CASE/);
  assert.match(cse, /לא רצה על לוח/);
  assert.doesNotMatch(cse, /נבדק על חומרה אמיתית|הקושחה רצה על ESP32/);
});

test('landing is a 30-second story, not a 12-button catalog', () => {
  const html = read('index.html');
  assert.match(html, /לא רצה על לוח/);
  assert.match(html, /לא כויל/);
  assert.match(html, /PARK|אין נתיב הכנסה/);
  assert.match(html, /אבירן|Aviran/);
  assert.match(html, /href="\.\/case\/"/);
  assert.match(html, /href="\.\/lab\/"/);
  const primary = (html.match(/class="btn primary"/g) || []).length;
  assert.equal(primary, 1);
});

test('pages do not point recruiters at raw .md on GitHub Pages', () => {
  for (const rel of pages) {
    const html = read(rel);
    assert.doesNotMatch(html, /href="\.\.\/(RESEARCH|MONETIZATION|docs\/)\.md/, rel);
    assert.doesNotMatch(html, /href="\.\.\/docs\/[A-Z]+\.md"/, rel);
  }
});

test('RESEARCH.md panel limits match the firmware (OLED widest)', () => {
  const md = read('RESEARCH.md');
  assert.match(md, /OLED ל־40°/);
  assert.match(md, /QLED ל־30°/);
  assert.match(md, /LED ל־20°/);
  assert.doesNotMatch(md, /OLED ל־20°, QLED ל־40°, LED ל־30°/);
});

test('there is still no GitHub Actions workflow in this repo', () => {
  const wf = path.join(root, '.github', 'workflows');
  assert.equal(fs.existsSync(wf), false);
});

test('package.json stays dependency-free', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
  assert.equal(pkg.scripts.test, 'node --test');
});
