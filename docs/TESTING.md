# אסטרטגיית בדיקה

SmartMount נבדק **על המחשב**, בלי לוח ובלי תלויות (`npm test` → `node --test`).
הקושחה ב־`firmware/smart_mount.ino` **לא רצה מול חומרה**. הבדיקות לא טוענות אחרת.

## מה הבדיקות מוכיחות

| שכבה | קבצים | מה ננעל |
|---|---|---|
| חוק בקרה | `test/control.test.js`, `firmware-mirror.test.js` | יחס בוהק, דד-בנד, גבול פאנל, HOLD על כשל חיישן. המראה **קורא את ה־`.ino`** ומשווה נוסחה ל־JS |
| קבועים | `test/control-params.test.js` | JSON = JS שנוצר = בלוק ב־`.ino` |
| קוונטיזציה | `test/target-quantised.test.js`, `lroundf-float32.test.js` | `moveToAngle` ב־JS מחשב כמו הלוח: מכפלה ב־float32 ואז `lroundf` (חצי **מתרחק מאפס**, לא `Math.round`); `target` הוא float32 כמו `targetAngle` |
| חוזה HTTP | `test/protocol.test.js`, `emergency-stop.test.js`, `protocol-demo-target.test.js` | חמישה נתיבים (כל נתיב ב־`ROUTES` רשום ב־`.ino`), `parseFloatArg` = `strtof` (רווח לבן מוביל, hex, גלישת float32), `type` = `strtol` בצריכה מלאה (`type=foo` → 400), `/stop` = אוטו כבוי ואז `stepper.stop()`, נתיב לא מוכר או method שגוי → 404 בגוף JSON (`onNotFound`), לא text/plain; דף `protocol/` מדווח אחרי `set-angle`/`set-panel` את אותו `target` מוצמד ומכומת כמו הלוח (node:vm על הסקריפט שבדף) |
| חיישנים | `test/bh1750-begin-addr.test.js` | שני ה־BH1750 מקבלים את הכתובת גם ב־`begin()` (ברירת המחדל של הספרייה דורסת את הבנאי ל־0x23 — שני האובייקטים קראו את החיישן העליון והיחס היה 1 תמיד); `begin()` שנכשל מדפיס שורה ל־Serial |
| מעבדה | `test/lab-stop.test.js` | הסקריפט של `lab/` רץ ב־`node:vm` עם DOM מזויף: `/set-angle` ואז `/stop` → אוטו כבוי, יעד = הצעד הנוכחי, הטיקים הבאים לא מזיזים; הכפתור מחווט לאותה קריאה |
| מומנט | `test/torque.test.js`, `torque-tilt-domain.test.js` | `τ=mgd cosθ`, נפילה בלי תולעת; הטיה מעבר ל־±90° נדחית (לא מומנט שלילי → «מחזיק»), `verdict` זורק על NaN |
| אופטיקה | `test/optics.test.js` | lux ≠ nits, ארבעת מקרי אי-הסכמה |
| מכונת מצבים | `test/fsm.test.js`, `fsm-matrix.test.js` | `.ino` בלי enum/הומינג/WDT; **כל** תא 2×16 ו־11×16 מול הטבלה (כולל `STOP` = `POST /stop`); וריאנטים (אין מפסק, תקציב סטול, עצירה באמצע מהלך) |
| מעבדה — יעד | `test/lab-target-mirror.test.js` | הסקריפט של `lab/` רץ ב־`node:vm` עם DOM מזויף: היעד הוא הצעד המעוגל (`angle == target` בהגעה), `/set-panel` באמצע מהלך מצמיד את היעד ולא את הזווית המפגרת, דגימה בתוך הדד-בנד לא משכתבת `targetAngle`, HOLD מחזיק את היעד בזמן שהזרוע ממשיכה |
| תזמון | `test/timing.test.js` | `setMaxSpeed(MAX_SPEED_SPS)` / `SAMPLE_PERIOD_MS` בקושחה, הערכים מ־`config/control-params.json` (500 / 2000 ms) ו־`timing.js` קורא אותם משם; 20–40° הם משולש; HTTP 20 ms מרעיב פולסים; הבזק 400 ms מתפספס ב־80% |
| הספק | `test/power.test.js` | I²R החזקה > USB 5 V; סלילים 24 שעות הם מחמם; פאוורבנק לא מזין 12 V; תולעת הופכת 3S ל־UPS |
| HIL | `test/hil.test.js` | 13 מקרים, `STATUS=never-run`, HIL-10 אוסר טלוויזיה |
| חלופות | `test/alts.test.js` | הדמו בחר צעד+יחס+מסגרת+החזקה+שקר אפס; מפעיל קווי+תולעת+מפסק הם «למוצר» |
| הידור | `test/firmware-build.test.js` | אין `min(float, double)`; רשומת ההידור תואמת ל-sha256 של ה-`.ino` |
| מקרה הנדסי | `test/case.test.js` | פסק דין portfolio-only; באגים «תוקנו במקור» לא «אומתו על חומרה»; HIL נשאר never-run |

