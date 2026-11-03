// Interactive flows a visitor tries after the home page (CT-014):
// the engineering case filter, the control dashboard, the fault-injection lab
// and the torque calculator. Desktop + 360px mobile.
'use strict';

const { test, expect } = require('./fixtures');

function metric(page, id) {
  return page.locator('#' + id + ' b');
}

test('case: filter the review findings by severity', async function ({ page }) {
  await page.goto('/case/');
  const filters = page.getByRole('group', { name: 'סינון באגים לפי חומרה' });
  await expect(page.locator('#bugFilterCount')).toHaveText('מציג 6 מתוך 6 ממצאי סקירה');

  await filters.getByRole('button', { name: /^בטיחות/ }).click();
  await expect(filters.getByRole('button', { name: /^בטיחות/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(filters.getByRole('button', { name: /^הכול/ })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#bugFilterCount')).toContainText('2 מתוך 6');

  await filters.getByRole('button', { name: /^הכול/ }).click();
  await expect(page.locator('#bugFilterCount')).toHaveText('מציג 6 מתוך 6 ממצאי סקירה');
});

test.describe('dashboard: the control law in the browser', function () {
  test('glare tilts to the target, a failed sensor holds the angle', async function ({ page }) {
    await page.goto('/dashboard/');
    await expect(metric(page, 'mDec')).toHaveText('שקט');
    await expect(page.locator('#angleVal')).toHaveText('0.0°');

    const presets = page.getByRole('group', { name: 'תרחישים מהירים' });
    await presets.getByRole('button', { name: 'בוהק חזק' }).click();
    await expect(metric(page, 'mDec')).toHaveText('MOVE');
    await expect(metric(page, 'mRatio')).toHaveText('6.00×');
    await expect(page.locator('#angleVal')).toHaveText('15.1°');

    // BH1750 returning -1 must hold the current angle, not slam to the limit.
    await presets.getByRole('button', { name: 'כשל עליון (−1)' }).click();
    await expect(metric(page, 'mDec')).toHaveText('HOLD');
    await expect(page.locator('#angleVal')).toHaveText('15.1°');
  });

  test('manual mode unlocks the manual angle slider', async function ({ page }) {
    await page.goto('/dashboard/');
    const manual = page.getByRole('slider', { name: /זווית ידנית/ });
    await expect(manual).toBeDisabled();
    await page.getByRole('group', { name: 'מצב בקרה' }).getByRole('button').click();
    await expect(manual).toBeEnabled();
    await manual.fill('-12');
    // moveToAngle rounds to whole motor steps like the firmware: -12° is 33 steps = -11.9°.
    await expect(page.locator('#angleVal')).toHaveText('-11.9°');
  });
});

test.describe('lab: fault-injection console', function () {
  test('a dead top sensor reads FAIL and the firmware loop holds', async function ({ page }) {
    await page.goto('/lab/');
    await expect(page.locator('#badgeAuto')).toHaveText('auto ON');
    await page.getByRole('button', { name: 'כשל עליון' }).click();
    await expect(page.getByRole('button', { name: 'כשל עליון' })).toHaveAttribute('aria-pressed', 'true');
    await expect(metric(page, 'mTop')).toContainText('FAIL');
    await expect(metric(page, 'mDec')).toHaveText('HOLD');
  });

  test('deg=99 over HTTP returns 200, turns auto off and clamps to the OLED limit', async function ({ page }) {
    await page.goto('/lab/');
    await page.getByRole('button', { name: 'שלח deg=99' }).click();
    await expect(page.locator('#httpLog')).toContainText('POST /set-angle?deg=99');
    await expect(page.locator('#httpLog')).toContainText('200');
    await expect(page.locator('#badgeAuto')).toContainText('auto OFF');
    await expect(metric(page, 'mTgt')).toContainText('40.0°');
    await expect(metric(page, 'mCur')).toHaveText('40.0°', { timeout: 15000 });

    await page.getByRole('button', { name: 'החזר אוטו' }).click();
    await expect(page.locator('#badgeAuto')).toHaveText('auto ON');
  });

  test('cutting WiFi keeps local auto mode and prints the firmware line', async function ({ page }) {
    await page.goto('/lab/');
    await page.getByRole('button', { name: 'נתק WiFi' }).click();
    await expect(page.locator('#badgeWifi')).toHaveText('WiFi DOWN');
    await expect(page.locator('#serialLog')).toContainText('WiFi timeout — continuing in local auto mode');
    await expect(page.locator('#badgeAuto')).toHaveText('auto ON');
  });

  test('switching the panel type is reflected in the pressed state', async function ({ page }) {
    await page.goto('/lab/');
    const panels = page.getByRole('group', { name: 'סוג פאנל' });
    await panels.getByRole('button', { name: 'LED 20°', exact: true }).click();
    await expect(panels.getByRole('button', { name: 'LED 20°', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(panels.getByRole('button', { name: 'OLED 40°', exact: true })).toHaveAttribute('aria-pressed', 'false');
  });
});

test('spec: torque calculator reacts to mass and to a self-locking drive', async function ({ page }) {
  await page.goto('/spec/');
  const verdict = page.locator('#tVerdict');
  await expect(verdict).not.toHaveText('מחשבים…');
  const req18 = await page.locator('#tReq').textContent();
  const off = await page.locator('#tOff').textContent();

  await page.getByRole('slider', { name: /מסת מסך/ }).fill('4');
  await expect(page.locator('#tReq')).not.toHaveText(req18);
  expect(parseFloat(await page.locator('#tReq').textContent())).toBeLessThan(parseFloat(req18));

  await page.getByRole('checkbox', { name: /נעילה עצמית/ }).check();
  await expect(page.locator('#tOff')).not.toHaveText(off);

  await page.getByRole('button', { name: 'שחזר ברירות מחדל של הקושחה' }).click();
  await expect(page.getByRole('spinbutton', { name: /יחס תמסורת/ })).toHaveValue('5');
});
