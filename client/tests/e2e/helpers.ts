import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const API = 'http://localhost:4000/api/v1';
export const PASSWORD = 'Sup3rSecret-pass!';
export const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export async function emailToken(request: APIRequestContext, to: string, param = 'token') {
  for (let i = 0; i < 20; i++) {
    const res = await request.get(`${API}/__test/outbox`, { params: { to } });
    const body = await res.json();
    const mails = (body.data ?? body) as { text: string }[];
    const m = mails.length ? mails[mails.length - 1]!.text.match(new RegExp(`${param}=([A-Za-z0-9_%-]+)`)) : null;
    if (m?.[1]) return decodeURIComponent(m[1]);
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no email for ${to}`);
}

export async function signUp(page: Page, name: string, email: string) {
  await page.goto('/signup');
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  const terms = page.getByRole('checkbox');
  if (await terms.count()) await terms.first().check();
  await page.getByRole('button', { name: /create account/i }).click();
}

/** Sign up, verify via the test outbox, and sign in. */
export async function newVerifiedUser(page: Page, name: string) {
  const email = `${name.toLowerCase().replace(/\W+/g, '.')}.${uniq()}@e2e.test`;
  await signUp(page, name, email);
  await expect(page.getByText(/check your email|verification/i).first()).toBeVisible();
  const token = await emailToken(page.request, email);
  await page.goto(`/verify-email?token=${token}`);
  await expect(page.getByText(/verified/i).first()).toBeVisible();
  await login(page, email);
  return email;
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function createItem(page: Page, title: string) {
  await page.goto('/items/new');
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Description').fill('A very useful item in great working order, happy to lend to neighbours.');
  await page.getByLabel('Category').selectOption({ index: 1 });
  await page.getByLabel('Condition').selectOption({ index: 1 });
  await page.getByLabel(/Community/).fill('Elm Street');
  await page.getByLabel('City').fill('Springfield');
  await page.getByLabel('Pickup instructions').fill('Ring the bell, side door.');
  await page.getByRole('button', { name: /publish listing/i }).click();
  await expect(page).toHaveURL(/\/items\/[0-9a-f-]{36}$|\/my-items/);
}

export const isoDay = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