הבדיקות של ה־FSM והתזמון **קוראות את ה־`.ino`**. אם מישהו יוסיף הומינג או ישנה את 500/200/2000 בלי לעדכן את המודל — `npm test` ייכשל.

## הידור ל-ESP32 (בלי לוח)

נמדד ב־27.9.2026 עם `scripts/compile-firmware.sh` (arduino-cli 1.3.1, FQBN `esp32:esp32:esp32`, ‏BH1750 1.3.0, ‏AccelStepper 1.64, ‏ArduinoJson 7.4.3).

| | core 3.3.12 | core 2.0.17 |
|---|---|---|
| לפני (master ‏1cdee92) | **נכשל**: `smart_mount.ino:114: no matching function for call to 'min(float, double)'` | **נכשל**: אותה שגיאה |
| אחרי (הסרת `(double)` בשורה 114) | עובר. Flash ‏964,756 בתים (73%), RAM ‏48,888 בתים (14%) | עובר. Flash ‏786,933 בתים (60%), RAM ‏45,516 בתים (13%) |

השגיאה נכנסה בקומיט התיקון `bd675fd` (13.8.2026). כלומר, עד 27.9.2026 הקושחה לא התקמפלה בכלל.
`test/firmware-build.test.js` נועל את זה בשתי דרכים: אין `min`/`max` עם `(double)`, וה-sha256 של ה-`.ino` שווה למה שנרשם ב-`BUILD` ב-`src/lib/case.js`. משנים את הקושחה? צריך להדר מחדש ולעדכן את הרשומה, או להוריד את הטענה.

הידור הוא לא ריצה. אזהרה שנשארה ב-`--warnings all`: ‏`StaticJsonDocument` מסומן deprecated ב-ArduinoJson 7.

## מה אי אפשר לבדוק בלי לוח

- BH1750 באמת מחזיר ערך שלילי בכשל (הספרייה טוענת; לא ראינו על האוסצילוסקופ).
- מתיחת שעון I²C / תקיעת `Wire` מול שני כתובות 0x23/0x5C.
- פולסי STEP אבודים כש־`handleClient` חוסם — המודל אומר שזה אפשרי; אין לכידת לוגיקה.
- חריקת תמסורת, הילוך חוזר, פספוס מפסק קצה (אין מפסק).
- כיול יחס lux מול כתם השתקפות אמיתי. האלגוריתם **לא כויל**.
- מומנט החזקה אמיתי של מק״ט NEMA17 מסוים, או זרם chopper במנהל.

## תוכנית HIL

שלושה-עשר מקרים, אפס רצו. המסמך: [HIL.md](HIL.md). העמוד: [`hil/`](../hil/). הנתונים: `src/lib/hil.js`.

ה-GitHub Actions היחיד כאן הוא `.github/workflows/validate.yml`: מריץ את אותה חבילת בדיקות (`npm test`) על כל push ו-pull request. הוא לא ממזג, לא דוחף בכוח ולא פורס. הבדיקות רצות גם במכונה המקומית.
