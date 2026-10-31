import { expect, test } from '@playwright/test';
import { emailToken, login, newVerifiedUser, PASSWORD, signUp, uniq } from './helpers';

test.describe('Workflow A — account lifecycle', () => {
  test('sign up, verify, sign in, sign out; protected routes redirect', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);

    const email = await newVerifiedUser(page, 'Alice Auth');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await page.goto('/settings');
    await expect(page.getByText(/verified/i).first()).toBeVisible();

    await page.getByRole('button', { name: /account|alice/i }).first().click();
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/(login)?$/);
    await page.goto('/my-items');
    await expect(page).toHaveURL(/\/login/);
    void email;
  });

  test('duplicate sign-up does not reveal the account exists', async ({ page }) => {
    const email = `dup.${uniq()}@e2e.test`;
    await signUp(page, 'Dup One', email);
    await expect(page.getByText(/check your email|verification/i).first()).toBeVisible();
    await signUp(page, 'Dup Two', email);
    await expect(page.getByText(/check your email|verification/i).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /check your inbox/i })).toBeVisible();
  });

  test('wrong password shows a generic error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('nobody@e2e.test');
    await page.getByLabel(/^Password/).fill('Wrong-password-1');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/incorrect email or password|invalid/i).first()).toBeVisible();
  });

  test('password reset flow', async ({ page }) => {
    const email = await newVerifiedUser(page, 'Reset Rita');
    await page.context().clearCookies();
    await page.request.post('http://localhost:4000/api/v1/__test/outbox/clear');
    await page.goto('/forgot-password');
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: /send|reset/i }).click();
    await expect(page.getByText(/if an account|check your inbox|sent/i).first()).toBeVisible();
    const token = await emailToken(page.request, email, 'token');
    await page.goto(`/reset-password?token=${token}`);
    await page.getByLabel(/^New password/).fill('Brand-New-Pass-99');
    await page.getByLabel(/confirm/i).fill('Brand-New-Pass-99');
    await page.getByRole('button', { name: /update password/i }).click();
    await expect(page.getByText(/password (has been )?(updated|reset|changed)|go to sign in/i).first()).toBeVisible();
    await login(page, email, 'Brand-New-Pass-99');
    void PASSWORD;
  });
});
