# SmartMount — מחקר מונטיזציה + פסק דין

**תאריך בדיקה:** 13 באוגוסט 2026  
**השאלה:** אחרי ש־[RESEARCH.md](RESEARCH.md) פסק **PARK** על מוצר חומרה מסחרי — האם נשאר *איזשהו* נתיב הכנסה?

**פסק דין:** **אין נתיב הכנסה. זה פריט תיק עבודות.**

לא KEEP, לא PIVOT לרישוי, לא ערכת מייקרים, לא ספונסרשיפ, לא ייעוץ כשירות. הערך היחיד הוא דף מקרה הנדסי שמגייסים יכולים לקרוא. זה התשובה הנכונה, לא כישלון של המחקר.

**מצב המאגר ב־13.8.2026** ([`gh api repos/Swissystem7/SmartMount`](https://github.com/Swissystem7/SmartMount)): 0 כוכבים, 0 forks, 0 issues, רישיון MIT, נוצר 12.7.2026. הקושחה **טרם רצה מול חומרה**. אלגוריתם הבוהק **לא כויל**.

**שיטת איסוף:** חיפוש רשת + Jina Reader + GitHub CLI + X המובנה + V2EX API.  
**לא זמין בזמן הבדיקה:** Exa, Reddit-CLI, Twitter-CLI, Xiaohongshu, LinkedIn MCP.  
**Agent Reach:** `doctor --json` ב־13.8.2026 — GitHub / web / V2EX / Bilibili-search / YouTube פעילים; Exa / Reddit / X-CLI / Xiaohongshu כבויים.

---

## 0) מה כבר נסגר ב־RESEARCH.md

פסק דין שוק (13.8.2026): **PARK**. אף תושבת ממונעת מסחרית חיה לא עושה הטיה לפי חיישן אור. [Vogel's TVM 7675](https://manuals.vogels.com/en-us/tvm7675_pro.html) כותבת במפורש שאין הטיה. [Sanus LMT15](https://www.sanus.com/en_US/products/tv-mounts/lmt15/) (2009) הופסקה. השוק פתר בוהק בציפוי הפאנל ([Samsung Glare Free](https://www.samsung.com/us/tvs/oled-tv/highlights/), [RTINGS 2026](https://www.rtings.com/tv/reviews/best/bright-room)).

המסמך הזה לא חוזר על זה. הוא בודק ארבעה נתיבים שנשארו פתוחים אחרי PARK.

---

## 1) רישוי האלגוריתם ליצרני תושבות

**פסק דין: לא. אין קונה, ואין מה למכור.**

| טענת הרישוי | מה נמצא ב־13.8.2026 |
|---|---|
| Vogel's / MantelMount / Future Automation רוצים חיישן אור | **אין עדות.** ל־Vogel's יש פריסטים + HDMI-on + Siri, ובמדריך כתוב שאין הטיה. MantelMount מוכרת גובה מעל האח. Future Automation מוכרת RS232 לאינטגרטורים. ראו [RESEARCH.md](RESEARCH.md). |
| האלגוריתם הוא IP ששווה תמלוגים | הקושחה היא יחס שני BH1750 מול סף 3 ורווח 5° — מספרים עגולים, **לא כיול**. BH1750 מודד lux כללי, לא כתם השתקפות. הרישיון כבר [MIT](LICENSE): כל יצרן יכול לקחת בלי לשלם. |
| יצרן ישלם על קושחה שלא רצה על לוח | **לא נמצא מקור** לעסקת רישוי אלגוריתם בקרה לא-מכוילת, לא-פטנטית, לשוק שכבר דחה את הקטגוריה. מדריכי OEM licensing (למשל [LicenseSpring, פברואר 2025](https://licensespring.com/blog/guide/oem-software-licensing)) מתארים מוצרים עם אכיפה, ביקורת, וביקוש קיים — לא סקיצה מהאקתון. |

**מה כן קיים ב־GitHub סביב תושבות ממונעות** (`gh search repos`, 13.8.2026): אינטגרציות *אל* מוצרים קיימים — [MantelMount MM860 ↔ Home Assistant](https://github.com/mdarnol/mm860-hass-integration), [Vogel's TVM7675 IR ל־Homey](https://github.com/joseluislucio/homey-vogels-motionmount-ir). המייקים רוצים **לשלוט** ב־MotionMount / MM815, לא לקנות אלגוריתם בוהק.

רישוי היה רעיון האקתון. אין ביקוש נצפה. MIT כבר ויתר על המונופול.

---

## 2) ערכת DIY / BOM + קושחה למייקים

**פסק דין: השוק לערכות ESP32+צעד קיים. SmartMount לא יכולה להיכנס אליו ביושר, וגם אם כן — זה לא עסק.**

### מה ערכות דומות באמת עולות (נצפה 13.8.2026)

השוואה כנה היא ל**בקר צעד עם ESP32**, לא לתושבת טלוויזיה. אף אחד מהמוצרים למטה לא טוען שהוא נושא מסך.

| מוצר | מה הוא | מחיר שנצפה | מצב ב־13.8.2026 | קישור |
|---|---|---|---|---|
| **OpenMYR ESP32 WiFi Stepper** | ESP32 + Allegro A5984, קושחה טעונה, WiFi | **$45** + משלוח $4 בתוך ארה״ב | המוכר **בחופשה** («This seller is taking a break») | [Tindie](https://www.tindie.com/products/openmyr/esp32-wifi-stepper-controller/) |
| **VAL-2000** (Valar) | ESP32 + TMC2209/2226, StallGuard, WiFi, קושחה טעונה | **$69** | **אזל מאז 23.1.2023** | [Tindie](https://www.tindie.com/products/valar/val-2000-wifi-stepper-motor-controller/) |
| **PD Stepper** (Things by Josh) | ESP32-S3 + TMC2209 + AS5600 closed-loop + USB-PD, בלי מנוע | **$64.95** ב־SparkFun; **$66** באתר היצרן (Full Kit); Partial Kit $51 לא זמין | מוצר חי, מתועד, קוד פתוח | [SparkFun ROB-30118](https://www.sparkfun.com/pd-stepper.html) · [thingsbyjosh.com](https://thingsbyjosh.com/products/pd-stepper) · [Tindie $65](https://www.tindie.com/products/thingsbyjosh/pd-stepper/) |
| **X-BLDC Dual-Channel** | בקר BLDC עם PID | היה **$65** | **הוצא ממכירה** | [Tindie (retired)](https://www.tindie.com/products/x-bldc/dual-channel-esp32-bldc-motor-driver/) |
| ערכות ESP32 כלליות (לא צעד) | SunFounder starter / Amazon 20-in-1 | **$59.99** / **$37.99** | במלאי לפי דפי החיפוש | [SunFounder](https://www.sunfounder.com/products/sunfounder-esp32-ultimate-starter-kit-with-esp32-camera-extension-board-battery) · [Amazon B0DZXCNJTP](https://www.amazon.com/ESP32-Starter-Sensors-Display-Modules/dp/B0DZXCNJTP) |
| AliExpress «ESP32 stepper» | לוחות גנריים / A4988 | קטעי חיפוש: **≈$10–$15** לערכה בסיסית; דפי סיטונאות מציגים גם **$19.79–$38.79** | **לא ננעל מק״ט חי אחד** עם מחיר סופי בזמן הבדיקה — אלה טווחי דף סיטונאי, לא הזמנה | [AliExpress wholesale](https://www.aliexpress.com/w/wholesale-esp32-stepper-motor.html) |

**עמלת Tindie** (דף רשמי, נקרא 13.8.2026): 5% על כל הזמנה ששולמה + עמלת Stripe / המרת מטבע. אין דמי רישום. [מקור](https://www.tindie.com/about/sell/).

**מה קורה למוכרים קטנים:** פוסט של מוכר Tindie בבריטניה (22.6.2018) — אחרי שנה, זמן אריזה / דואר / תמיכה לא הצדיק את הרווח הקטן, והוא הפסיק. [maidavale.org](https://maidavale.org/blog/tips-for-selling-on-tindie/). זה בן שמונה שנים; הוא עדיין התיאור הכנה ביותר שנמצא ל«למכור ערכה קטנה בלי מותג».

### מחירים ישראליים לחלקים (לא לערכה שלמה — כי אין כזו)

| פריט | מחיר שנצפה 13.8.2026 | חנות | קישור |
|---|---|---|---|
| ESP32 DevKit V1 30-pin | **₪49.90** | Robokit | [דף מוצר](https://robokit.co.il/product/%D7%9C%D7%95%D7%97-%D7%A4%D7%99%D7%AA%D7%95%D7%97-esp32-devkit-v1-%D7%A4%D7%99%D7%9F-30/) |
| ESP32 WROOM 38-pin | **₪105** | Hackstore (רחובות) | [דף מוצר](https://hackstore.co.il/product/%D7%9C%D7%95%D7%97-%D7%A4%D7%99%D7%AA%D7%95%D7%97-esp32/) |
| ESP32 Pro Mini Qwiic / C3 / מודולים | **₪19.60–₪74.80** (ומעלה ל־SparkFun RedBoard ₪313.70) | 4project (יהוד) | [קטלוג ESP32](https://www.4project.co.il/section/esp-esp32?viewall) |
| NEMA 17, 400 צעדים, 1.7A | **₪218.90** כולל מע״מ, 13 במלאי | 4project | [דף מוצר](https://www.4project.co.il/product/nema17-stepper-motor-400-steps) |
| A4988 Pololu | **₪52.20** כולל מע״מ (קטלוג 4project, 13.8.2026) | 4project | [דף מוצר 4P-1146](https://www.4project.co.il/product/1146) |
| A4988 עם גוף קירור | **₪30** | Hackstore | [דף מוצר](https://hackstore.co.il/product/%D7%93%D7%95%D7%97%D7%A3-%D7%96%D7%A8%D7%9D-%D7%9C%D7%9E%D7%A0%D7%95%D7%A2-%D7%A6%D7%A2%D7%93-a4988/) |
| BH1750 (Adafruit STEMMA QT) | **$4.50** ליחידה (1–9) | Adafruit | [מק״ט 4681](https://www.adafruit.com/product/4681) |
| BH1750 GY-302 ×2 | **$6.99** לזוג | SunFounder | [דף מוצר](https://www.sunfounder.com/products/light-intensity-sensor) |
| BH1750 מק״ט ישראלי חי | **לא נמצא** ב־4project / Hackstore / Robokit בזמן הבדיקה | — | חיישן אור אנלוגי Grove ב־4project הוא **₪12.10**, וזה **לא** BH1750 |

סכום חלקי ישראלי ללוח לחם (ESP32 ₪50 + שני BH1750 מיובאים ≈₪35 + A4988 ₪30 + NEMA17 ₪219 + ספק): **בערך ₪350–450 לאלקטרוניקה בלבד**, בלי פלדה, בלי תולעת, בלי מפסק, בלי UL. זה תואם את מה שכבר כתוב ב־[מפרט](https://swissystem7.github.io/SmartMount/spec/) — לא את ₪35–50 של ההאקתון.

### למה זה לא נתיב הכנסה ל־SmartMount

1. **אין מוצר למכור.** PD Stepper ו־OpenMYR מוכרים PCB מעוצב, מורכב, עם קושחה שרצה. כאן יש `.ino` שלא הועלה ללוח, בלי CAD, בלי מפסק, בלי תולעת.
2. **השוק כבר מלא בלוחות טובים יותר במחיר ערכה.** $45–$69 מקבלים TMC2209, USB-PD, אנקודר, StallGuard. ערכת «שני BH1750 + יחס לא מכויל» לא מתחרה בזה.
3. **AliExpress מוכרת את אותם רכיבים בעשרה דולר.** מייקר שרוצה ESP32+צעד לא צריך את SmartMount.
4. **אחריות לנפילת מסך.** [LegalMatch, עודכן 19.6.2023](https://www.legalmatch.com/law-library/article/flat-screen-tv-lawsuit.html): יצרן מסגרת/חומרה פגומה יכול להיות אחראי לפציעה אם התושבת נכשלת. למכור «ערכת DIY לתושבת טלוויזיה» בלי UL/TÜV, בלי מבחן עומס, בלי ביטוח מוצר — זה לא עסק קטן. זה סיכון משפטי. [Revelation AV, 23.10.2024](https://revelationav.com/2024/10/23/7-risks-of-diy-tv-mounting/) מסכמת את סיכוני התקנת DIY גם *בלי* מנוע.
5. **אי אפשר לכתוב מדריך בנייה כנה שמוכר ערכה.** המפרט כבר אומר שאין שרטוט לזרוע, אין נעילה עצמית, ו־HIL-10 אוסר טלוויזיה. דף הזמנה היה שקר.

**מסקנה לערכה:** לא לבנות דף BOM-להזמנה. מי שרוצה חלקים — יש 4project / Hackstore / Robokit / Tindie / SparkFun. המפרט הקיים מספיק כתיעוד.

---

## 3) ייעוץ / ערך תיק עבודות למשרת embedded

**פסק דין: הייעוץ כשירות — לא. התיק ככרטיס ביקור למשרה — כן, וזה הנתיב היחיד.**

### מה אין

- **אין לקוח ייעוץ.** אף אחד לא שוכר פרילנסר כדי להתקין אלגוריתם בוהק לא-מכויל על תושבת. יצרני התושבות לא מחפשים את זה (סעיף 1).
- **אי אפשר לכתוב בקו״ח «שיחררתי קושחה על חומרה».** הקושחה לא רצה על לוח. לכתוב אחרת זה שקר שראיון טכני ישבור במשפט אחד.

### מה כן

משרות embedded / firmware בישראל קיימות ב־13.8.2026: [Mobileye — Embedded Software Engineer, ירושלים](https://careers.mobileye.com/jobs), [Glassdoor — Embedded Engineer junior, לוויינים / Tel Aviv](https://www.glassdoor.com/Job/tel-aviv-yafo-firmware-engineer-jobs-SRCH_IL.0,13_IC2421096_KO14,31.htm), [CodeValue — 2–3 שנות embedded Linux, מחוז ת״א](https://www.linkedin.com/jobs/view/4413099899). Freefly Systems (לא ישראל, אבל מפורש) כותבת בדף המשרה: *«or a rock-star portfolio that proves equivalent depth»* ו־*«we LOVE portfolios FYI»*. [מקור](https://freeflysystems.com/careers/cmazuszss01jhq06k87po2rsq).

מה שמגייס embedded בודק בתיק, לא בסיפור המוצר:

- האם המועמד מוצא באגי בטיחות *לפני* שהמסך נופל (קריאת חיישן שלילית → HOLD, לא slam).
- האם הוא מבחין בין `bool autoMode` לבין מכונת מצבים עם UNHOMED / FAULT / סטול.
- האם הוא כותב מה *לא* נבדק.
- האם הבדיקות נועלות את הקושחה למודל, במקום דמו מבריק שמשקר.

זה בדיוק מה שיש כאן — אם מוצגים כך, בלי להעמיד פני מוצר.

**ערך כספי:** לא הכנסה מהפרויקט. הכנסה *אפשרית* ממשרה שהתיק עזר להשיג. אי אפשר לייחס למאגר הזה משכורת; אפשר רק לא לשקר עליו בראיון.

---

## 4) ספונסרשיפ קוד פתוח

**פסק דין: אפס. לא לשים כפתור כאילו מישהו ישלם.**

| עובדה | מקור | תאריך |
|---|---|---|
| SmartMount: 0 כוכבים, 0 forks, 0 תלויות | [GitHub](https://github.com/Swissystem7/SmartMount) | 13.8.2026 |
| מתוך ≈9,000 מפתחים שפתחו פרופיל Sponsors, **פחות מ־40%** קיבלו תרומה כלשהי | מצוטט אצל Fan et al., [arXiv:2401.02755](https://arxiv.org/abs/2401.02755) (הוגש 5.1.2024), על מחקר Shimada et al. 2022 | נקרא 13.8.2026 |
| GitHub Sponsors העבירו **יותר מ־$100M** ל־**70,000+** מתחזקים | [GitHub Blog, 20.7.2026](https://github.blog/open-source/maintainers/100-million-for-open-source-a-milestone-built-by-the-community/) | 20.7.2026 |
| ממוצע חשבונאי גס: $100M / 70k ≈ **$1,430 לכל החיים** — וזה **מופרז כלפי מעלה**, כי זה חוק חזקה (Livewire / tiangolo / Shopify), לא חציון | חישוב על מספרי GitHub למעלה | 13.8.2026 |
| «sponsorship replaces a salary for most people — it doesn't» | [@anurag_629 ב־X, 11.8.2026](https://x.com/anurag_629/status/2087185124009885741) על אבן ה־$100M | 11.8.2026 |
| סיפורי $100k/שנה הם חריגים עם קהילה ענקית (Caleb Porzio / Livewire) | [calebporzio.com, יוני 2020](https://calebporzio.com/i-just-hit-dollar-100000yr-on-github-sponsors-heres-how-i-did-it) — עדיין המקרה ש־GitHub עצמה מצטטת ב־2026 | נקרא 13.8.2026 |

סלוגן GitHub Sponsors: «Invest in the projects you **depend on**». אין תלויים ב־SmartMount. V2EX hot בזמן הבדיקה — אין דיון רלוונטי. X — אין שיחה על ערכת תושבת-בוהק.

כפתור Sponsors על מאגר בלי משתמשים הוא קישוט. לא נתיב הכנסה.

---

## 5) פסק דין

# אין נתיב הכנסה. זה פריט תיק עבודות.

| נתיב | האם מרוויחים? | למה |
|---|---|---|
| מוצר חומרה | לא — כבר PARK | אין קונה להטיה לפי אור |
| רישוי אלגוריתם | לא | אין ביקוש, אין כיול, MIT חינם |
| ערכת מייקרים / Tindie | לא | מתחרים טובים יותר ב־$45–$66; קושחה לא רצה; אחריות לנפילת מסך |
| ייעוץ כשירות | לא | אין לקוח לבעיה שהשוק לא קונה |
| GitHub Sponsors / Open Collective | לא | 0 כוכבים, 0 תלויים, רוב הפרופילים לא מקבלים שקל |
| **תיק עבודות למשרת embedded** | **כן, וזה הכל** | באגי בטיחות, FSM, בדיקות כנות, בלי לשקר על חומרה |

### מה עושים עכשיו

לבנות דף מקרה הנדסי שמגייסים קוראים ב־90 שניות: הבאגים שנמצאו ותוקנו בסקירה, מכונת המצבים מול מה שחסר, והפשרות. **לא** דף הזמנת ערכה. **לא** כפתור ספונסר. **לא** לרמוז שהקושחה רצה על לוח.

הדף: [מקרה הנדסי](https://swissystem7.github.io/SmartMount/case/).

---

### מגבלות הבדיקה

- אין נתוני מכירות יחידה מ־Tindie / SparkFun (רק מחיר מדף וסטטוס מלאי).
- מחיר AliExpress ספציפי למק״ט חי — לא ננעל; צוטטו רק טווחי דף סיטונאי.
- BH1750 מק״ט ישראלי חי — לא נמצא.
- מחיר 4project A4988 נלקח מקטלוג החיפוש (₪52.20) + דף המוצר; בלוק המחיר ב־Jina על דף 1146 לא הוחזר במלואו.
- Reddit לא נקרא דרך API.
- אין ראיון עם מוכר Tindie פעיל ב־2026.
- דוחות שוק סינדיקטיים לא משמשים כראיה.

**Agent Reach:** GitHub CLI + Jina + V2EX + חיפוש רשת + X המובנה. Exa / Reddit-CLI / Twitter-CLI / Xiaohongshu כבויים ב־`doctor`.
