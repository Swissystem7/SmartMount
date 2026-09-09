# HIL status — SmartMount

**Status: never-run / לא רץ.** Hardware-in-the-Loop cases are written and unit-tested as a plan; none have been executed on a board.

## Pointers

- Full bench plan: [`docs/HIL.md`](HIL.md) (exists in-repo).
- Data + STATUS field: `src/lib/hil.js`; page: `hil/`.
- HIL-10: mock mass / guard only; no television. **No TV.**

## Honesty

- Host unit tests staying green prove the cases are specified only.
- Host unit tests must not mark STATUS as run.
- Optional future: safe table HIL from docs/HIL.md without a television.
