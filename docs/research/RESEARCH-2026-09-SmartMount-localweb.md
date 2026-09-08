# SmartMount - local web research (20260906-152405)

- Provider: LOCAL_WEB (duckduckgo-lite + qwen3:14b served by a local model endpoint on the owner's server)
- Sources: 16
- Queries: motorized TV mount with light sensor competitors 2026 | auto tilt TV mount alternatives with photocell | market size for smart motorized TV mounts 2026 | 2026 hackathons for IoT hardware development | grants for smart home automation 2026 | security requirements for ESP32 based smart mounts
- Note: free login-less research; a Perplexity Deep Research replaces this when available.

## PRODUCT_TRUTH  
SmartMount היא פרויקט חומרה שמתבסס על ESP32 וחיישני BH1750, עם מנוע צעד שמטרתו לנהל מסך לפי יחס האור. פרויקט זה **לא** מוצע כמוצר מסחרי, ולא עבר בדיקה או הפקה. הקושחה ב-`firmware/smart_mount.ino` נכתבה ללוח אמיתי, אך **לא רצה מול חומרה**. האלגוריתם של הבוהק **לא נבדק מול מדידה**. אין ענן, חשבונות או סליקה.  
הבדיקות היחידות שרוצות הן על המחשב, ללא תלויות, וכוללות חוק ההטיה, חוזה ה-HTTP, מומנט המנוע, פער בין lux לבהירות, **כל תא** במכונת המצבים, תקציב תזמון/הספק/סוללה, תוכנית HIL שמוגדרת כ-never-run, וחלופות שנדחו [n].  

## TARGET_USER_AND_PAID_PROBLEM  
SmartMount מכוון למשתמשים שמתעניינים בפתרונות חכמים לניהול מסכים, במיוחד אלו שמתעניינים במערכות חיבור אוטומטיות עם חיישנים. עם זאת, אין מידע מוכח על קהל יעד ספציפי או על בעיות מוניציפליות או מסחריות שמשתמשים ב-SmartMount כדי לפתור [n].  

## COMPETITORS_WITH_SOURCES  
ישנם מספר מתחרים בשוק המתקנים למסכים, כולל:  
- **Pipishell Full Motion TV Wall Mount** - מתאים למסכים עד 43 אינץ', עם אפשרות סיבוב וטילט [1].  
- **SANUS LMT15** - מתקן מנועי מתאים למסכים 40" - 60" עם טילט אוטומטי [2].  
- **Amazon Basics Full Motion Articulating Wall Mount** - מתאים למסכים עד 65 אינץ' [3].  
- **USX MOUNT UL Listed Full Motion Mount** - מתאים למסכים עד 90 אינץ' [1].  

## ACTIVE_OPPORTUNITIES_2026  
NO_VERIFIED_MATCH  

## SECURITY_PRIVACY_ACCESSIBILITY_GAPS  
אין מידע מוכח על פערים בביטחון, הפרטיות או גישה ב-SmartMount [n].  

## 72_HOUR_BACKLOG  
1. **src/lib/fsm.js** - בדיקה של כל תא במכונת המצבים (2×15 + 11×15) עם תוצאות מדידות מדויקות.  
2. **src/lib/optics.js** - בדיקה של פער בין lux לבהירות עם מדידות מדויקות.  
3. **src/lib/timing.js** - בדיקה של פרופיל AccelStepper עם תוצאות מדידות מדויקות.  

## 30_DAY_BACKLOG  
1. **src/lib/control-params.js** - בדיקה של חוק ההטיה עם תוצאות מדידות מדויקות.  
2. **src/lib/hil.js** - בדיקה של תוכנית HIL עם תוצאות מדידות מדויקות.  
3. **src/lib/power.js** - בדיקה של תקציב הספק עם תוצאות מדידות מדויקות.  

## ACCEPT_REWORK_HOLD  
אין מידע מוכח על אפליקציות, תקינות או עיכובים ב-SmartMount [n].  

## QUESTIONS_FOR_OWNER  
1. האם יש תוכניות להפקת מוצרי SmartMount לשוק?  
2. האם יש תקציבים או תקנות שמתאימים ל-SmartMount?  

## SOURCES
[1] 11 Best TV Mounts - Our Picks, Alternatives & Reviews - Alternative.me - https://alternative.me/tv-mounts
[2] SANUS LMT15 | Motorized Mounts | TV Mounts and Stands | Products | SANUS - https://www.sanus.com/en_us/products/tv-mounts/lmt15/
[3] Amazon.com: Motorized Tv Mount - https://www.amazon.com/motorized-tv-mount/s?k=motorized+tv+mount
[4] Amazon.com: Tiltable Tv Mount - https://www.amazon.com/tiltable-tv-mount/s?k=tiltable+tv+mount
[5] TV Wall Mounts Market Size, Trends & Forecast, 2026-2033 - https://www.coherentmarketinsights.com/industry-reports/tv-wall-mounts-market
[6] TV Mounts Market Report [2032]- Size & Share - https://www.micromarketinsights.com/product/tv-mounts-market/
[7] Television (TV) Mount Market Trends | Forecast & Strategic Outlook - https://www.globalgrowthinsights.com/market-reports/television-tv-mount-market-127714
[8] TV Mounts Market Analysis 2026: Revenue, Volume, Market Size, Share ... - https://www.cognitivemarketresearch.com/tv-mounts-market-report
[9] Upcoming IoT & Hardware Hackathons 2026 | Hackathon Radar - https://www.hackathonradar.com/discover/c/iot/2026
[10] 50 IoT & Hardware Hackathons | Hackathon Radar - https://www.hackathonradar.com/discover/c/iot
[11] Top IoT Hackathons for Connected Device Creators 2026 - https://allhackathons.com/themes/iot/
[12] Hardware / IoT hackathons 2026 / 2027 - dev.events - https://dev.events/hackathons/iot
[13] Smart Home Upgrade Grants 2026: Rebates, Assistance & Eligibility - https://homepropertygrants.com/2026/07/smart-home-upgrade-grants.html
[14] Smart Homes Grants 2026 -- Browse Opportunities | FindGrants - https://findgrants.io/grants/focus/smart_homes
[15] HUD Announces $10 Million in Funding for Leveraging Robotics and AI ... - https://www.huduser.gov/Portal/elist/2026-June-1.html
[16] Smart Home Tax Credits and Rebates: How to Get Money Back in 2026 ... - https://cleverhomeclub.com/smart-home-tax-credits-and-rebates-how-to-get-money-back-in-2026/
