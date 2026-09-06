# Params SSOT — SmartMount

**Single source of truth:** [`config/control-params.json`](../config/control-params.json)

**Sync script:** [`scripts/sync-control-params.js`](../scripts/sync-control-params.js)
(`npm run sync-params`)

## What sync writes

1. Marked block in `firmware/smart_mount.ino` (`BEGIN/END GENERATED control-params`)
2. `src/lib/control-params.js` for browser + Node (no bundler)

Edit the JSON, run the sync script, then `npm test`. Tests fail if JSON and generated code diverge (`test/control-params.test.js`).

## Honesty

Firmware was written against these params but **never flashed** to hardware — SSOT discipline is for the portfolio demo, not a calibrated product.
