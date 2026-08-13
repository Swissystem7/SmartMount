// SmartMount — hardware-in-the-loop plan as data.
//
// None of these cases have been run. There is no board on the bench.
// The objects exist so a reviewer can see what *would* be proven, what
// instrument is required, and what a pass on the host still cannot claim.
// status is hard-coded 'never-run' — flipping it requires a human and a
// bench log, not a green npm test.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SM_HIL = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const STATUS = 'never-run';

  const FIXTURES = Object.freeze([
    Object.freeze({ id: 'usb', label: 'ESP32 על USB-UART בלבד' }),
    Object.freeze({ id: 'sensors', label: 'ESP32 + שני BH1750' }),
    Object.freeze({ id: 'motor', label: 'מנוע על שולחן, בלי מסך' }),
    Object.freeze({ id: 'dummy', label: 'מסה מדומה על הזרוע — לא טלוויזיה' }),
  ]);

  const CASES = Object.freeze([
    Object.freeze({
      id: 'HIL-01',
      fixture: 'usb',
      title: 'שורות boot ב-Serial 115200',
      inject: 'הפעלה מ-USB. אין מנוע, אין חיישנים.',
      expect: 'שתי שורות boot ואז loop בלי exception. WiFi timeout אחרי 10 s לא תוקע.',
      instruments: Object.freeze(['USB-UART', 'שעון']),
      hazard: 'none',
      proves: 'הקובץ עולה על הסיליקון הזה',
      cannotProve: 'חיישן, מנוע, או זווית אמיתית',
    }),
    Object.freeze({
      id: 'HIL-02',
      fixture: 'usb',
      title: 'GET /status כל 2 שניות אחרי חיבור',
      inject: 'רשת מקומית ידועה. curl /status בלולאה.',
      expect: 'JSON עם angle/target/auto/panel/lux_*. lux שלילי אם החיישן חסר.',
      instruments: Object.freeze(['curl', 'Serial']),
      hazard: 'none',
      proves: 'חוזה HTTP חי על הלוח',
      cannotProve: 'שה-lux הוא אור אמיתי ולא רעש I²C',
    }),
    Object.freeze({
      id: 'HIL-03',
      fixture: 'sensors',
      title: 'ניתוק SDA באמצע דגימה',
      inject: 'לנתק SDA אחרי boot. SAMPLE הבא חייב HOLD.',
      expect: 'הזווית לא קופצת לגבול הפאנל. /status לא מדווח מטרה חדשה.',
      instruments: Object.freeze(['לוג Serial', 'מתג SDA']),
      hazard: 'none',
      proves: 'calcOptimalAngle מחזיק על קריאה שלילית — על הסיליקון',
      cannotProve: 'שכל כשלי הספרייה מחזירים שלילי (זה טענת BH1750)',
    }),
    Object.freeze({
      id: 'HIL-04',
      fixture: 'sensors',
      title: 'כתובת I²C שגויה / בלי VCC לחיישן',
      inject: 'ADDR של העליון לא 0x23, או ניתוק 3V3 של התחתון.',
      expect: 'כמו HIL-03: HOLD, לא slam.',
      instruments: Object.freeze(['מולטימטר', 'לוג']),
      hazard: 'none',
      proves: 'שני נתיבי הכשל שהמעבדה מדמה',
      cannotProve: 'מתיחת שעון / NACK תקוע ב-Wire',
    }),
    Object.freeze({
      id: 'HIL-05',
      fixture: 'motor',
      title: 'POST /set-angle?deg=99 מול מד זווית',
      inject: 'פאנל LED (גבול 20°). פקודה 99.',
      expect: 'הזרוע נעצרת ב-~20°, לא ב-99. /status.target ≈ 20.',
      instruments: Object.freeze(['מד זווית / אנקודר מאולתר', 'curl']),
      hazard: 'low',
      proves: 'constrain ב-moveToAngle רץ על החומרה',
      cannotProve: 'דיוק הממסר 1:5 (אין שרטוט)',
    }),
    Object.freeze({
      id: 'HIL-06',
      fixture: 'usb',
      title: 'ניתוק WiFi אחרי חיבור',
      inject: 'לכבות את ה-AP אחרי שה-HTTP עלה.',
      expect: 'loop ממשיך. HTTP נהיה בלתי-הגעה. האוטו המקומי לא קורס.',
      instruments: Object.freeze(['נתב', 'curl', 'Serial']),
      hazard: 'none',
      proves: 'timeout ב-setup + המשך מקומי — על הלוח',
      cannotProve: 'reconnect (אין כזה בקושחה)',
    }),
    Object.freeze({
      id: 'HIL-07',
      fixture: 'motor',
      title: 'אתחול כשהזרוע לא ב-0°',
      inject: 'להטות ידנית ל-~15° ואז reset. לשלוח set-angle 15.',
      expect: 'הקושחה מאמינה 0 ונוסעת +15 → הזרוע ב-~30°. זה הבאג.',
      instruments: Object.freeze(['מד זווית', 'Serial']),
      hazard: 'low',
      proves: 'setCurrentPosition(0) משקר — לא רק במודל',
      cannotProve: 'הומינג (אין מפסק בקוד)',
    }),
    Object.freeze({
      id: 'HIL-08',
      fixture: 'motor',
      title: 'פולסי STEP בזמן handleClient ארוך',
      inject: 'הצפה של GET /status בזמן מהלך 20°.',
      expect: 'או שהמהלך נגמר בזווית הנכונה, או ש-believed ≠ מכני (צעדים אבודים).',
      instruments: Object.freeze(['לוגיקה / אוסצילוסקופ על STEP', 'curl']),
      hazard: 'low',
      proves: 'האם slack של AccelStepper מחזיק מול HTTP אמיתי',
      cannotProve: 'WDT ייעודי (אין esp_task_wdt ב-.ino)',
    }),
    Object.freeze({
      id: 'HIL-09',
      fixture: 'motor',
      title: 'זרם idle מול moving מול WiFi',
      inject: 'מד זרם על 12 V ועל 5 V. שלושה מצבים: hold, מהלך, WiFi כבוי.',
      expect: 'סדר גודל: hold כמה וואט, לוגיקה <1 W, USB 5 V לא מחזיק את הסלילים.',
      instruments: Object.freeze(['מד זרם', 'שנט', 'ספק מעבדתי']),
      hazard: 'low',
      proves: 'שמספרי power.js הם סדר-גודל, לא המצאה',
      cannotProve: 'I²R מדויק של מק״ט לא ידוע',
    }),
    Object.freeze({
      id: 'HIL-10',
      fixture: 'dummy',
      title: 'ניתוק מתח עם מסה מדומה — לא טלוויזיה',
      inject: 'מסה מדומה שוות-מומנט על הזרוע — לא טלוויזיה. לנתק VMOT באמצע hold.',
      expect: 'בלי תולעת/בלם המסה יורדת. עם תולעת — נשארת.',
      instruments: Object.freeze(['מסה מדומה', 'מגן', 'מצלמה איטית']),
      hazard: 'high',
      proves: 'torque.js unpowered=drop — בפיזיקה, לא בטלוויזיה',
      cannotProve: 'UL/TÜV, או התנהגות מסך 18 ק״ג',
    }),
    Object.freeze({
      id: 'HIL-11',
      fixture: 'sensors',
      title: 'יחס lux מול כתם השתקפות אמיתי',
      inject: 'מנורה קטנה בזווית שפוגעת בעין ולא בחיישן העליון.',
      expect: 'החוק לא זז (blind-but-quiet) — כמו geometry/.',
      instruments: Object.freeze(['BH1750', 'עין / מד בהירות אם יש']),
      hazard: 'none',
      proves: 'שהאלגוריתם יכול לפספס בוהק אמיתי',
      cannotProve: 'כיול (האלגוריתם לא כויל, וזה לא כיול)',
    }),
    Object.freeze({
      id: 'HIL-12',
      fixture: 'motor',
      title: 'אין מפסק קצה — HOME לא קיים',
      inject: 'לחפש pinMode / digitalRead / פקודת home ב-Serial.',
      expect: 'אין. POST לא מוגדר. GPIO של מפסק לא מאותחל.',
      instruments: Object.freeze(['קריאת .ino', 'לוג Serial']),
      hazard: 'none',
      proves: 'המכונה הבטוחה לא בקושחה — גם על הלוח',
      cannotProve: 'שאפשר לעשות הומינג בלי חומרה נוספת (אי אפשר)',
    }),
  ]);

  function byId(id) {
    for (let i = 0; i < CASES.length; i++) {
      if (CASES[i].id === id) return CASES[i];
    }
    return null;
  }

  function byFixture(fixture) {
    return CASES.filter(function (c) { return c.fixture === fixture; });
  }

  function summary() {
    const hazards = { none: 0, low: 0, high: 0 };
    const byFix = {};
    CASES.forEach(function (c) {
      hazards[c.hazard] = (hazards[c.hazard] || 0) + 1;
      byFix[c.fixture] = (byFix[c.fixture] || 0) + 1;
    });
    return {
      cases: CASES.length,
      run: 0,
      neverRun: CASES.length,
      status: STATUS,
      hazards,
      byFixture: byFix,
    };
  }

  return {
    STATUS,
    FIXTURES,
    CASES,
    byId,
    byFixture,
    summary,
  };
});
