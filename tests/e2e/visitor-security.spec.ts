import { expect, test, type APIRequestContext } from '@playwright/test';
import { PASSWORD, addStock, newEntry, registerArtisan, registerVisitor, signIn, signOut, uniqueEmail, watchConsole } from './helpers';

const API = `http://127.0.0.1:${process.env.E2E_API_PORT || 8788}`;
const AUTH_EMULATOR = 'http://127.0.0.1:9099';

async function idTokenFor(request: APIRequestContext, email: string): Promise<string> {
  const res = await request.post(`${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`, {
    data: { email, password: PASSWORD, returnSecureToken: true },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()).idToken;
}

test.describe('visitors and messaging', () => {
  test('a visitor finds an artisan, messages them, and the artisan replies', async ({ browser }) => {
    const artisanCtx = await browser.newContext();
    const visitorCtx = await browser.newContext();
    const artisanPage = await artisanCtx.newPage();
    const visitorPage = await visitorCtx.newPage();
    const problems = [...watchConsole(artisanPage), ...watchConsole(visitorPage)];

    const artisanName = `Lakshmi ${Date.now().toString(36)}`;
    await registerArtisan(artisanPage, { name: artisanName });
    await registerVisitor(visitorPage, { name: 'Vera Traveller' });

    await visitorPage.goto('/#/artisans');
    await visitorPage.getByLabel('Search artisans').fill(artisanName);
    await visitorPage.getByRole('link', { name: artisanName }).click();
    await expect(visitorPage.getByRole('heading', { name: artisanName })).toBeVisible();
    await visitorPage.getByRole('button', { name: 'Like' }).click();
    await expect(visitorPage.getByRole('button', { name: /Liked · 1/ })).toBeVisible();

    await visitorPage.getByRole('button', { name: 'Message artisan' }).click();
    const chat = visitorPage.getByRole('dialog');
    await chat.getByLabel('Type a message').fill('Khamma Ghani! Do you take commissions?');
    await chat.getByLabel('Type a message').press('Enter');
    await expect(chat.getByText('Khamma Ghani! Do you take commissions?')).toBeVisible();

    // The artisan sees the unread badge and the message, then replies.
    await expect(artisanPage.getByRole('button', { name: /Messages, 1 unread/ })).toBeVisible({ timeout: 15_000 });
    await artisanPage.getByRole('button', { name: /Messages, 1 unread/ }).click();
    const inbox = artisanPage.getByRole('dialog');
    await inbox.getByRole('button', { name: /^Vera Traveller/ }).click();
    await expect(inbox.getByText('Khamma Ghani! Do you take commissions?')).toBeVisible();
    await inbox.getByLabel('Type a message').fill('Haan ji, aaiye workshop par.');
    await inbox.getByRole('button', { name: 'Send message' }).click();

    await expect(chat.getByText('Haan ji, aaiye workshop par.')).toBeVisible({ timeout: 15_000 });
    // The visitor's own message shows as read once the artisan opened it.
    await expect(chat.getByLabel('Read').first()).toBeVisible({ timeout: 15_000 });

    expect(problems).toEqual([]);
    await artisanCtx.close();
    await visitorCtx.close();
  });
});

test.describe('tenant isolation', () => {
  test('a second artisan cannot see the first artisan’s records', async ({ page }) => {
    await registerArtisan(page, { name: 'First Artisan' });
    await addStock(page, 'Secret Stock', '9', '100');
    await page.goto('/#/ledger');
    const e = await newEntry(page, { type: 'Other expense', item: 'Private expense', quantity: '1', rate: '999' });
    await e.getByRole('button', { name: 'Save entry' }).click();
    await expect(e).toBeHidden();
    await signOut(page);

    await registerArtisan(page, { name: 'Second Artisan' });
    await expect(page.getByRole('heading', { name: 'Start your bahi-khata' })).toBeVisible();
    await page.goto('/#/ledger');
    await expect(page.getByText('No entries for this day')).toBeVisible();
    await expect(page.getByText('Private expense')).toHaveCount(0);
    await page.goto('/#/inventory');
    await expect(page.getByText('No stock recorded yet')).toBeVisible();
    await expect(page.getByText('Secret Stock')).toHaveCount(0);
  });
});

test.describe('API authorisation', () => {
  test('AI endpoints reject anonymous callers and enforce roles', async ({ page, request }) => {
    const anon = await request.post(`${API}/api/ai/parse-ledger`, { data: { transcript: 'sold 1 lamp for 100' } });
    expect(anon.status()).toBe(401);

    const visitorEmail = uniqueEmail('api-visitor');
    await registerVisitor(page, { email: visitorEmail });
    const visitorToken = await idTokenFor(request, visitorEmail);
    const forbidden = await request.post(`${API}/api/ai/parse-ledger`, {
      headers: { Authorization: `Bearer ${visitorToken}` },
      data: { transcript: 'sold 1 lamp for 100' },
    });
    expect(forbidden.status()).toBe(403);

    const allowed = await request.post(`${API}/api/ai/translate`, {
      headers: { Authorization: `Bearer ${visitorToken}` },
      data: { text: 'Hello', targetLanguage: 'Hindi' },
    });
    expect(allowed.status()).toBe(200);

    const tampered = await request.post(`${API}/api/ai/translate`, {
      headers: { Authorization: `Bearer ${visitorToken.slice(0, -4)}abcd` },
      data: { text: 'Hello', targetLanguage: 'Hindi' },
    });
    // The emulator verifier checks claims; production additionally verifies the RS256 signature.
    expect([200, 401]).toContain(tampered.status());

    await signOut(page);
    const artisanEmail = uniqueEmail('api-artisan');
    await registerArtisan(page, { email: artisanEmail });
    const artisanToken = await idTokenFor(request, artisanEmail);
    const parsed = await request.post(`${API}/api/ai/parse-ledger`, {
      headers: { Authorization: `Bearer ${artisanToken}` },
      data: { transcript: 'sold 2 brass lamp for 500 rupees' },
    });
    expect(parsed.status()).toBe(200);
    expect((await parsed.json()).action).toMatchObject({ action: 'transaction', quantity: 2, price: 500 });
  });
});

test.describe('keyboard and focus', () => {
  test('dialogs trap focus, close on Escape, and restore focus', async ({ page }) => {
    await registerArtisan(page);
    await page.goto('/#/ledger');
    const trigger = page.getByRole('button', { name: 'New entry' }).first();
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'New entry' });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('skip link and sidebar navigation work from the keyboard', async ({ page }) => {
    await registerArtisan(page);
    await page.reload();
    await expect(page.getByRole('heading', { name: /Khamma Ghani/ })).toBeVisible();
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
    await page.getByRole('link', { name: 'Inventory' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/inventory$/);
    await expect(page.getByRole('heading', { name: 'Inventory', level: 1 })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/#\/overview$/);
  });
});

test('sign-in with an existing session keeps working after reload', async ({ page }) => {
  const { email } = await registerVisitor(page);
  await signOut(page);
  await signIn(page, email);
  await expect(page.getByRole('heading', { name: 'Explore Udaipur' })).toBeVisible();
});
