import { expect, test } from '@playwright/test';

test('landing and browse are usable on a phone without horizontal scrolling', async ({ page }) => {
  for (const url of ['/', '/browse', '/login', '/help']) {
    await page.goto(url);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${url} overflows horizontally`).toBeLessThanOrEqual(1);
  }
});
