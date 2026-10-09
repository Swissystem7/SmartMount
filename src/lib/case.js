// SmartMount — recruiter-facing case-study facts.
//
// These are review findings and design notes, not lab results. The firmware
// has not been flashed. If a sentence here starts sounding like a product
// claim, the tests should fail.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SM_CASE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const VERDICT = Object.freeze({
    id: 'portfolio-only',
    headline: 'אין נתיב הכנסה. זה פריט תיק עבודות.',
    hardware: 'untested',
    hardwareHe: 'הקושחה נכתבה ללוח אמיתי וטרם רצה מולו. אלגוריתם הבוהק לא כויל מול מדידה.',
  });

  const BUGS = Object.freeze([
    Object.freeze({
      id: 'sensor-fail-hold',
      title: 'קריאת BH1750 כושלת לא מטיחה את המסך',
      severity: 'safety',
      status: 'fixed-in-source',
      was: 'ערך שלילי מהספרייה זרם ליחס בוהק ענק והמסך הלך לגבול הפאנל.',
      now: 'NaN / שלילי → מחזירים את היעד המצווה (targetAngle). HOLD, לא slam ולא היפוך כיוון באמצע מהלך.',
      where: 'firmware/smart_mount.ino — calcOptimalAngle',
      provenBy: 'test/control.test.js, test/firmware-mirror.test.js',
    }),
    Object.freeze({
      id: 'absolute-moveTo',
      title: 'יעד מוחלט, לא צעד יחסי על זווית ששיקרה',
      severity: 'safety',
      status: 'fixed-in-source',
      was: 'currentAngle עודכן לפני שהמנוע הגיע; צעד יחסי צבר שגיאה.',
      now: 'stepper.moveTo ממיקום אפס שנעקב. currentAngle נקרא מ-currentPosition אחרי run().',
      where: 'firmware/smart_mount.ino — moveToAngle, loop',
      provenBy: 'test/firmware-mirror.test.js',
    }),
    Object.freeze({
      id: 'api-reject',
      title: 'ה־API דוחה ארגומנט חסר או לא תקין',
      severity: 'contract',
      status: 'fixed-in-source',
      was: 'type / deg / auto יכלו להיכנס ריקים או כזבל ולהפוך לברירת מחדל שקטה.',
      now: 'set-angle ו-set-mode מחזירים 400 על חסר / לא מספר / auto≠0|1. type נפרס ב-strtol עם צריכה מלאה: מחוץ ל-0..2, "foo", "1.9" או "2 " → 400. לפני כן toInt("foo")=0 בחר OLED (המכסה הרחב ביותר) בשקט.',
      where: 'firmware/smart_mount.ino — handleSetAngle, handleSetPanel, handleSetMode',
      provenBy: 'test/protocol.test.js',
    }),
    Object.freeze({
      id: 'wifi-timeout',
      title: 'ניתוק WiFi לא עוצר הטיה מקומית',
      severity: 'availability',
      status: 'fixed-in-source',
      was: 'setup היה יכול להיתקע על חיבור רשת.',
      now: 'timeout 10 שניות; ממשיכים במצב אוטומטי מקומי בלי IP.',
      where: 'firmware/smart_mount.ino — setup',
      provenBy: 'test/firmware-mirror.test.js',
    }),
    Object.freeze({
      id: 'dashboard-honesty',
      title: 'הדשבורד מפסיק להיות תיאטרון מוצר',
      severity: 'honesty',
      status: 'fixed-in-ui',
      was: 'Cloud ₪9.90, התחברות, «החשבון שלי», סף כפול, סליידר חופשי.',
      now: 'אין ענן ואין חשבון. סליידרי lux מריצים control.js. באנר: סימולציה, לא חומרה.',
      where: 'dashboard/index.html',
      provenBy: 'test/pages.test.js (אין Cloud / ₪9.90)',
    }),
    Object.freeze({
      id: 'build-break',
      title: 'תיקון הבטיחות שבר את ההידור, ואף אחד לא הידר',
      severity: 'build',
      status: 'fixed-in-source',
      was: 'קומיט התיקון bd675fd (13.8.2026) הוסיף min(..., (double)limit). ‏min(float, double) לא מתקמפל ב-ESP32, כך שהקושחה לא התקמפלה במשך כשישה שבועות (עד 27.9.2026). הבדיקות על המחשב עברו, כי הן לא מהדרות C++.',
      now: 'תו אחד: min(..., limit). הידור אמיתי ב-arduino-cli על core 3.3.12 ו-2.0.17. בדיקה סטטית נועלת את השגיאה, ו-sha256 של ה-.ino מונע טענת «מתקמפל» שהתיישנה.',
      where: 'firmware/smart_mount.ino:114 — calcOptimalAngle',
      provenBy: 'test/firmware-build.test.js, scripts/compile-firmware.sh',
    }),
  ]);

  const OPEN = Object.freeze([
    Object.freeze({
      id: 'homing',
      title: 'אין הומינג',
      why: 'setup() קורא setCurrentPosition(0) בלי מפסק קצה. האפס הוא שקר. אי אפשר לתקן את זה בתוכנה בלבד.',
    }),
    Object.freeze({
      id: 'fault',
      title: 'אין מצב FAULT',
      why: 'הקושחה היא bool autoMode ועוד «נשאר מרחק ל-AccelStepper». כשל חיישן מחזיק זווית — לא עוצר מנוע, לא מדליק תקלה.',
    }),
    Object.freeze({
      id: 'stall',
      title: 'אין סטול / WDT ייעודי',
      why: 'אין מדידת זרם, אין timeout תנועה, אין task watchdog. מסך תקוע נשאר תקוע.',
    }),
    Object.freeze({
      id: 'hold',
      title: 'אין נעילה עצמית',
      why: 'NEMA17 בלי תולעת / בלם משחרר את המסך בניתוק חשמל. POWER_LOSS במודל הבטוח הוא נפילה.',
    }),
    Object.freeze({
      id: 'uncalibrated',
      title: 'האלגוריתם לא כויל',
      why: 'סף 3 ורווח 5° ליחידת יחס הם מספרים עגולים. BH1750 מודד lux כללי, לא כתם השתקפות בעין.',
    }),
    Object.freeze({
      id: 'never-flashed',
      title: 'הקושחה לא הועלתה ללוח',
      why: 'כל התיקונים למעלה הם סקירת קוד + מראה על המחשב. אפס פולסי STEP נמדדו. HIL-10 אוסר טלוויזיה.',
    }),
  ]);

  const FSM = Object.freeze({
    firmwareStates: Object.freeze(['BOOT', 'RUN']),
    firmwareNote: 'מה שה-.ino באמת עושה: בוט, ואז לולאה. אין enum, אין UNHOMED, אין FAULT.',
    safeStates: Object.freeze([
      'BOOT', 'UNHOMED', 'HOMING', 'IDLE_AUTO', 'IDLE_MANUAL',
      'MOVING', 'FAULT_SENSOR', 'FAULT_HOME', 'FAULT_STALL', 'FAULT_LIMIT', 'DEAD',
    ]),
    safeNote: 'מכונה מוצעת על המחשב. לא נכתבה ל-.ino ולא רצה על ESP32. בלי מפסק אי אפשר להומינג.',
    cells: 176, // 11×16 safe only. Firmware is a separate 2×16 = 32.
  });

  const TRADEOFFS = Object.freeze([
    Object.freeze({
      id: 'actuator',
      question: 'איזה מפעיל?',
      chose: 'מנוע צעד + יחס 1:5',
      because: 'זה מה שה-.ino כבר מדבר. לא כי הוכחנו שזה הכי טוב לטלוויזיה.',
      better: 'מפעיל קווי עם תולעת — נעילה עצמית, מהלך איטי, מתאים ל-VESA.',
    }),
    Object.freeze({
      id: 'sensing',
      question: 'איך מודדים בוהק?',
      chose: 'יחס שני BH1750',
      because: 'מבטל תאורה כללית בזול. נכשל כששני החיישנים רואים את אותה מנורה.',
      better: 'מצלמה / מד בהירות על קו הראייה. נכון פיזיקלית, מחוץ להיקף.',
    }),
    Object.freeze({
      id: 'zero',
      question: 'איך יודעים איפה אפס?',
      chose: 'שקר האפס ב-setup',
      because: 'אין מפסק ב-BOM של ההאקתון.',
      better: 'מפסק קצה + הומינג. חובה למוצר. לא קיים בקושחה.',
    }),
  ]);

  // Measured 2026-09-27 with scripts/compile-firmware.sh. Compile only: no
  // board, no flash, no STEP pulse. inoSha256 is locked by
  // test/firmware-build.test.js — edit the .ino and the claim goes stale.
  const BUILD = Object.freeze({
    status: 'compiled-not-flashed',
    date: '2026-09-27',
    cli: 'arduino-cli 1.3.1',
    core: 'esp32:esp32@3.3.12',
    alsoCore: 'esp32:esp32@2.0.17',
    fqbn: 'esp32:esp32:esp32',
    libs: Object.freeze(['BH1750 1.3.0', 'AccelStepper 1.64', 'ArduinoJson 7.4.3']),
    flashBytes: 964756,
    ramBytes: 48888,
    inoSha256: '3ef9a110a6bf7b1e65869473f1677ebd43ef18ff3e633106473899a18e717775',
    before: "smart_mount.ino:114: error: no matching function for call to 'min(float, double)'",
    he: 'הקושחה מתקמפלת ל-ESP32 (נמדד 27.9.2026). לפני התיקון היא לא התקמפלה: min(float, double) בשורה 114. זה הידור בלבד. היא לא הועלתה ללוח.',
  });

  const SHOWN = Object.freeze([
    'הקושחה מתקמפלת ל-ESP32 — core 3.3.12 ו-2.0.17 (הידור בלבד, 27.9.2026)',
    'סקירת קושחת ESP32 עם באגי בטיחות שננעלו בבדיקות מארח',
    'חוזה HTTP מפורש (חמישה נתיבים, דחיית קלט רע)',
    'מכונת מצבים כפולה: מה שכתוב מול מה שחסר — 32 + 176 תאים',
    'תקציב תזמון והספק מדפי נתונים, לא ממד-זרם',
    'כנות: באנר, HIL never-run, PARK, אין נתיב הכנסה',
  ]);

  const NOT_SHOWN = Object.freeze([
    'העלאת קושחה ללוח, אוסצילוסקופ, או פולסי STEP',
    'כיול חיישן מול כתם השתקפות אמיתי',
    'מבחן עומס / UL / TÜV / נעילה עצמית',
    'מוצר, ערכה למכירה, או לקוח',
  ]);

  function byId(list, id) {
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function bug(id) { return byId(BUGS, id); }
  function openItem(id) { return byId(OPEN, id); }

  return {
    VERDICT: VERDICT,
    BUILD: BUILD,
    BUGS: BUGS,
    OPEN: OPEN,
    FSM: FSM,
    TRADEOFFS: TRADEOFFS,
    SHOWN: SHOWN,
    NOT_SHOWN: NOT_SHOWN,
    bug: bug,
    openItem: openItem,
  };
});
