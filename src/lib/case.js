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
      now: 'NaN / שלילי → מחזירים את הזווית הנוכחית. HOLD, לא slam.',
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
      now: 'סוג פאנל רק 0..2. set-angle ו-set-mode מחזירים 400 על חסר / לא מספר / auto≠0|1.',
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
      title: 'הדשבורד מפסיק לשקר לעצמו',
      severity: 'honesty',
      status: 'fixed-in-ui',
      was: 'סף בוהק כפול, סליידר חופשי, כיול מקבל max≤baseline, גרף lux עם ציר לא תואם.',
      now: 'סף אחד, היצמדות לגבול פאנל, דגימת הערך שמוצג, לוג יעד אמיתי. הבאנר אומר שזו סימולציה.',
      where: 'dashboard/index.html',
      provenBy: 'test/pages.test.js (באנר כנות)',
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
    cells: 165,
  });

  const TRADEOFFS = Object.freeze([
    Object.freeze({
      id: 'actuator',
      chose: 'מנוע צעד + יחס 1:5',
      because: 'זה מה שה-.ino כבר מדבר. לא כי הוכחנו שזה הכי טוב לטלוויזיה.',
      better: 'מפעיל קווי עם תולעת — נעילה עצמית, מהלך איטי, מתאים ל-VESA.',
    }),
    Object.freeze({
      id: 'sensing',
      chose: 'יחס שני BH1750',
      because: 'מבטל תאורה כללית בזול. נכשל כששני החיישנים רואים את אותה מנורה.',
      better: 'מצלמה / מד בהירות על קו הראייה. נכון פיזיקלית, מחוץ להיקף.',
    }),
    Object.freeze({
      id: 'zero',
      chose: 'שקר האפס ב-setup',
      because: 'אין מפסק ב-BOM של ההאקתון.',
      better: 'מפסק קצה + הומינג. חובה למוצר. לא קיים בקושחה.',
    }),
  ]);

  const SHOWN = Object.freeze([
    'סקירת קושחת ESP32 עם באגי בטיחות שננעלו בבדיקות מארח',
    'חוזה HTTP מפורש (ארבעה נתיבים, דחיית קלט רע)',
    'מכונת מצבים כפולה: מה שכתוב מול מה שחסר, כולל 165 תאים',
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
