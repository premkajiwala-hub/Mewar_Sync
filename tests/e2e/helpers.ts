import { expect, type Page } from '@playwright/test';

let counter = 0;
export function uniqueEmail(tag: string): string {
  counter += 1;
  return `${tag}-${Date.now().toString(36)}-${counter}@example.com`;
}

export const PASSWORD = 'Mewar-test-2026';

/** Fails the test if any uncaught page error or console error occurs. */
export function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', err => problems.push(`pageerror: ${err.message}`));
  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // Map tiles may fail offline; that is not an application error.
    if (/tile\.openstreetmap|Failed to load resource.*(tile|nominatim)/i.test(text)) return;
    problems.push(`console: ${text}`);
  });
  return problems;
}

export async function registerArtisan(page: Page, opts: { name?: string; email?: string } = {}) {
  const email = opts.email ?? uniqueEmail('artisan');
  const name = opts.name ?? 'Arjun Mewari';
  await page.goto('/');
  await page.getByRole('radio', { name: 'Create account' }).click();
  await page.getByText('Artisan', { exact: true }).click();
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByLabel('Mobile number').fill('9876543210');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Workshop location' })).toBeVisible();
  await page.locator('.leaflet-container').click({ position: { x: 200, y: 120 } });
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`Khamma Ghani, ${name.split(' ')[0]}`) })).toBeVisible({ timeout: 20_000 });
  return { email, name };
}

export async function registerVisitor(page: Page, opts: { name?: string; email?: string } = {}) {
  const email = opts.email ?? uniqueEmail('visitor');
  const name = opts.name ?? 'Vera Traveller';
  await page.goto('/');
  await page.getByRole('radio', { name: 'Create account' }).click();
  await page.getByText('Visitor', { exact: true }).click();
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByLabel('Mobile number').fill('9123456780');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Explore Udaipur' })).toBeVisible({ timeout: 20_000 });
  return { email, name };
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
}

export async function addStock(page: Page, item: string, quantity: string, cost: string) {
  await page.goto('/#/inventory');
  await page.getByRole('button', { name: 'Add stock' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add stock' });
  await dialog.getByLabel('Item name').fill(item);
  await dialog.getByLabel('Quantity to add').fill(quantity);
  await dialog.getByLabel('Unit cost').fill(cost);
  await dialog.getByRole('button', { name: 'Add to stock' }).click();
  await expect(dialog).toBeHidden();
}

export async function newEntry(page: Page, e: { type?: string; item: string; quantity?: string; rate?: string; amount?: string; udhaar?: boolean; customer?: string; personal?: boolean }) {
  await page.getByRole('button', { name: 'New entry' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'New entry' });
  if (e.personal) await dialog.getByRole('radio', { name: 'Personal' }).click();
  if (e.type) await dialog.getByLabel('Entry type').selectOption({ label: e.type });
  await dialog.getByLabel(e.personal ? 'Person' : 'Item or description').fill(e.item);
  if (e.quantity !== undefined) await dialog.getByLabel('Quantity').fill(e.quantity);
  if (e.rate !== undefined) await dialog.getByLabel(/Rate per piece|Cost per unit/).fill(e.rate);
  if (e.amount !== undefined) await dialog.getByLabel('Amount').fill(e.amount);
  if (e.udhaar) await dialog.getByLabel('Payment').selectOption('PENDING');
  if (e.customer) await dialog.getByLabel(/Customer|Supplier|Note/).fill(e.customer);
  return dialog;
}

export async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const overflowing = doc.scrollWidth > window.innerWidth + 1;
    const main = document.getElementById('main');
    return overflowing || (!!main && main.scrollWidth > main.clientWidth + 1);
  });
}

/** Describes elements that extend past the viewport (for overflow failures). */
export async function overflowCulprits(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const vw = document.documentElement.clientWidth;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('main *'))) {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 && r.width > 0) {
        const style = getComputedStyle(el);
        if (style.position === 'fixed') continue;
        out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 80)} right=${Math.round(r.right)} w=${Math.round(r.width)}`);
      }
    }
    return out.slice(0, 8);
  });
}
