// First visit and navigation through the SmartMount static site (CT-014).
// Runs on desktop and a 360px-wide mobile viewport (see ../playwright.config.js).
// Hebrew RTL site: assertions use roles, accessible names, ids and text, not CSS.
'use strict';

const { test, expect } = require('./fixtures');

const PAGES = ['/', '/case/', '/lab/', '/spec/', '/geometry/', '/protocol/', '/fsm/', '/runtime/', '/hil/', '/power/', '/alts/', '/dashboard/'];

test('home: what it is, the honest badge and the panel limits from control-params', async function ({ page }) {
  await page.goto('/');
  await expect(page).toHaveTitle(/SmartMount/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('שני חיישני אור');
  await expect(page.getByText('תיק עבודות — הקושחה לא רצה על לוח')).toBeVisible();
  await expect(page.getByLabel('מגבלות זווית לפי סוג פאנל')).toHaveText('OLED 40°, QLED 30°, LED 20°');
});

test('home -> engineering case via the main call to action', async function ({ page }) {
  await page.goto('/');
  await page.getByRole('link', { name: 'מקרה הנדסי — 90 שניות למגייסים' }).click();
  await expect(page).toHaveURL(/\/case\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('מקרה הנדסי');
});

test('main navigation: the "more" menu reaches the API contract page', async function ({ page }) {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'ניווט ראשי' });
  await nav.getByText('עוד', { exact: true }).click();
  await nav.getByRole('link', { name: 'חוזה API' }).click();
  await expect(page).toHaveURL(/\/protocol\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('an unknown path shows the site 404 page with a way home', async function ({ page }) {
  // The fixture fails a test on any 4xx, so this one checks the 404 page itself.
  const res = await page.request.get('/no-such-page/');
  expect(res.status()).toBe(404);
  expect(await res.text()).toContain('SmartMount');
});

for (const path of PAGES) {
  test(path + ' is Hebrew RTL and does not scroll sideways', async function ({ page }) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const widths = await page.evaluate(function () {
      return { scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth };
    });
    expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  });
}
