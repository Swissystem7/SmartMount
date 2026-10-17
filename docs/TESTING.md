# אסטרטגיית בדיקה

SmartMount נבדק **על המחשב**, בלי לוח ובלי תלויות (`npm test` → `node --test`).
הקושחה ב־`firmware/smart_mount.ino` **לא רצה מול חומרה**. הבדיקות לא טוענות אחרת.

## מה הבדיקות מוכיחות

| שכבה | קבצים | מה ננעל |
|---|---|---|
| חוק בקרה | `test/control.test.js`, `firmware-mirror.test.js` | יחס בוהק, דד-בנד, גבול פאנל, HOLD על כשל חיישן. המראה **קורא את ה־`.ino`** ומשווה נוסחה ל־JS |
| יעד מול מיקום | `test/deadband-target.test.js`, `set-panel-retarget.test.js`, `target-quantised.test.js` | דד-בנד ו־HOLD נמדדים מול `targetAngle`, לא מול `currentAngle` המפגר; `set-panel` מצמיד את היעד ולא הופך תנועה; היעד הוא הצעד המכומת (`angle == target` בהגעה) |
| קבועים | `test/control-params.test.js`, `firmware-min-types.test.js` | JSON = JS שנוצר = בלוק ב־`.ino`; אופרנדי `min`/`max` ב־`.ino` כולם float (בלי `(double)` ובלי ליטרל double) |
| קוונטיזציה | `test/target-quantised.test.js`, `lroundf-float32.test.js` | `moveToAngle` ב־JS מחשב כמו הלוח: מכפלה ב־float32 ואז `lroundf` (חצי **מתרחק מאפס**, לא `Math.round`); `target` הוא float32 כמו `targetAngle` |
| חוזה HTTP | `test/protocol.test.js`, `emergency-stop.test.js`, `protocol-demo-target.test.js`, `protocol-ui.test.js` | חמישה נתיבים (כל נתיב ב־`ROUTES` רשום ב־`.ino`), `parseFloatArg` = `strtof` (רווח לבן מוביל, hex, גלישת float32), `type` = `strtol` בצריכה מלאה (`type=foo` → 400), `/stop` = אוטו כבוי ואז `stepper.stop()`, נתיב לא מוכר או method שגוי → 404 בגוף JSON (`onNotFound`), לא text/plain; דף `protocol/` מדווח אחרי `set-angle`/`set-panel` את אותו `target` מוצמד ומכומת כמו הלוח (node:vm על הסקריפט שבדף); סנכרון כפתורי נתיב וקיצורי דוגמה עם מצב aria-pressed |
| חיישנים | `test/bh1750-begin-addr.test.js`, `status-lux-null.test.js` | שני ה־BH1750 מקבלים את הכתובת גם ב־`begin()` (ברירת המחדל של הספרייה דורסת את הבנאי ל־0x23 — שני האובייקטים קראו את החיישן העליון והיחס היה 1 תמיד); `begin()` שנכשל מדפיס שורה ל־Serial; `/status` מדווח קריאה כושלת כ־`null` ולא כ־lux שלילי (0 lux אמיתי עובר) |
| מעבדה | `test/lab-stop.test.js`, `lab-ui.test.js` | הסקריפט של `lab/` רץ ב־`node:vm` עם DOM מזויף: `/set-angle` ואז `/stop` → אוטו כבוי, יעד = הצעד הנוכחי, הטיקים הבאים לא מזיזים; הכפתור מחווט לאותה קריאה; סנכרון כפתורי כשל, מצב אוטו, ושקר אתחול עם מצב aria-pressed ונגישות |
| מומנט | `test/torque.test.js`, `torque-tilt-domain.test.js` | `τ=mgd cosθ`, נפילה בלי תולעת; הטיה מעבר ל־±90° נדחית (לא מומנט שלילי → «מחזיק»), `verdict` זורק על NaN |
| אופטיקה | `test/optics.test.js`, `optics-params.test.js`, `geometry-ui.test.js` | lux ≠ nits, ארבעת מקרי אי-הסכמה; הסף ורצפת ה־lux באים מ־`CONTROL_PARAMS` ולא מעותק שני, ועמוד `geometry/` טוען את `control-params.js` לפני `optics.js`; סנכרון כפתורי תרחיש גאומטריה וסוג מקור בוהק עם הסליידרים ומצב aria-pressed |
| מכונת מצבים | `test/fsm.test.js`, `fsm-matrix.test.js`, `fsm-angle-error.test.js`, `fsm-stop.test.js`, `fsm-ui.test.js`, `fsm-events-ui.test.js` | `.ino` בלי enum/הומינג/WDT; **כל** תא 2×16 ו־11×16 מול הטבלה (כולל `STOP` = `POST /stop`); וריאנטים (אין מפסק, תקציב סטול, עצירה באמצע מהלך); סנכרון כפתורי תרחיש וטבלת FSM עם מצב aria-pressed; סרגלי קבוצות אירועים, מצב aria-pressed לאירועים וניקוי יומן |
| מעבדה — יעד | `test/lab-target-mirror.test.js` | הסקריפט של `lab/` רץ ב־`node:vm` עם DOM מזויף: היעד הוא הצעד המעוגל (`angle == target` בהגעה), `/set-panel` באמצע מהלך מצמיד את היעד ולא את הזווית המפגרת, דגימה בתוך הדד-בנד לא משכתבת `targetAngle`, HOLD מחזיק את היעד בזמן שהזרוע ממשיכה |
| תזמון | `test/timing.test.js`, `timing-summary.test.js`, `runtime-presets.test.js` | `setMaxSpeed(MAX_SPEED_SPS)` / `SAMPLE_PERIOD_MS` בקושחה, הערכים מ־`config/control-params.json` (500 / 2000 ms) ו־`timing.js` קורא אותם משם; 20–40° הם משולש; HTTP 20 ms מרעיב פולסים; הבזק 400 ms מתפספס ב־80%; סנכרון כפתורי פריסט תזמון ופאנל עם הסליידרים ומצב aria-pressed |
| הספק | `test/power.test.js`, `power-best-pack.test.js`, `power-peak-phase.test.js`, `power-ui.test.js` | I²R החזקה > USB 5 V; סלילים 24 שעות הם מחמם; פאוורבנק לא מזין 12 V; תולעת הופכת 3S ל־UPS; שיא `motorPhasePeakMa` הוא זרם הפאזה של הקורא ולא תווית 17HS4401; סנכרון כפתורי מצב צריכה וחבילת סוללה עם aria-pressed |
| HIL | `test/hil.test.js`, `hil-example-1.test.js` | 13 מקרים, `STATUS=never-run`, HIL-10 אוסר טלוויזיה; `docs/HIL.md` כולל לפחות דוגמה אחת עם תוצאה צפויה ומדומה |
| חלופות | `test/alts.test.js`, `alts-search.test.js`, `alts-ui.test.js` | הדמו בחר צעד+יחס+מסגרת+החזקה+שקר אפס; מפעיל קווי+תולעת+מפסק הם «למוצר»; סנכרון צ'יפים של חיפושים נפוצים, כפתור נקה, מצב ריק ומצב aria-pressed |
| הידור | `test/firmware-build.test.js` | אין `min(float, double)`; רשומת ההידור תואמת ל-sha256 של ה-`.ino` |
| מקרה הנדסי | `test/case.test.js` | פסק דין portfolio-only; באגים «תוקנו במקור» לא «אומתו על חומרה»; HIL נשאר never-run |
| דשבורד — ממשק וזווית | `test/dashboard-target-step.test.js`, `dashboard-ui.test.js` | הסקריפט של `dashboard/` רץ ב־`node:vm` עם DOM מזויף: הזווית המוצגת היא הצעד המעוגל (`moveToAngle().target`, 12.3° → 12.24°) באוטו, בידני ובהחלפת פאנל; CLAMP נקבע מפלט החוק, כי גבול QLED מעוגל ל־29.88°; HOLD מחזיק את המוצג; כפתורי תרחיש מהיר, תיקון כיוון סליידרים ב-RTL (‏dir=ltr ו-direction:ltr) וסנכרון נגישות aria-pressed ו-aria-live |
| רשימת חלקים | `test/bom.test.js` | כל פריט עם מזהה ושם ייחודיים; `getBomItems` מחזיר עותק שאי אפשר להשחית דרכו |
| בטיחות | `test/safety.test.js`, `spec-safety-ui.test.js` | `getSafetyGuidelines` מחזיר הנחיות חשמל ומכניקה עם מזהה יציב ומיטיגציה, כעותקים שלא משחיתים את המקור; `safety.js` בתבנית UMD + `SM_SAFETY`; סנכרון כפתורי סינון בטיחות ומצב aria-pressed בעמוד המפרט |
| משוב | `test/feedback.test.js` | `FEEDBACK_URL` שווה למחולל ונשאר קישור טופס קבוע בלי פרמטרים נוספים |
| עמודים | `test/pages.test.js`, `404-ui.test.js` | כל עמוד RTL עם skip-link ובאנר כנות; דף 404 מסונכרן עם הניווט המלא של התיק ההנדסי; הדשבורד והמעבדה מריצים את חוק הבקרה המשותף; אין מוצר ענן מזויף |

הבדיקות של ה־FSM והתזמון **קוראות את ה־`.ino`**. אם מישהו יוסיף הומינג או ישנה את 500/200/2000 בלי לעדכן את המודל — `npm test` ייכשל.

כל קובץ בדיקה שהטבלה מזכירה חייב להתקיים (`test/testing-doc.test.js`), כדי שהמפה לא תצביע על בדיקה שנמחקה או ששמה שונה.

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
