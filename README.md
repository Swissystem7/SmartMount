# SmartMount

> **[דמו חי](https://swissystem7.github.io/SmartMount/)** — סימולציה בדפדפן, בלי חומרה מחוברת.

SmartMount היא **הדגמת קונספט חומרה לפריט תיק עבודות**: קושחת ESP32 + דפים סטטיים בעברית (RTL). הרעיון — שני חיישני BH1750 מודדים יחס אור, ומנוע צעד מטה את המסך כשיש בוהק.

זה **לא** מוצר, לא תושבת שנבדקה על הקיר, ולא שירות. הקושחה ב־`firmware/smart_mount.ino` נכתבה ללוח אמיתי **אך טרם רצה מול חומרה**. אלגוריתם הבוהק **לא כויל מול מדידה**. אין ענן, אין חשבונות ואין סליקה.

## דפים

| עמוד | מה יש בו |
|---|---|
| [בית](https://swissystem7.github.io/SmartMount/) | נחיתה כנה |
| [מעבדה הנדסית](https://swissystem7.github.io/SmartMount/lab/) | חדר וירטואלי + קונסולת תקלות (חיישן / WiFi / גבול פאנל) על חוק `smart_mount.ino` |
| [מפרט בנייה](https://swissystem7.github.io/SmartMount/spec/) | BOM כנה, מחשבון מומנט מול NEMA17, חיווט SVG |
| [גאומטריית בוהק](https://swissystem7.github.io/SmartMount/geometry/) | חוק ההחזרה + למה יחס lux אינו בהירות לצופה |
| [חוזה API](https://swissystem7.github.io/SmartMount/protocol/) | ארבעה נתיבי HTTP + Serial 115200 — בדיוק מה שבקושחה |
| [לוח בקרה](https://swissystem7.github.io/SmartMount/dashboard/) | סימולציית UI (נתוני דוגמה) |

קוד: [Swissystem7/SmartMount](https://github.com/Swissystem7/SmartMount).

## מה באמת עובד

בדיקות יחידה רצות על המחשב בלי תלויות (`node --test`): חוק ההטיה, חוזה ה־HTTP, מומנט המנוע, והפער בין lux לבהירות. בקושחה ובדשבורד תוקנו באגים שהיו מסוכנים או מטעים:

- **קריאת חיישן כושלת** (BH1750 מחזיר ערך שלילי) מחזיקה זווית — לא מטה למקסימום.
- **מנוע:** `stepper.moveTo` ממיקום מוחלט; `currentAngle` לא מתעדכן לפני שהמנוע מגיע.
- **API:** סוג פאנל רק 0..2; `set-angle` / `set-mode` דוחים ארגומנט חסר/לא תקין.
- **WiFi:** timeout — המצב האוטומטי המקומי ממשיך גם בלי רשת.
- **דשבורד:** סף בוהק אחד לתנועה ולחיווי; הסליידר נצמד לגבול הפאנל; כיול דוגם את הקריאה שמוצגת ודוחה `max ≤ baseline`; הלוג מדווח יעד אמיתי; ציר Y בגרף ה־lux תואם את הסקאלה.
- **גבולות צפייה:** OLED 40° (הרחב ביותר), QLED 30°, LED/VA 20°.
- **כנות ב־UI:** «ניסיון Cloud» פותח היסטוריה מקומית; התחברות ותנאים מסומנים כהדגמה.

מה **לא** עובד: אין ESP32 מחובר לדמו, אין מדידת בוהק אמיתית, ואין הרכבה מכנית שנשאה מסך. הומינג, מפעיל נעילה עצמית וגאומטריית הכתם — פתוחים (ראו [מפרט](https://swissystem7.github.io/SmartMount/spec/)).

## מה המחקר מצא

פסק דין שוק: **PARK** — לא לבנות חומרה מסחרית סביב הסיפור הזה. הפירוט המלא: [RESEARCH.md](RESEARCH.md).

1. **אף תושבת ממונעת מסחרית לא עושה הטיה אוטומטית לפי חיישן אור.** [Vogel's MotionMount TVM 7675](https://manuals.vogels.com/en-us/tvm7675_pro.html) מסתובב בהדלקה ובמדריך כתוב במפורש שאין הטיה. הקרוב ביותר היה [Sanus LMT15](https://www.sanus.com/en_US/products/tv-mounts/lmt15/) (2009) והוא **הופסק**.
2. **השוק פתר בוהק בציפוי הפאנל, לא בזרוע.** [Samsung Glare Free OLED](https://www.samsung.com/us/tvs/oled-tv/highlights/) ודירוגי [RTINGS לחדר בהיר](https://www.rtings.com/tv/reviews/best/bright-room).
3. **מה היה פותח את זה מחדש:** ראיון עם 10 בעלי [MantelMount](https://www.mantelmount.com/products/mm815-motorized-drop-down-swivel-tv-mount) או MotionMount — «האם היית משלם עוד $150–$300 על הטיה אוטומטית לפי חיישן אור?» אם פחות משניים אומרים כן בלי היסוס — לגנוז סופית.

## סנכרון קבועים

מקור האמת: [`config/control-params.json`](config/control-params.json). אחרי עריכה:

```
node scripts/sync-control-params.js
```

הסקריפט ממלא בלוק מסומן ב־`firmware/smart_mount.ino` ומייצר את `src/lib/control-params.js`. הדשבורד והמעבדה טוענים את אותו קובץ JS (בלי bundler). הבדיקות נכשלות אם ה־JSON והקוד שנוצר מתפצלים.

## כנות

- הדמו מציג נתוני סימולציה. הבאנר בדשבורד אומר את זה במפורש.
- BOM של ₪35–50 שהופיע בהאקתון הוא ESP32 + חיישן + מנוע בסיסי — בלי פלדה, בלמים, UL/TÜV או אחריות לנפילת מסך. הטווח הכנה במפרט: אלקטרוניקה ≈₪110–220; תושבת שנשאת מסך הרבה יותר.
- אין מנוי, אין אחריות יצרן, אין סליקה. מסמך ההאקתון שדיבר על Cloud ₪9.90 הועבר ל־[docs/archive/](docs/archive/).
