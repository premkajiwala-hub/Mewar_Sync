import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { addStock, newEntry, registerArtisan, watchConsole } from './helpers';

async function stockOf(page: Page, item: string): Promise<string> {
  await page.goto('/#/inventory');
  const row = page.locator('tr', { hasText: item }).first();
  await expect(row).toBeVisible();
  return (await row.locator('td').nth(2).locator('span.ms-num').first().innerText()).trim();
}

test.describe('artisan ledger and inventory', () => {
  test.beforeEach(async ({ page }) => {
    await registerArtisan(page);
  });

  test('records a sale, keeps stock in step through edit and delete', async ({ page }) => {
    const problems = watchConsole(page);
    await addStock(page, 'Brass Lamp', '5', '200');
    expect(await stockOf(page, 'Brass Lamp')).toBe('5');

    await page.goto('/#/ledger');
    const sale = await newEntry(page, { item: 'Brass Lamp', quantity: '2', rate: '350.50' });
    await expect(sale.getByText('₹701')).toBeVisible();
    await sale.getByRole('button', { name: 'Save entry' }).click();
    await expect(page.getByText('Sale of ₹701 recorded').first()).toBeVisible();
    const row = page.locator('tr', { hasText: 'Brass Lamp' });
    await expect(row).toContainText('+₹701');
    await expect(row).toContainText('Margin ₹301');
    expect(await stockOf(page, 'Brass Lamp')).toBe('3');

    // Edit quantity 2 → 3: one more lamp leaves stock.
    await page.goto('/#/ledger');
    await page.getByRole('button', { name: 'Edit Brass Lamp' }).click();
    const edit = page.getByRole('dialog', { name: 'Edit entry' });
    await edit.getByLabel('Quantity').fill('3');
    await edit.getByRole('button', { name: 'Save changes' }).click();
    await expect(edit).toBeHidden();
    await expect(page.locator('tr', { hasText: 'Brass Lamp' })).toContainText('+₹1,051.5');
    expect(await stockOf(page, 'Brass Lamp')).toBe('2');

    // Delete with "put back into stock".
    await page.goto('/#/ledger');
    await page.getByRole('button', { name: 'Delete Brass Lamp' }).click();
    const confirm = page.getByRole('dialog', { name: 'Delete this entry?' });
    await expect(confirm.getByLabel('Put 3 back into stock')).toBeChecked();
    await confirm.getByRole('button', { name: 'Delete entry' }).click();
    await expect(page.getByText('No entries for this day')).toBeVisible();
    expect(await stockOf(page, 'Brass Lamp')).toBe('5');
    expect(problems).toEqual([]);
  });

  test('blocks overselling and invalid amounts', async ({ page }) => {
    await addStock(page, 'Pichwai', '1', '1500');
    await page.goto('/#/ledger');
    const over = await newEntry(page, { item: 'Pichwai', quantity: '4', rate: '5000' });
    await over.getByRole('button', { name: 'Save entry' }).click();
    await expect(over.getByText('Only 1 in stock.')).toBeVisible();

    await over.getByLabel('Quantity').fill('1');
    await over.getByLabel('Rate per piece').fill('-5000');
    await over.getByRole('button', { name: 'Save entry' }).click();
    await expect(over.getByText('Rate cannot be negative.')).toBeVisible();

    await over.getByLabel('Rate per piece').fill('0');
    await over.getByRole('button', { name: 'Save entry' }).click();
    await expect(over.getByText('Total must be greater than zero.')).toBeVisible();

    await over.getByLabel('Rate per piece').fill('12.345');
    await over.getByRole('button', { name: 'Save entry' }).click();
    await expect(over.getByText('Use at most 2 decimal places.')).toBeVisible();

    await over.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('No entries for this day')).toBeVisible();

    const unknown = await newEntry(page, { item: 'Unknown statue', quantity: '1', rate: '100' });
    await unknown.getByRole('button', { name: 'Save entry' }).click();
    await expect(unknown.getByText('“Unknown statue” is not in your inventory yet.')).toBeVisible();
  });

  test('double-clicking save creates exactly one entry', async ({ page }) => {
    await page.goto('/#/ledger');
    const wages = await newEntry(page, { type: 'Other expense', item: 'Labour wages', quantity: '1', rate: '800' });
    await wages.getByRole('button', { name: 'Save entry' }).dblclick();
    await expect(wages).toBeHidden();
    await page.reload();
    await expect(page.locator('tr', { hasText: 'Labour wages' })).toHaveCount(1);
  });

  test('renders malicious text as plain text, in the app and in printed reports', async ({ page }) => {
    const payload = '<img src=x onerror="window.__xss=1">Lamp';
    await page.goto('/#/ledger');
    const entry = await newEntry(page, { type: 'Other expense', item: payload, quantity: '1', rate: '10', customer: '<b>bold</b>' });
    await entry.getByRole('button', { name: 'Save entry' }).click();
    await expect(entry).toBeHidden();
    await expect(page.locator('tr', { hasText: payload })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();

    await page.goto('/#/reports');
    await page.getByRole('radio', { name: 'Today' }).click();
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Print' }).click()]);
    await popup.waitForLoadState();
    const html = await popup.content();
    expect(html).toContain('&lt;img src=x onerror=');
    expect(await popup.locator('img').count()).toBe(0);
    expect(await popup.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    await popup.close();
  });

  test('CSV export neutralises spreadsheet formulas', async ({ page }) => {
    await page.goto('/#/ledger');
    const entry = await newEntry(page, { type: 'Other expense', item: '=HYPERLINK("http://evil.example","Click")', quantity: '1', rate: '25' });
    await entry.getByRole('button', { name: 'Save entry' }).click();
    await expect(entry).toBeHidden();
    await page.goto('/#/reports');
    await page.getByRole('radio', { name: 'Today' }).click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download CSV' }).click()]);
    const csv = fs.readFileSync(await download.path(), 'utf8');
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"",""Click"")"`);
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);
  });

  test('udhaar sale requires a customer and settles into the ledger once', async ({ page }) => {
    await addStock(page, 'Clay Pot', '4', '30');
    await page.goto('/#/ledger');
    const credit = await newEntry(page, { item: 'Clay Pot', quantity: '2', rate: '120', udhaar: true });
    await credit.getByRole('button', { name: 'Save entry' }).click();
    await expect(credit.getByText('Who owes this amount? Enter the customer name.')).toBeVisible();
    await credit.getByLabel('Customer').fill('Manmohan');
    await credit.getByRole('button', { name: 'Save entry' }).click();
    await expect(page.getByText('Sale of ₹240 recorded as udhaar').first()).toBeVisible();
    await expect(page.getByText('No entries for this day')).toBeVisible();
    expect(await stockOf(page, 'Clay Pot')).toBe('2');

    await page.goto('/#/overview');
    await expect(page.getByText('1 entry owed to you')).toBeVisible();
    await expect(page.getByText('Oldest open')).toBeVisible();

    await page.goto('/#/udhaar');
    await expect(page.getByRole('heading', { name: 'Manmohan' })).toBeVisible();
    await page.getByRole('button', { name: 'Mark received' }).click();
    await page.getByRole('dialog', { name: 'Payment received?' }).getByRole('button', { name: 'Yes, received in full' }).click();
    await expect(page.getByText('Nobody owes you right now').or(page.getByText('No open udhaar'))).toBeVisible();

    await page.goto('/#/ledger');
    await expect(page.locator('tr', { hasText: 'Clay Pot' })).toContainText('+₹240');
    expect(await stockOf(page, 'Clay Pot')).toBe('2');
  });

  test('voice entries are always reviewed before saving', async ({ page }) => {
    await addStock(page, 'Brass Lamp', '5', '200');
    await page.goto('/#/overview');

    await page.getByRole('button', { name: 'Speak an entry' }).last().click();
    const panel = page.getByRole('dialog', { name: 'Voice entry' });
    if (await panel.getByRole('button', { name: 'Type instead' }).isVisible()) await panel.getByRole('button', { name: 'Type instead' }).click();

    // Something that is not a ledger entry is rejected without saving anything.
    await panel.getByLabel('Describe the entry').fill('the weather is lovely today');
    await panel.getByRole('button', { name: 'Understand entry' }).click();
    await expect(panel.getByRole('alert')).toContainText('couldn’t find a sale');

    await panel.getByLabel('Describe the entry').fill('sold 2 brass lamp for 500 rupees');
    await panel.getByRole('button', { name: 'Understand entry' }).click();
    const review = page.getByRole('dialog', { name: 'Check your spoken entry' });
    await expect(review).toBeVisible();
    await expect(review.getByText('“sold 2 brass lamp for 500 rupees”')).toBeVisible();
    await expect(review.getByLabel('Item or description')).toHaveValue('Brass Lamp');
    await expect(review.getByLabel('Quantity')).toHaveValue('2');
    await expect(review.getByLabel('Rate per piece')).toHaveValue('250');

    // Discarding the draft saves nothing.
    await review.getByRole('button', { name: 'Discard' }).click();
    await expect(review).toBeHidden();
    expect(await stockOf(page, 'Brass Lamp')).toBe('5');
    await page.goto('/#/ledger');
    await expect(page.getByText('No entries for this day')).toBeVisible();
  });

  test('voice review can be corrected and confirmed', async ({ page }) => {
    await addStock(page, 'Brass Lamp', '5', '200');
    await page.goto('/#/ledger');
    await page.getByRole('button', { name: 'Speak an entry' }).click();
    const panel = page.getByRole('dialog', { name: 'Voice entry' });
    if (await panel.getByRole('button', { name: 'Type instead' }).isVisible()) await panel.getByRole('button', { name: 'Type instead' }).click();
    await panel.getByLabel('Describe the entry').fill('sold 2 brass lamp for 500 rupees');
    await panel.getByRole('button', { name: 'Understand entry' }).click();
    const review = page.getByRole('dialog', { name: 'Check your spoken entry' });
    await review.getByLabel('Rate per piece').fill('260');
    await review.getByRole('button', { name: 'Confirm & save' }).click();
    await expect(page.getByText('Sale of ₹520 recorded').first()).toBeVisible();
    await expect(page.locator('tr', { hasText: 'Brass Lamp' })).toContainText('+₹520');
    expect(await stockOf(page, 'Brass Lamp')).toBe('3');
  });

  test('merge duplicates and the overview reflect inventory', async ({ page }) => {
    await addStock(page, 'Silver Anklet', '2', '900');
    await page.goto('/#/inventory');
    await expect(page.locator('tr', { hasText: 'Silver Anklet' })).toBeVisible();
    await addStock(page, 'Silver Anklet', '3', '900');
    // Same name, source and cost → quantities are merged automatically.
    expect(await stockOf(page, 'Silver Anklet')).toBe('5');

    await page.goto('/#/overview');
    await expect(page.getByText(/1 item · ₹4,500 at cost/)).toBeVisible();
  });
});
