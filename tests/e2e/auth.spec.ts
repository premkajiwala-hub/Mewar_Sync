import { expect, test } from '@playwright/test';
import { PASSWORD, registerArtisan, registerVisitor, signIn, signOut, uniqueEmail, watchConsole } from './helpers';

test.describe('authentication', () => {
  test('protected pages require sign-in and show no data', async ({ page }) => {
    await page.goto('/#/ledger');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ledger' })).toHaveCount(0);
  });

  test('registration validates input before creating an account', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('radio', { name: 'Create account' }).click();
    await page.getByText('Visitor', { exact: true }).click();
    await page.getByLabel('Full name').fill('A');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel(/^Password/).fill('short');
    await page.getByLabel('Confirm password').fill('different');
    await page.getByLabel('Mobile number').fill('12345');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Enter a valid email address.').first()).toBeVisible();
    await expect(page.getByText('Use at least 8 characters with letters and numbers.').first()).toBeVisible();
    await expect(page.getByText('Passwords do not match.').first()).toBeVisible();
    await expect(page.getByText('Enter a 10-digit mobile number (digits only).').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  });

  test('artisan can register, sign out, and sign back in', async ({ page }) => {
    const problems = watchConsole(page);
    const { email } = await registerArtisan(page, { name: 'Bhanwar Lal' });
    await signOut(page);
    await signIn(page, email);
    await expect(page.getByRole('heading', { name: /Khamma Ghani, Bhanwar/ })).toBeVisible();
    // Session survives a reload.
    await page.reload();
    await expect(page.getByRole('heading', { name: /Khamma Ghani, Bhanwar/ })).toBeVisible();
    await signOut(page);
    // After sign-out, going "back" does not reveal the app.
    await page.goBack();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('sign-in errors do not reveal whether an account exists', async ({ page }) => {
    const { email } = await registerVisitor(page);
    await signOut(page);
    await signIn(page, email, 'Wrong-password-1');
    await expect(page.getByRole('alert').filter({ hasText: 'Incorrect email or password.' })).toBeVisible();
    await signIn(page, uniqueEmail('nobody'), PASSWORD);
    await expect(page.getByRole('alert').filter({ hasText: 'Incorrect email or password.' })).toBeVisible();
  });

  test('password reset gives the same response for any email', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await page.getByLabel('Email').fill(uniqueEmail('missing'));
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'If an account exists for this email' })).toBeVisible();
  });

  test('a visitor cannot open artisan pages by URL', async ({ page }) => {
    await registerVisitor(page);
    await page.goto('/#/ledger');
    await expect(page).toHaveURL(/#\/explore$/);
    await expect(page.getByRole('heading', { name: 'Explore Udaipur' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ledger' })).toHaveCount(0);
  });
});
