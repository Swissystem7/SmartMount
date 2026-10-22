const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('power page HTML includes duty presets, hours presets, and LTR range inputs', () => {
  const html = read('power/index.html');

  assert.match(html, /<div class="row" id="dutyPresets" role="group" aria-label="תרחישי עבודה מהירים">/);
  assert.match(html, /<button type="button" class="btn on" data-duty="firmware" aria-pressed="true">קושחה \(סלילים 24h\)<\/button>/);
  assert.match(html, /<button type="button" class="btn" data-duty="worm" aria-pressed="false">נעילה עצמית \(תולעת\)<\/button>/);
  assert.match(html, /<button type="button" class="btn" data-duty="eco" aria-pressed="false">חיסכון \(שינה\)<\/button>/);
  assert.match(html, /<button type="button" class="btn" data-duty="heavy" aria-pressed="false">עומס משרדי כבד<\/button>/);

  assert.match(html, /<div class="row" id="hoursPresets" role="group" aria-label="יעדי שעות מהירים">/);
  assert.match(html, /<button type="button" class="btn" data-hours="8" aria-pressed="false">8 שעות \(משמרת\)<\/button>/);
  assert.match(html, /<button type="button" class="btn on" data-hours="24" aria-pressed="true">24 שעות \(יממה\)<\/button>/);
  assert.match(html, /<button type="button" class="btn" data-hours="48" aria-pressed="false">48 שעות \(יומיים\)<\/button>/);

  assert.match(html, /<div class="modes" id="modes" role="group" aria-label="מצבי צריכת זרם">/);
  assert.match(html, /<div class="row" id="packs" role="group" aria-label="חבילת סוללה">/);

  assert.match(html, /id="moves" min="0" max="200" step="1" value="24" dir="ltr"/);
  assert.match(html, /id="hoursWanted" min="2" max="72" step="1" value="24" dir="ltr"/);
  assert.match(html, /id="bVerdict" role="status" aria-live="polite"/);
});
