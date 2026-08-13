const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../src/lib/case');

test('verdict is portfolio-only and hardware is untested', () => {
  assert.equal(C.VERDICT.id, 'portfolio-only');
  assert.equal(C.VERDICT.hardware, 'untested');
  assert.match(C.VERDICT.headline, /אין נתיב הכנסה/);
  assert.match(C.VERDICT.hardwareHe, /טרם רצה/);
  assert.doesNotMatch(C.VERDICT.hardwareHe, /נבדק על חומרה|רץ על הלוח|כויל מול מדידה הושלם/);
});

test('five reviewed bugs stay fixed-in-source or fixed-in-ui, never hardware-verified', () => {
  assert.deepEqual(C.BUGS.map((b) => b.id), [
    'sensor-fail-hold',
    'absolute-moveTo',
    'api-reject',
    'wifi-timeout',
    'dashboard-honesty',
  ]);
  for (const b of C.BUGS) {
    assert.match(b.status, /^fixed-in-(source|ui)$/);
    assert.ok(b.was.length > 20);
    assert.ok(b.now.length > 20);
    assert.ok(b.where.length > 5);
    assert.doesNotMatch(b.now, /אומת על חומרה|נמדד על לוח/);
  }
  assert.equal(C.bug('sensor-fail-hold').severity, 'safety');
  assert.match(C.bug('sensor-fail-hold').now, /HOLD/);
  assert.match(C.bug('api-reject').now, /toInt|foo|OLED/);
});

test('open hazards include never-flashed and no homing', () => {
  assert.ok(C.openItem('never-flashed'));
  assert.match(C.openItem('never-flashed').why, /לא הועלתה|אפס פולסי/);
  assert.match(C.openItem('homing').why, /שקר/);
  assert.match(C.openItem('hold').why, /נפילה/);
  assert.equal(C.openItem('plasma'), null);
});

test('FSM facts match the host model: 2 firmware states, 11 safe, 165 cells', () => {
  assert.deepEqual(C.FSM.firmwareStates, ['BOOT', 'RUN']);
  assert.equal(C.FSM.safeStates.length, 11);
  assert.equal(C.FSM.cells, 165);
  assert.match(C.FSM.safeNote, /לא נכתבה ל-\.ino|לא רצה על ESP32/);
});

test('tradeoffs point at demo choices, not a proven product BOM', () => {
  assert.equal(C.TRADEOFFS.length, 3);
  assert.match(C.TRADEOFFS[0].chose, /צעד/);
  assert.match(C.TRADEOFFS[0].better, /קווי|תולעת/);
  assert.match(C.TRADEOFFS[2].chose, /שקר/);
});

test('shown / not-shown lists refuse to claim a flashed board or a sale', () => {
  assert.ok(C.SHOWN.length >= 4);
  assert.ok(C.NOT_SHOWN.some((s) => /העלאת קושחה|אוסצילוסקופ/.test(s)));
  assert.ok(C.NOT_SHOWN.some((s) => /מוצר|ערכה/.test(s)));
  const blob = C.SHOWN.join(' ');
  assert.doesNotMatch(blob, /נמכר|הועלה ללוח|כיול הושלם/);
});

test('MONETIZATION.md states the same verdict with check dates', () => {
  const md = fs.readFileSync(path.join(__dirname, '..', 'MONETIZATION.md'), 'utf8');
  assert.match(md, /אין נתיב הכנסה/);
  assert.match(md, /13 באוגוסט 2026|13\.8\.2026/);
  assert.match(md, /tindie\.com/);
  assert.match(md, /arxiv\.org\/abs\/2401\.02755/);
  assert.doesNotMatch(md, /לקנות עכשיו|הוסף לסל|ערכה זמינה למשלוח/);
});
