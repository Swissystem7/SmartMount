# SmartMount — מחקר שוק + פסק דין

**תאריך בדיקה:** 13 באוגוסט 2026  
**המוצר הנבדק:** [SmartMount](https://swissystem7.github.io/SmartMount) — תושבת ממונעת עם שני חיישני BH1750 ו־ESP32, שמטה את המסך כשיחס האור מצביע על בוהק.

**מצב בפועל (נצפה 13.8.2026):**
- [דמו ווב](https://swissystem7.github.io/SmartMount): אין חומרה מחוברת; לוח הבקרה מציג נתוני דוגמה.
- [קושחה](https://github.com/Swissystem7/SmartMount/blob/master/firmware/smart_mount.ino): נכתבה לחומרה אמיתית. הדמו עצמו כותב שהקושחה **טרם נבדקה מול חומרה** ואלגוריתם זיהוי הבוהק **לא כויל מול מדידה**.
- [GitHub Swissystem7/SmartMount](https://github.com/Swissystem7/SmartMount): 0 כוכבים, 0 forks, נוצר 12.7.2026, עודכן 11.8.2026.
- [HACKATHON.md (ארכיון)](docs/archive/HACKATHON.md): BOM מוערך **₪35–50** ל־ESP32 + BH1750 + מנוע בסיסי (בלי פלדה / בטיחות / הרכבה); מנוי Cloud ₪9.90; מודל חלופי — רישוי אלגוריתם ליצרני תושבות.

**שיטת איסוף:** חיפוש רשת + קריאת דפים רשמיים + GitHub (`gh`) + X + V2EX API + Jina Reader.  
**לא זמין בזמן הבדיקה:** Exa (לא מוגדר), Reddit-CLI / Twitter-CLI (לא מותקנים), Xiaohongshu (כבוי), bili-cli (לא מותקן). Reddit נחסם בקריאה ישירה (מסך התחברות). נפח חיפוש חודשי מדויק (Ahrefs / Semrush / Keywords Everywhere / Google Trends מספרי) — **לא נמצא מקור**.

---

## 1) מתחרים

**אף תושבת ממונעת מסחרית שנבדקה לא עושה הטיה אוטומטית לפי חיישן אור.**  
חיפושים: `"motorized TV mount" "light sensor"`, `"auto tilt" glare`, `"photocell" TV mount`, `"motorised TV mount" photocell`. אף מוצר חי עם BH1750 / photocell / ALS שמטה לפי בוהק לא עלה. הקרוב ביותר הוא **Sanus LMT15** מ־2009 — הטיה ממונעת לזווית קבועה כשהטלוויזיה נדלקת (Toslink), לא לפי בוהק — והוא **הופסק**.

| מוצר | מה הוא באמת עושה | האם הטיה לפי אור? | מחיר שנצפה (13.8.2026) | קישור |
|---|---|---|---|---|
| **Vogel's MotionMount TVM 7675** | מסתובב אוטומטית כשמדליקים את הטלוויזיה (HDMI כלול). שליטה באפליקציה / Siri Shortcuts / שלט. 7 פריסטים. עד 120° סיבוב, יציאה עד 72 ס״מ, 40–77″, 35 ק״ג. TÜV, ESPS נגד פגיעה בקיר. | **לא.** האוטומציה היא הדלקה/כיבוי + פריסט. במדריך הרשמי: **"There is no tilt in this product."** | **£899** ב־Richer Sounds בריטניה ואירלנד; **905.69–906 €** ב־AV-Connection (כולל מע״מ דני 25%). באתר Vogel's עצמו **אין מחיר**. | [דף מוצר](https://www.vogels.com/en/c/tvm-7675-motorized-tv-wall-mount-black) · [מדריך / FAQ (אין הטיה)](https://manuals.vogels.com/en-us/tvm7675_pro.html) · [Richer Sounds UK £899](https://www.richersounds.com/vogels-tvm-7675-black/) · [Richer Sounds IE £899](https://www.richersounds.ie/p-210089-vogels-tvm-7675-black-2yr-40-77-inch-motorised-cantilever-tv-bracket.aspx) · [AV-Connection ≈906 €](https://www.av-connection.com/?PGr=16549) |
| **Sanus LMT15** | הטיה ממונעת עד 13°, שלט IR, מצב אוטו: הטיה לזווית קבועה כשהמסך נדלק דרך Toslink; בחזרה לקיר בכיבוי. חיישני בטיחות לעצירת תנועה. 40–60″, עד 150 ליברות. | **לא.** אין חיישן אור. בהודעת ההשקה (28.4.2009) סגן נשיא המכירות אמר שההטיה מתאימה גם ל־"reduce glare on the TV screen" — זו טענת שיווק על הטיה קבועה בהדלקה, לא על חיישן. | **$319.99** MSRP ב־28.4.2009. היום: **"This product has been discontinued"**. דירוג 3.3/5 מ־3 ביקורות באתר Sanus; אחת מ־2021: "gears stripped". | [דף מוצר (הופסק)](https://www.sanus.com/en_US/products/tv-mounts/lmt15/) · [השקה 28.4.2009](https://www.sanus.com/en_US/media/article/sanus-now-shipping-motorized-mount-with-remote-tilting-capabilities/) · [rAVe, 17.5.2009](https://ravepubs.com/sanus-releases-motorized-mount-includes-remote-control-tilting/) |
| **MantelMount MM815** | הורדה ממונעת מעל האח + סיבוב, שלט RF, 2 פריסטים, 26″ ירידה, 30° סיבוב לכל צד, 45–90″, 20–115 ליברות. | **לא.** חיישן החום הוא אזהרה ויזואלית לאח (**הופך לאדום מעל 110°F**), לא בוהק. ההטיה מתוארת כ־**"Fine tune the tilt"** — כוונון, לא מנוע אוטומטי לפי אור. תשובת תמיכה באתר: אין חיישן שמושך את המסך אוטומטית בחום. | **$649.95** במבצע קיץ (מחירון ~~$999.95~~), נצפה 13.8.2026 באתר הרשמי. דירוג 4.93/5 מ־496 ביקורות. | [MM815](https://www.mantelmount.com/products/mm815-motorized-drop-down-swivel-tv-mount) |
| **MantelMount ידני (הקונה האמיתי של הקטגוריה)** | הורדה ידנית לגובה עיניים מעל אח. | הטיה ידנית קטנה, לא אוטו. | MM340 **$189.95** (מ־$299.95); MM540 **$249.95** (מ־$469.95); MM700 **$349.95** (מ־$624.95) — מבצע קיץ באתר, 13.8.2026. | [MM340](https://www.mantelmount.com/products/mm340-standard-mount) · [MM540](https://www.mantelmount.com/products/mm540-enhanced-mount) · [MM700](https://www.mantelmount.com/products/mm700-premier-mount) |
| **Future Automation QA2** (B2B / אינטגרטור) | זרוע ממונעת עד 75° לכל צד, RS232 / IR / contact closure, 42–60″, 45 ק״ג. "Rolls-Royce of TV Mounts" באתר היצרן. 3 פריסטים. | **לא נמצא מקור** לחיישן אור. השליטה היא אינטגרטור / שלט / RS232. | **£1,544.40** (מ־£1,716) אצל [AV Installs UK](https://www.avinstalls.co.uk/product/future-automation-qa2-electric-swivel-mount/); **$1,164** אצל [Sound Approach](https://soundapproach.com/future-automation-qa2-two-way-articulating-tv-wall-mount.html). באתר היצרן אין מחיר לצרכן. | [QA2 רשמי](https://www.futureautomation.co.uk/Product/Details/QA2) |
| **Mount-It MI-386** | הורדה ממונעת מעל אח + שלט, 40–70″, 77 ליברות. | **לא.** באתר במפורש: **Tilt −3° ידני**, "reduce glare from above". הסיבוב (±25°) גם ידני. | **$349.99** באתר הרשמי, 13.8.2026. | [MI-386](https://www.mount-it.com/products/motorized-fireplace-tv-wall-mount-fits-40-70-inch-tv-screen-mi-386) |

**תושבות tilt ידניות זולות** (Sanus / Mount-It / RV) מפרסמות במפורש "tilt to reduce glare" — בלי מנוע ובלי חיישן. זה התחליף האמיתי בטווח עשרות עד מאות דולרים. [Sanus על קטגוריית tilt](https://www.sanus.com/en_us/products/tv-mounts/): "Tilting mounts tilt up and down to reduce glare or reflections from lights and windows."

**מחיר ישראלי ל־MotionMount / MM815:** לא נמצא מקור לחנות מקומית עם מחיר ₪ ב־13.8.2026.

### החלופה הזולה: יריעות / ציפויים נגד בוהק

| פתרון | מחיר שנצפה (13.8.2026) | מה הוא עושה | קישור |
|---|---|---|---|
| **GlareStopper** (יריעה בהזמנה) | **≈$20** למסך מחשב, **≈$100** ל־70″ — לפי FAQ שלהם (טווח, לא מחירון חי) | טוענים ≈90% בוהק וכמעט 100% השתקפות; 97% העברת אור. עדויות לקוחות באתר: "יכולתי לפתוח את החלונות שוב". | [אתר](https://www.glarestopper.com/) · [FAQ מחירים](https://www.glarestopper.com/faq.php) |
| **יריעות מט באמזון (גודל טלוויזיה)** | XRRX 43″ **₪198.76**; סרט 40–50″ מ־**₪177.68**; TYRHMY 55″ **₪228.55**; BU 50″ **₪258.70**. ZUONYUT 50″ (B0CRLDD6TG): **אין הצעה פעילה** בדף ב־13.8.2026. | משטח מט מפזר השתקפות. היצרנים עצמם כותבים שצריך להעלות בהירות אחרי התקנה. | [ZUONYUT 50″](https://www.amazon.com/ZUONYUT-TV-50-Inch-glare/dp/B0CRLDD6TG) · [חיפוש Amazon](https://www.amazon.com/anti-glare-film-tv/s?k=anti+glare+film+for+tv) |
| **K-PRO ישראל 55″** (מגן פולימרי קשיח) | **₪659** + משלוח **₪120** | בעיקר שריטות / אור כחול / ילדים / שברים. לא יריעת מט זולה; שקיפות מלאה (לא פיזור מט). | [k-protv.co.il/product/55inc-screen](https://k-protv.co.il/product/55inc-screen/) · גם ב־[Payngo ₪589](https://www.payngo.co.il/tv-and-entertainment/tv-accessories/tv-screen-protectors.html) |
| **ציפוי יצרן: Samsung Glare Free OLED** | כלול במחיר הטלוויזיה (אלפי ₪ / $). ב־2026: S95H ו־S90H עם Glare Free; S85H **בלי**. | הפתרון שהשוק בחר ב־2024–2026. Samsung: "whether next to sun-drenched windows or in a room with lots of overhead light". | [Samsung OLED / Glare Free](https://www.samsung.com/us/tvs/oled-tv/highlights/) · [RTINGS Best TVs for bright rooms 2026](https://www.rtings.com/tv/reviews/best/bright-room) |
| **NuShield (B2B / כיתות / חדרי ישיבות)** | **לא נמצא מקור** למחיר 55″ בזמן הבדיקה | יריעה לא־דבקה עד 65″; שיווק מפורש לחדרי ישיבות וכיתות. | [NuShield](https://nushield.com/) |
| **שילוט דיגיטלי חיצוני** | יחידות high-nit (2,000–5,000) עם ציפוי מובנה / מעטפת | לא תושבת ממונעת. | [Armagard sunlight-readable](https://www.armagard.com/news/sunlight-readable-digital-signage/) |

**טענת "50 ₪ פותרים את זה":** לא נמצא מקור ליריעת אנטי-גלייר אופטית אמינה בגודל טלוויזיה ב־₪50. סרטי מט אמיתיים ל־43–55″ באמזון (משלוח לישראל) נצפו ב־**₪178–₪259** לפני משלוח, או **₪589–₪659** למגן אקרילי/פולימרי ישראלי. זה עדיין זול בסדר גודל מתושבת ממונעת (£899 / $650).

**CNET (עודכן 31.5.2023, פורסם לראשונה 2011)** ממליץ במפורש **לא** להדביק יריעות: פגיעה באיכות תמונה, סיכון בהסרה. הפתרונות שלו: כיבוי אורות / bias light, **הטיה ידנית או הזזת מנורה**, וילונות / סככות. [הכתבה](https://www.cnet.com/tech/home-entertainment/5-easy-ways-to-get-rid-of-annoying-tv-glare/).

---

## 2) הקונה

מי **משלם היום** על תושבת ממונעת — ועל מה. לא מי *סובל* מבוהק.

| קונה | מה הוא קונה בפועל | כמה (מקורות למעלה) | האם בוהק הוא הסיבה לתשלום? |
|---|---|---|---|
| **בעל בית עם טלוויזיה מעל האח** | גובה עיניים בלחיצה / משיכה. MantelMount מוכרת *גובה וצוואר*, לא בוהק. ביקורות MM815 מדברות על שקט, שלט, אח, חלונות קדמיים שרוצים להשאיר פתוחים ל**נוף** (לא לבוהק). | $190–$650 (ידני עד ממונע, מבצע 13.8.2026) | משני. חיישן החום הוא בטיחות אח. |
| **בעל OLED יוקרתי / עיצוב** | "אל תיגע במסך" + סיבוב אוטומטי כשמדליקים. זה Vogel's MotionMount. Vogel's עצמה מציינת מלונות / חדרי ישיבות כשימוש לסידרת SIGNATURE הממונעת. | £899 / ≈906 € | לא. הנוחות, העיצוב, 7 פריסטים. |
| **אינטגרטור AV / מלון / חדר ישיבות** | Future Automation / Chief: הסתרה, RS232, תנועה מתוכנתת, 3 פריסטים. | £1,500+ או Chief קבוע זול בהרבה | **לא נמצא מקור** שחדרי ישיבות קונים הטיה לפי אור. התאורה שם נשלטת (דימרים, וילונות, חיישני נוכחות). לבוהק על מסך ישיבות יש יריעות NuShield. |
| **בעל קרוואן / RV** | תושבת נעילה + tilt ידני נגד רטט ושמש. Lippert Hook-On **$28.95**. מעליות ממונעות של Lippert הן *הסתרה* מתוך משטח, לא אנטי-גלייר: etrailer **$835.09** (מחירון $884.95, דף מ־2020 — לא אומת מחדש כמחיר חי ב־13.8.2026 מעבר לציטוט בדף). Mount-It מפרסמת tilt ידני נגד בוהק לקרוואנים. | תושבת ידנית נפוצה **עשרות דולרים**; מעלית ממונעת — מאות | בוהק קיים בחוץ. הפתרון בשוק: מסך חוץ + יריעה / tilt ידני / אוריינטציה, לא חיישן lux על זרוע. |
| **חובב קולנוע ביתי** | חדר חשוך או וילונות. אם כבר משלם על תושבת — לסיבוב / full-motion ידני. | תושבת ידנית עשרות–מאות $ | בוהק הוא באג של *סלון מואר*, לא של חדר ייעודי. |
| **שילוט דיגיטלי / תפריטים / כנסיות** | מסכי high-nit + ציפוי / מעטפת (Armagard ודומיהם), או יריעת NuShield. | מחיר יחידה מסחרית — לא נאסף כאן כמחירון אחיד | **לא נמצא מקור** לתושבת ממונעת עם חיישן אור בקטגוריה הזו. |

**מה שאין:** קונה שמוכן לשלם מחיר של MotionMount / MM815 **רק** כדי שהמסך יטה את עצמו מול חלון. Sanus ניסתה גרסה זולה יותר ($320, 2009, הטיה ממונעת "כדי להפחית בוהק") והורידה אותה מהמדף. 17 שנה אחר כך אף יצרן גדול לא החזיר חיישן אור.

**B2B שילוט:** יריעות מסחריות ומסכי חוץ עם ציפוי מובנה. לא זרוע עם BH1750.

**הערת שוק סינדיקטי:** דוחות כמו MarketIntelo / GrowthMarketReports מצטטים שוק "motorized TV wall mount" של ≈$2.1–2.3B ב־2024–2025. אלה חנויות דוחות בלי מתודולוגיה גלויה שנבדקה כאן — **לא משמשים כראיה** לגודל שוק אנטי-גלייר.

---

## 3) ראיות — האם בוהק מניע רכישה?

**הכאב אמיתי. הוא לא מניע רכישת תושבת ממונעת.**

מה שנמצא:

- **CNET** מחזיקה מדריך בוהק מ־2011 שעודכן ב־31.5.2023. ציטוט: ההשתקפויות "can make it pretty much impossible to see the picture". הפתרונות: אורות, bias light, **הטיה ידנית / הזזת מנורה**, וילונות / סככות ממונעות. לא מנוע על התושבת. [קישור](https://www.cnet.com/tech/home-entertainment/5-easy-ways-to-get-rid-of-annoying-tv-glare/).
- **Sanus בלוג, 26.4.2016:** בוהק נפתר ב־tilt או swivel **ידני**. [הפוסט](https://blog.sanus.com/problem-the-glare-on-my-flat-panel-tv-is-awful).
- **AVSForum:** כותרות ארוכות-שנים על מסכים בלתי-ניתנים-לצפייה ביום — [Room too bright for OLED? (2022)](https://www.avsforum.com/threads/room-too-bright-for-oled.3249491/), [GlareStopper — what a great product](https://www.avsforum.com/threads/glarestopper-what-a-great-product.2059514/). גוף השרשורים נחסם לקריאה בלי התחברות ב־13.8.2026; הכותרות והנתיבים עצמם מאשרים שהכאב חי בפורום כבר שנים. הפתרון בשרשור GlareStopper הוא **יריעה**, לא תושבת.
- **Reddit (כותרות מחיפוש רשת; גוף הפוסט לא נקרא — מסך התחברות):** [r/OLED TV Glare recommendations](https://www.reddit.com/r/OLED/comments/152d1xn/tv_glare_recommendations/), [r/OLED_Gaming — LG C1 unusable during the day](https://www.reddit.com/r/OLED_Gaming/comments/ujjx9r/just_got_an_lg_c1_and_its_unusable_during_the_day/). התשובות בכותרות/קטעים: יריעה, וילונות, טלוויזיה מט, כיבוי Energy Saving. לא תושבת חכמה.
- **AVForums, מאי 2023:** "Why are OLED TVs so reflective, they are like mirrors". [קישור](https://www.avforums.com/threads/why-are-oled-tvs-so-reflective-they-are-like-mirrors-spoiling-the-black-level-experience.2458683/).
- **RTINGS** בונה מבחני השתקפות שלמים ומדרגת טלוויזיות לחדר בהיר — כלומר השוק פתר את זה **בפאנל**, לא בתושבת. [Direct reflections](https://www.rtings.com/tv/tests/picture-quality/direct-reflections) · [Best TVs for bright rooms 2026](https://www.rtings.com/tv/reviews/best/bright-room).
- **X (נצפה 13.8.2026):** השיחה החיה היא על **טלוויזיה חדשה עם ציפוי**, לא על זרוע.
  - @geekyranjit, 6–7.5.2024: Samsung S95D Glare Free — "able to watch TV in the morning without pulling the curtains"; הפוסט הראשי **84,476 צפיות**. [פוסט](https://x.com/geekyranjit/status/1787464052794654834).
  - אוגוסט 2026: דילים על Samsung S95F / S90H / QN90F כ־"TV built for bright rooms" / "Glare Free" (@ItsTheInventory 11.8.2026, @BGR 27.7.2026 על הפחתת בוהק ב־OLED ע״י תאורה — לא תושבת).
- **V2EX:** ב־hot בזמן הבדיקה אין דיון רלוונטי לבוהק / תושבת.
- **Bilibili:** bili-cli לא מותקן; לא נסרק.
- **Xiaohongshu:** backend כבוי.

**נפח חיפוש מספרי:** לא נמצא מקור (אין Keywords Everywhere / Semrush / Ahrefs / נתון Google Trends מספרי בגישה).  
**פרוקסי איכותי במקום נפח:** יצרניות דגל (Samsung S95H/S90H 2026, Hisense מט) שמו ציפוי מט במוצרי 2024–2026 ושמו אותו במרכז השיווק. זה אות שוק חזק שהכאב קיים — ושהפתרון שמשלמים עליו הוא **המסך עצמו**.

---

## 4) הנחת המוות

**ההנחה:** הטיה אוטומטית לפי שני חיישני lux מסירה בוהק טוב יותר ממה שהקונה כבר יכול לקנות בזול (יריעה / ציפוי יצרן / וילון / tilt ידני), ולכן הוא ישלם מחיר של תושבת ממונעת.

### מה הפיזיקה אומרת (עם מקורות)

הטיה **יכולה** להזיז השתקפות ספקולרית מחוץ לקו הראייה — חוק ההחזרה. CNET, Sanus ו־Mount-It כולם אומרים את זה על **הטיה ידנית של כמה מעלות**. זה נכון לגבי מנורה מעל או חלון מאחורי הצופה. Mount-It כותבת במפורש על MI-386: tilt −3° "reduce glare from above".

זה **לא** נכון כפתרון כללי:

1. **חלון גדול ממול המסך** — הטיה של 10–20° רק מזיזה את הכתם. RTINGS בונה מבחן השתקפות שלם כי אי אפשר "להזיז טלוויזיה קבועה" כמו לפטופ; צריך טיפול בהשתקפות של הפאנל.
2. **LCD/QLED נראים גרוע מחוץ לציר.** CNET מזהיר במפורש: אם מטים/מסובבים, איכות התמונה נפגעת. [CNET](https://www.cnet.com/tech/home-entertainment/5-easy-ways-to-get-rid-of-annoying-tv-glare/).
3. **SmartMount עצמה מגבילה OLED ל־40°, QLED ל־30°, LED ל־20°** (OLED רחב־ציר; VA/LED נשטפים מחוץ לציר). בקושחה, `calcOptimalAngle` מחזיר רק זווית **≥ 0** (יחס top/bottom > 3 → הטיה עד גבול הפאנל). בוהק מלמטה / מזווית שלא משנה את יחס שני החיישנים **לא מטופל**. מקור: [firmware/smart_mount.ino](https://github.com/Swissystem7/SmartMount/blob/master/firmware/smart_mount.ino).
4. **BH1750 מודד lux כללי, לא מיקום כתם ההשתקפות.** יחס שני חיישנים הוא קירוב גס. אין מצלמה / מפת השתקפות. האלגוריתם **לא כויל מול מדידה** — הדמו עצמו אומר את זה.
5. **השוק כבר בחר מנגנון אחר:** ציפוי מט מפזר (Samsung Glare Free עם אישור UL UGR, Hisense) או יריעה. זה עובד בכל גאומטריה, בלי להזיז מסך של 20–40 ק״ג ובלי לפגוע בזווית צפייה.
6. **Sanus כבר בדקה את הקטגוריה ב־2009** ($319.99, הטיה ממונעת "כדי להפחית בוהק") והוציאה אותה. 17 שנה אחר כך אף אחד לא החזיר חיישן אור. ביקורת מתקין מ־2010 על LMT15: אין כוונון גבול לזווית האוטומטית, Toslink לא גמיש, אין פילוס אחרי התקנה — כלומר גם בלי חיישן אור המוצר היה חלש.
7. **יריעה זולה יותר ופועלת בכל זווית.** GlareStopper טוענת 90% בוהק / כמעט 100% השתקפות ב־≈$100 ל־70″. גם אם מנכים את טענות היצרן, המחיר הוא שבריר מ־£899.

**עלות הייצור ב־HACKATHON (₪35–50 ליחידה)** אינה עלות מוצר. זה BOM של ESP32+חיישן+מנוע צעד, בלי פלדה שנושאת 20–40 ק״ג, בלי מנוע עם מומנט ובלמים, בלי UL/TÜV, בלי התקנה, בלי אחריות לנפילת מסך. Vogel's ו־MantelMount עולות $650–£900 כי הבטיחות והמכניקה הן המוצר.

**יריעה ב־₪50:** לא נמצאה יריעת 55″ אופטית אמינה במחיר הזה. יריעת מט אמיתית נצפתה ב־**₪178–₪259** ביבוא אמזון (לפני משלוח) או **₪589–₪659** למגן ישראלי — עדיין שבריר ממחיר תושבת ממונעת, ובלי סיכון נפילה של מסך. CNET בכל זאת ממליץ לא להדביק.

---

## 5) פסק דין

# PARK

**לא KEEP.** אין קונה שמשלם היום על "הטיה אוטומטית לפי אור". המתחרים הממונעים מוכרים גובה (אח) או נוחות (סיבוב בהדלקה). Sanus כבר מתה על גרסה קרובה ב־2009. הציפוי של היצרן אכל את הבעיה ב־2024–2026.

**לא PIVOT לרישוי אלגוריתם ליצרני תושבות.** אין עדות ש־Vogel's / MantelMount / Future Automation רוצים חיישן אור. יש להם פריסטים, שלט, HDMI-on ו־RS232. הרישוי הוא רעיון האקתון בלי ביקוש נצפה. Vogel's אפילו **הסירה הטיה** מ־MotionMount הדגל.

**הקונה שיש לו שם וארנק — והוא לא שלך:**  
בעל בית אמריקאי/אירופי עם טלוויזיה **מעל האח**, שמשלם **$190–$650** ל־MantelMount (או £899 ל־Vogel's אם הוא רוצה סיבוב בהדלקה) כדי להוריד / לסובב את המסך לגובה עיניים. הוא לא מחפש BH1750.

**הקונה שסובל מבוהק — והוא כבר פתר:**  
מי שיושב מול חלון קונה Samsung Glare Free / Hisense מט, וילון, או יריעת ₪180–₪370. לא זרוע עם מנוע צעד.

### הצעד הבא (יחיד)

**לא לבנות חומרה.** להשאיר את הדמו כפריט תיק עבודות.

אם רוצים לסגור את ההנחה סופית לפני גניזה: ראיון עם **10 בעלי MantelMount או MotionMount** — שאלה אחת: "האם היית משלם עוד $150–$300 על הטיה אוטומטית לפי חיישן אור?" אם פחות מ־2 אומרים כן בלי היסוס — לגנוז סופית.

אם בכל זאת רוצים מוצר באותו ברזל: זה כבר לא SmartMount. זה שיבוט זול יותר של MM815 לשוק שMantelMount לא מכסה (למשל ישראל / אירופה), בלי סיפור הבוהק. זה שוק צפוף עם מותג חזק, אחריות לכל החיים, ו־UL/TÜV — לא נקודת התחלה סבירה מקושחה לא מכוילת.

---

### מגבלות הבדיקה

- אין מספרי נפח חיפוש חודשי ממקור SEO בתשלום, ואין נתון Google Trends מספרי שנמשך בהצלחה.
- Reddit לא נקרא דרך API מחובר; רק כותרות/קטעים מחיפוש רשת. שרשורי AVSForum נחסמו לקריאה מלאה בלי התחברות.
- מחיר Vogel's באתר היצרן עצמו לא הוצג; המחירים הם מקמעונאים ב־13.8.2026 (£899 / ≈906 €).
- מחיר ישראלי ל־MotionMount / MM815: **לא נמצא מקור**.
- מחיר AliExpress ספציפי ליריעת 55″: **לא נמצא מקור** בזמן הבדיקה (לא נמשך דף חי עם מחיר).
- ZUONYUT 50″ באמזון: אין הצעה פעילה ב־13.8.2026; לא צוטט מחיר ישן שלא נצפה היום.
- Bilibili ו־Xiaohongshu לא נסרקו (כלי לא זמין).
- החומרה של SmartMount לא נמדדה מול בוהק אמיתי — גם לפי הדיסקליימר שלהם.
- דוחות שוק סינדיקטיים על "motorized TV mount $2B+" לא אומתו ולא משמשים כראיה.

**Agent Reach:** v1.5.0, כבר העדכני. Exa / Reddit-CLI / Twitter-CLI / Xiaohongshu כבויים; נעשה שימוש בחיפוש רשת, Jina, GitHub, X המובנה, V2EX.
