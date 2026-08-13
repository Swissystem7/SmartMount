// SmartMount — design alternatives that were considered and not taken.
//
// These are engineering judgements for a portfolio demo, not a lab bake-off.
// The firmware already assumes a stepper + two BH1750 + a ratio. This file
// records *why* the other common answers were rejected or deferred, so a
// reviewer does not have to guess that we never thought of a servo.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SM_ALTS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DECISIONS = Object.freeze([
    Object.freeze({
      id: 'actuator',
      question: 'מה מזיז את המסך',
      chosen: 'stepper',
      options: Object.freeze([
        Object.freeze({
          id: 'servo',
          label: 'סרבו RC / סרבו תעשייתי',
          verdict: 'rejected',
          why: 'סרבו זול לזווית קטנה, אבל מומנט ההחזקה נעלם בלי מתח — אותה נפילה כמו צעד. אין יחס 1:5 בקושחה, ואין אנקודר אמיתי בזול. סרבו תעשייתי עם בלם כבר יותר יקר מ-NEMA17 + תולעת.',
        }),
        Object.freeze({
          id: 'stepper',
          label: 'מנוע צעד + ממסר 1:5',
          verdict: 'chosen-for-demo',
          why: 'זה מה שה-.ino כבר מדבר: AccelStepper DRIVER, 200 צעדים, יחס 5. קל לשקף על המחשב. לא כי הוכחנו שזה הכי טוב לטלוויזיה — כי זה מה שנכתב להאקתון.',
        }),
        Object.freeze({
          id: 'linear',
          label: 'מפעיל קווי (linear actuator)',
          verdict: 'better-for-a-real-mount',
          why: 'תולעת מובנית, נעילה עצמית, מהלך איטי, מתאים ל-VESA. כבד, יקר, דורש בקרת קצה. נדחה לדמו כי אין CAD ואין תקציב הרכבה. אם מישהו בונה תושבת אמיתית — להתחיל מכאן, לא מ-NEMA17 חשוף.',
        }),
      ]),
    }),
    Object.freeze({
      id: 'sensing',
      question: 'יחס lux מול lux מוחלט',
      chosen: 'ratio',
      options: Object.freeze([
        Object.freeze({
          id: 'ratio',
          label: 'יחס עליון/תחתון',
          verdict: 'chosen-for-demo',
          why: 'מבטל תאורה כללית: חדר בהיר משני הצדדים לא מטה. סף 3 ורווח 5° ליחידת יחס — מספרים עגולים, לא כיול. נכשל כששני החיישנים רואים את אותה מנורה (כתם בעין, יחס שקט).',
        }),
        Object.freeze({
          id: 'absolute',
          label: 'סף lux מוחלט על החיישן העליון',
          verdict: 'rejected',
          why: 'חדר מואר בלי בוהק ישיר היה מטה כל אחר הצהריים. אין «כמה lux זה בוהק» בלי לדעת את הפאנל ואת הצופה. מוחלט זול יותר (חיישן אחד) ויותר שקרי.',
        }),
        Object.freeze({
          id: 'nits',
          label: 'בהירות מוחלטת לצופה (nits / מצלמה)',
          verdict: 'out-of-scope',
          why: 'זה מה שהעין רואה. דורש מצלמה מכוילת או מד בהירות על קו הראייה — לא BH1750 על המסגרת. נכון פיזיקלית, לא שייך לקושחת ההאקתון.',
        }),
      ]),
    }),
    Object.freeze({
      id: 'placement',
      question: 'איפה יושבים החיישנים',
      chosen: 'bezel',
      options: Object.freeze([
        Object.freeze({
          id: 'bezel',
          label: 'מסגרת: עליון החוצה, תחתון אל הפאנל',
          verdict: 'chosen-for-demo',
          why: 'תואם את שמות sensorTop / sensorBot בקושחה. העליון אמור לראות חלון, התחתון — את המסך. בלי CAD אי אפשר לדעת אם הכתם בכלל נופל על השבב.',
        }),
        Object.freeze({
          id: 'wall',
          label: 'חיישן על הקיר מול החלון',
          verdict: 'rejected',
          why: 'רואה את המקור, לא את ההחזרה. יטה כשיש שמש בחוץ גם כשהמסך מוסתר. מנתק את החוק מהגיאומטריה של הצופה.',
        }),
        Object.freeze({
          id: 'camera',
          label: 'מצלמה / IR על קו הראייה',
          verdict: 'out-of-scope',
          why: 'יכול לראות את הכתם שהעין רואה. פרטיות, הספק, כיול, ואין לזה מקום ב-BH1750 ×2. Samsung פתרה בוהק בציפוי, לא במצלמת הטיה.',
        }),
      ]),
    }),
    Object.freeze({
      id: 'hold',
      question: 'איך מחזיקים זווית בלי לשרוף סלילים',
      chosen: 'hold-current',
      options: Object.freeze([
        Object.freeze({
          id: 'hold-current',
          label: 'זרם החזקה תמידי (כמו הקושחה)',
          verdict: 'chosen-for-demo',
          why: 'AccelStepper לא מכבה סלילים. זה מחמם ~6.75 W ומפיל את המסך ברגע שהספק נעלם. נשאר בדמו כי זה מה שה-.ino עושה — לא כי זה בטוח.',
        }),
        Object.freeze({
          id: 'worm',
          label: 'תולעת / ממסר ננעל',
          verdict: 'required-for-a-product',
          why: 'נעילה עצמית בלי זרם. עקומת הספק הופכת ל-MCU. יעילות נמוכה יותר בתנועה. זה מה שמסחרי (MantelMount ודומיו) כבר בחרו.',
        }),
        Object.freeze({
          id: 'brake',
          label: 'בלם אלקטרומגנטי על הציר',
          verdict: 'deferred',
          why: 'מחזיק בלי זרם מנוע, דורש זרם בלם הפוך (בדרך כלל fail-safe = דלוק כדי לשחרר). מסובך ל-BOM של דמו, לגיטימי למוצר.',
        }),
      ]),
    }),
    Object.freeze({
      id: 'zero',
      question: 'איך יודעים איפה האפס',
      chosen: 'lie',
      options: Object.freeze([
        Object.freeze({
          id: 'lie',
          label: 'setCurrentPosition(0) ב-setup',
          verdict: 'chosen-for-demo',
          why: 'שקר מפורש. הזרוע יכולה להיות ב-12° והקושחה תיסע כאילו מאפס. נשאר כי אין GPIO למפסק ב-.ino.',
        }),
        Object.freeze({
          id: 'endstop',
          label: 'מפסק קצה + רצף HOMING',
          verdict: 'required-for-a-product',
          why: 'המכונה הבטוחה ב-fsm.js. דורש חומרה שאין, ו-timeout. בלי זה UNHOMED הוא המצב היחיד הכנה אחרי אתחול.',
        }),
        Object.freeze({
          id: 'encoder',
          label: 'אנקודר מוחלט על הציר',
          verdict: 'deferred',
          why: 'אפס אמיתי בלי חיפוש. יקר, דורש SPI/I²C נוסף, לא בקושחה. עדיף על stall-detect לטלוויזיה.',
        }),
        Object.freeze({
          id: 'stall',
          label: 'זיהוי סטול (TMC / חיישן זרם)',
          verdict: 'rejected-as-home',
          why: 'שימושי כ-FAULT באמצע מהלך. גרוע כאפס: תקיעה על מדף או כבל נראית כמו בית. המכונה הבטוחה מפרידה STALL מ-HOME.',
        }),
      ]),
    }),
  ]);

  function byId(id) {
    for (let i = 0; i < DECISIONS.length; i++) {
      if (DECISIONS[i].id === id) return DECISIONS[i];
    }
    return null;
  }

  function chosenOf(id) {
    const d = byId(id);
    if (!d) return null;
    for (let i = 0; i < d.options.length; i++) {
      if (d.options[i].id === d.chosen) return d.options[i];
    }
    return null;
  }

  function rejectedOf(id) {
    const d = byId(id);
    if (!d) return [];
    return d.options.filter(function (o) {
      return o.verdict === 'rejected' || o.verdict === 'rejected-as-home';
    });
  }

  return {
    DECISIONS,
    byId,
    chosenOf,
    rejectedOf,
  };
});
