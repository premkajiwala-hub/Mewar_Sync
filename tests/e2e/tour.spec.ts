import { expect, test, type Page } from '@playwright/test';
import { addStock, hasHorizontalOverflow, overflowCulprits, newEntry, registerArtisan, registerVisitor, signOut, watchConsole } from './helpers';

/*
 * Visual tour: visits every page as each role at several widths, saves
 * screenshots to test-results/tour, and asserts there is no horizontal
 * overflow and no console errors.
 */
const WIDTHS = [360, 390, 768, 1024, 1440, 1920];

async function capture(page: Page, name: string, widths = WIDTHS) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 768 ? 800 : 900 });
    await page.waitForTimeout(250);
    const overflow = await hasHorizontalOverflow(page);
    expect(overflow, `${name} overflows at ${width}px: ${overflow ? (await overflowCulprits(page)).join(' | ') : ''}`).toBe(false);
    await page.screenshot({ path: `test-results/tour/${name}-${width}.png`, fullPage: false });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

test('artisan pages render cleanly at every width', async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto('/');
  await capture(page, '00-auth');

  await registerArtisan(page, { name: 'Kamla Devi' });
  await addStock(page, 'Pichwai Painting', '6', '1800');
  await addStock(page, 'Brass Lamp', '3', '450');
  await page.goto('/#/ledger');
  const sale = await newEntry(page, { item: 'Pichwai Painting', quantity: '2', rate: '4500' });
  await sale.getByRole('button', { name: 'Save entry' }).click();
  await expect(sale).toBeHidden();
  const wages = await newEntry(page, { type: 'Other expense', item: 'Labour wages', quantity: '1', rate: '1200' });
  await wages.getByRole('button', { name: 'Save entry' }).click();
  await expect(wages).toBeHidden();
  const credit = await newEntry(page, { item: 'Brass Lamp', quantity: '1', rate: '900', udhaar: true, customer: 'Manmohan' });
  await credit.getByRole('button', { name: 'Save entry' }).click();
  await expect(credit).toBeHidden();

  for (const [path, name] of [
    ['/#/overview', '01-overview'],
    ['/#/ledger', '02-ledger'],
    ['/#/inventory', '03-inventory'],
    ['/#/udhaar', '04-udhaar'],
    ['/#/reports', '05-reports'],
    ['/#/gallery', '06-gallery'],
    ['/#/scan', '07-scan'],
    ['/#/settings', '08-settings'],
  ] as const) {
    await page.goto(path);
    await expect(page.locator('main h1').first()).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /Loading/ })).toHaveCount(0);
    await page.waitForTimeout(500);
    await capture(page, name);
  }

  await page.goto('/#/ledger');
  await page.getByRole('button', { name: 'New entry' }).first().click();
  await page.waitForTimeout(300);
  await capture(page, '09-entry-form', [390, 1440]);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Speak an entry' }).click();
  await page.waitForTimeout(300);
  await capture(page, '10-voice-panel', [390, 1440]);
  await page.getByRole('button', { name: 'Close voice entry' }).click();

  await signOut(page);
  expect(problems).toEqual([]);
});

test('visitor pages render cleanly at every width', async ({ page }) => {
  const problems = watchConsole(page);
  await registerVisitor(page);
  await page.waitForTimeout(800);
  await capture(page, '20-explore');
  await page.getByRole('button', { name: /City Palace/ }).first().click();
  await page.waitForTimeout(600);
  await capture(page, '21-explore-place', [390, 1440]);
  for (const [path, name] of [
    ['/#/artisans', '22-artisans'],
    ['/#/translator', '23-translator'],
    ['/#/authenticity', '24-authenticity'],
    ['/#/settings', '25-settings'],
  ] as const) {
    await page.goto(path);
    await expect(page.locator('main h1').first()).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /Loading/ })).toHaveCount(0);
    await page.waitForTimeout(500);
    await capture(page, name);
  }
  expect(problems).toEqual([]);
});
