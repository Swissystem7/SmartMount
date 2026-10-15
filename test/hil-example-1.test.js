const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('docs/HIL.md includes at least one example with expected and simulated outcome', () => {
  const filePath = path.join(__dirname, '..', 'docs', 'HIL.md');
  assert.ok(fs.existsSync(filePath), 'docs/HIL.md should exist');

  const content = fs.readFileSync(filePath, 'utf8');

  assert.ok(
    /דוגמ[הת]/.test(content),
    'docs/HIL.md must contain an example (דוגמה)'
  );
  assert.ok(
    /תוצאה צפוי[הי]ה/.test(content),
    'docs/HIL.md must contain an expected outcome (תוצאה צפויה / תוצאה צפוייה)'
  );
  assert.ok(
    /תוצאה מדומה/.test(content),
    'docs/HIL.md must contain a simulated outcome (תוצאה מדומה)'
  );
});
