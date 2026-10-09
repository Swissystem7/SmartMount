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
| חוזה HTTP | `test/protocol.test.js`, `emergency-stop.test.js`, `protocol-demo-target.test.js` | חמישה נתיבים (כל נתיב ב־`ROUTES` רשום ב־`.ino`), `parseFloatArg` = `strtof` (רווח לבן מוביל, hex, גלישת float32), `type` = `strtol` בצריכה מלאה (`type=foo` → 400), `/stop` = אוטו כבוי ואז `stepper.stop()`, נתיב לא מוכר או method שגוי → 404 בגוף JSON (`onNotFound`), לא text/plain; דף `protocol/` מדווח אחרי `set-angle`/`set-panel` את אותו `target` מוצמד ומכומת כמו הלוח (node:vm על הסקריפט שבדף) |
| חיישנים | `test/bh1750-begin-addr.test.js`, `status-lux-null.test.js` | שני ה־BH1750 מקבלים את הכתובת גם ב־`begin()` (ברירת המחדל של הספרייה דורסת את הבנאי ל־0x23 — שני האובייקטים קראו את החיישן העליון והיחס היה 1 תמיד); `begin()` שנכשל מדפיס שורה ל־Serial; `/status` מדווח קריאה כושלת כ־`null` ולא כ־lux שלילי (0 lux אמיתי עובר) |
| מעבדה | `test/lab-stop.test.js` | הסקריפט של `lab/` רץ ב־`node:vm` עם DOM מזויף: `/set-angle` ואז `/stop` → אוטו כבוי, יעד = הצעד הנוכחי, הטיקים הבאים לא מזיזים; הכפתור מחווט לאותה קריאה |
| מומנט | `test/torque.test.js`, `torque-tilt-domain.test.js` | `τ=mgd cosθ`, נפילה בלי תולעת; הטיה מעבר ל־±90° נדחית (לא מומנט שלילי → «מחזיק»), `verdict` זורק על NaN |
| אופטיקה | `test/optics.test.js`, `optics-params.test.js` | lux ≠ nits, ארבעת מקרי אי-הסכמה; הסף ורצפת ה־lux באים מ־`CONTROL_PARAMS` ולא מעותק שני, ועמוד `geometry/` טוען את `control-params.js` לפני `optics.js` |
| מכונת מצבים | `test/fsm.test.js`, `fsm-matrix.test.js`, `fsm-angle-error.test.js`, `fsm-stop.test.js` | `.ino` בלי enum/הומינג/WDT; **כל** תא 2×16 ו־11×16 מול הטבלה (כולל `STOP` = `POST /stop`); וריאנטים (אין מפסק, תקציב סטול, עצירה באמצע מהלך) |
| מעבדה — יעד | `test/lab-target-mirror.test.js` | הסקריפט של `lab/` רץ ב־`node:vm` עם DOM מזויף: היעד הוא הצעד המעוגל (`angle == target` בהגעה), `/set-panel` באמצע מהלך מצמיד את היעד ולא את הזווית המפגרת, דגימה בתוך הדד-בנד לא משכתבת `targetAngle`, HOLD מחזיק את היעד בזמן שהזרוע ממשיכה |
| תזמון | `test/timing.test.js`, `timing-summary.test.js` | `setMaxSpeed(MAX_SPEED_SPS)` / `SAMPLE_PERIOD_MS` בקושחה, הערכים מ־`config/control-params.json` (500 / 2000 ms) ו־`timing.js` קורא אותם משם; 20–40° הם משולש; HTTP 20 ms מרעיב פולסים; הבזק 400 ms מתפספס ב־80% |
| הספק | `test/power.test.js`, `power-best-pack.test.js`, `power-peak-phase.test.js` | I²R החזקה > USB 5 V; סלילים 24 שעות הם מחמם; פאוורבנק לא מזין 12 V; תולעת הופכת 3S ל־UPS; שיא `motorPhasePeakMa` הוא זרם הפאזה של הקורא ולא תווית 17HS4401 |
| HIL | `test/hil.test.js`, `hil-example-1.test.js` | 13 מקרים, `STATUS=never-run`, HIL-10 אוסר טלוויזיה; `docs/HIL.md` כולל לפחות דוגמה אחת עם תוצאה צפויה ומדומה |
| חלופות | `test/alts.test.js`, `alts-search.test.js` | הדמו בחר צעד+יחס+מסגרת+החזקה+שקר אפס; מפעיל קווי+תולעת+מפסק הם «למוצר» |
| מקרה הנדסי | `test/case.test.js` | פסק דין portfolio-only; באגים «תוקנו במקור» לא «אומתו על חומרה»; HIL נשאר never-run |
| רשימת חלקים | `test/bom.test.js` | כל פריט עם מזהה ושם ייחודיים; `getBomItems` מחזיר עותק שאי אפשר להשחית דרכו |
| בטיחות | `test/safety.test.js` | `getSafetyGuidelines` מחזיר הנחיות חשמל ומכניקה עם מזהה יציב ומיטיגציה, כעותקים שלא משחיתים את המקור; `safety.js` בתבנית UMD + `SM_SAFETY` |
| משוב | `test/feedback.test.js` | `FEEDBACK_URL` שווה למחולל ונשאר קישור טופס קבוע בלי פרמטרים נוספים |
| עמודים | `test/pages.test.js` | כל עמוד RTL עם skip-link ובאנר כנות; הדשבורד והמעבדה מריצים את חוק הבקרה המשותף; אין מוצר ענן מזויף |

הבדיקות של ה־FSM והתזמון **קוראות את ה־`.ino`**. אם מישהו יוסיף הומינג או ישנה את 500/200/2000 בלי לעדכן את המודל — `npm test` ייכשל.

כל קובץ בדיקה שהטבלה מזכירה חייב להתקיים (`test/testing-doc.test.js`), כדי שהמפה לא תצביע על בדיקה שנמחקה או ששמה שונה.

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
