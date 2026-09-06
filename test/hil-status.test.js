const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

test("docs/HIL_STATUS.md exists and states never-run / לא רץ", () => {
  const md = read("docs/HIL_STATUS.md");
  assert.match(md, /never-run|לא רץ/);
  assert.match(md, /HIL/i);
});

test("HIL_STATUS.md links docs/HIL.md and forbids TV", () => {
  const md = read("docs/HIL_STATUS.md");
  assert.match(md, /HIL\.md/);
  assert.match(md, /no TV|No TV|HIL-10/i);
});

test("docs/HIL.md still present with never-run", () => {
  const hil = read("docs/HIL.md");
  assert.match(hil, /never-run|לא רץ/);
});
