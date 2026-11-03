# Architecture

SmartMount is a portfolio piece, not a product: ESP32 firmware that tilts a screen away from glare, plus a static Hebrew (RTL) site that runs the same control law in the browser. Nothing here talks to a real board.

## Pieces

| Path | What it is |
|---|---|
| `firmware/smart_mount.ino` | ESP32 sketch: two BH1750 sensors (0x23 / 0x5C), AccelStepper, a small HTTP API (`/status`, `/set-angle`, `/set-mode`, `/set-panel`, `POST /stop`) and Serial at 115200. Compiles; never flashed. |
| `config/control-params.json` | Single source of truth for panel limits, stepper ratio, speed and sample period. |
| `scripts/sync-control-params.js` | Writes the generated block in the `.ino` and `src/lib/control-params.js` from the JSON. |
| `src/lib/*.js` | Pure, dependency-free models shared by the pages and the tests: `control.js` (control law, mirrors the `.ino`), `protocol.js` (HTTP contract), `fsm.js` / `fsm-table.js` (state machine), `timing.js`, `power.js`, `torque.js`, `optics.js`, `hil.js`, `bom.js`, `safety.js`, `case.js` (incl. the firmware `BUILD` record), and others. Most are UMD: `require()` in Node, a `window.SM_*` global in the browser. |
| `index.html`, `404.html`, `case/`, `lab/`, `spec/`, `geometry/`, `protocol/`, `fsm/`, `runtime/`, `hil/`, `power/`, `alts/`, `dashboard/` | Static pages served by GitHub Pages (`.nojekyll`). Each page loads the `src/lib` modules it needs with plain `<script>` tags; there is no bundler. |
| `test/*.test.js` | `node:test` suites. Many read the `.ino` and the pages as text, or run page scripts in `node:vm` against a fake DOM. |
| `scripts/smoke.js` | Optional 390 px headless check of the pages with Playwright (not a dependency; it looks for an installed copy). |
| `scripts/pr-size.js`, `scripts/lib/pr-split.js` | Checks a branch against the 400-line auto-merge budget and proposes a split. |
| `scripts/compile-firmware.sh` | Local-only firmware compile with `arduino-cli` (not in CI). |
| `tools/codecov.js`, `src/lib/sentryLoader.js` | Optional coverage upload and Sentry loader; both are no-ops without their secret. |
| `docs/TESTING.md`, `docs/HIL.md` | What the tests prove, and the 13-case bench plan (never run). |

## Data flow

```
config/control-params.json
        │  npm run sync-params
        ├──────────────► firmware/smart_mount.ino   (generated block)
        └──────────────► src/lib/control-params.js
                                 │
                 src/lib/control.js, timing.js, optics.js ...
                        │                         │
              pages (<script> tags)       test/*.test.js (node:test)
```

The tests keep the copies honest: the JS mirror is compared with the `.ino` source, the generated block must match the JSON, and `BUILD.inoSha256` in `src/lib/case.js` must match the `.ino` bytes.

## Run and test

Requires Node 20 or later (CI uses 22). No npm dependencies.

```
npm ci            # lockfile only; installs nothing
npm test          # node --test, all suites
npm run smoke     # optional, needs Playwright + Chromium installed
npm run sync-params
npm run pr-size
```

Open `index.html` directly in a browser, or serve the repo root with any static server.

## Windows notes

`.gitattributes` forces LF in the working tree. The `.ino` hash and several Markdown regexes depend on it, so a CRLF checkout fails tests locally while Linux CI passes. If an old clone has CRLF files, run `git add --renormalize .` or re-clone.

## CI

`.github/workflows/validate.yml` runs `npm ci` and `npm test` on Node 22 for every push and pull request, then generates coverage (uploaded only when `CODECOV_TOKEN` is set). It does not compile the firmware.
