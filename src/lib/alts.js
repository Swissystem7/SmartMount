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
      id: 'glare',
      question: 'האם בכלל להזיז את המסך',
      chosen: 'tilt',
      options: Object.freeze([
        Object.freeze({
          id: 'tilt',
          label: 'הטיית המסך במנוע (SmartMount)',
          verdict: 'chosen-for-demo',
          why: 'מזיז את ההחזרה מהעין בלי לגעת בחלון ובלי יד על המסך. זה הפרויקט. המחיר הוא מנוע, זרם החזקה ושקר אפס — שלושת החובות שמתועדים בהחלטות שמתחת.',
        }),
        Object.freeze({
          id: 'smart-blind',
          label: 'תריס חכם על החלון',
          verdict: 'out-of-scope',
          why: 'תריס חכם חוסם את הבוהק במקור, בלי מנוע שתלוי על 15 ק״ג, ובפחות כסף. תריסים חכמים הם מוצר של חלון ולא של תושבת: בשכירות אין מה לקדוח, ובחלון אחד מול שני מסכים סגירה מחשיכה גם את מי שלא סובל. מחוץ להיקף כי זו חומרה אחרת — לא כי זה פתרון גרוע.',
        }),
        Object.freeze({
          id: 'monitor-arm',
          label: 'זרוע מוניטור ידנית (VESA, קפיץ גז)',
          verdict: 'rejected',
          why: 'זרוע מוניטור פותרת בדיוק את אותה גיאומטריה ב-0 W, בלי קושחה ובלי מכונת מצבים — זרועות מוניטור הן התשובה הנכונה לשולחן עבודה. נדחתה כאן כי היא דורשת יד בכל פעם שהשמש זזה, וכל ההנחה של הדמו היא שאף אחד לא קם.',
        }),
        Object.freeze({
          id: 'coating',
          label: 'ציפוי מאט / פילטר אנטי-רפלקטיבי',
          verdict: 'better-for-a-real-mount',
          why: 'זה מה ש-Samsung מוכרת, והיא צודקת: ציפוי מפזר את הכתם בלי חלקים נעים ובלי הספק. לא מתקינים אותו על פאנל קיים, והוא מוריד ניגודיות בחדר חשוך. אם יש בחירה של פאנל — לבחור ציפוי, לא מנוע.',
        }),
      ]),
    }),
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

  // The option fields a keyword search is allowed to look at. The parent
  // question is deliberately *not* searched: a hit has to be in the option's
  // own attributes, otherwise one keyword in a question would return four
  // options that never mention it.
  const SEARCHABLE = Object.freeze(['id', 'label', 'verdict', 'why']);

  function normalize(value) {
    return String(value).toLowerCase().replace(/\s+/g, ' ').trim();
  }

  // Accepts a single string or a list, drops blanks and duplicates.
  function toKeywords(input) {
    const raw = Array.isArray(input) ? input : [input];
    const out = [];
    for (let i = 0; i < raw.length; i++) {
      if (typeof raw[i] !== 'string') continue;
      const k = normalize(raw[i]);
      if (k && out.indexOf(k) === -1) out.push(k);
    }
    return out;
  }

  function haystackOf(option) {
    const parts = [];
    for (let i = 0; i < SEARCHABLE.length; i++) {
      parts.push(normalize(option[SEARCHABLE[i]]));
    }
    return parts.join(' | ');
  }

  // Keyword search over every option of every decision. OR semantics: an
  // option comes back if it matches at least one keyword, and it reports
  // which keywords hit so a UI can say *why* it is on the list. Results are
  // detached copies in DECISIONS order — callers cannot edit the source data.
  function searchSolutions(keywords) {
    const needles = toKeywords(keywords);
    const hits = [];
    if (!needles.length) return hits;
    for (let i = 0; i < DECISIONS.length; i++) {
      const d = DECISIONS[i];
      for (let j = 0; j < d.options.length; j++) {
        const o = d.options[j];
        const hay = haystackOf(o);
        const matched = needles.filter(function (k) {
          return hay.indexOf(k) !== -1;
        });
        if (!matched.length) continue;
        hits.push(Object.freeze({
          decision: d.id,
          question: d.question,
          id: o.id,
          label: o.label,
          verdict: o.verdict,
          why: o.why,
          matched: Object.freeze(matched),
        }));
      }
    }
    return hits;
  }

  return {
    DECISIONS,
    byId,
    chosenOf,
    rejectedOf,
    searchSolutions,
  };
});
