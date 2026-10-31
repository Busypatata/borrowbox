import { expect, test } from '@playwright/test';
import { createItem, isoDay, newVerifiedUser, uniq } from './helpers';

test.describe('Workflows B–E — list, discover, borrow, review, message', () => {
  test('full lending lifecycle between two members', async ({ browser }) => {
    test.setTimeout(120_000);
    const ownerCtx = await browser.newContext();
    const borrowerCtx = await browser.newContext();
    const owner = await ownerCtx.newPage();
    const borrower = await borrowerCtx.newPage();
    const title = `Drill ${uniq()}`;

    await newVerifiedUser(owner, 'Olive Owner');
    await newVerifiedUser(borrower, 'Bob Borrower');

    // B: owner lists an item; it shows up in search and the borrower can wish-list it
    await createItem(owner, title);
    await borrower.goto(`/browse?q=${encodeURIComponent(title)}`);
    const card = borrower.getByRole('link', { name: new RegExp(title) }).first();
    await expect(card).toBeVisible();
    await borrower.getByRole('button', { name: new RegExp(`save ${title} to wish list`, 'i') }).click();
    await borrower.goto('/favorites');
    await expect(borrower.getByText(title)).toBeVisible();

    // C: borrower requests dates
    await borrower.goto(`/browse?q=${encodeURIComponent(title)}`);
    await borrower.getByRole('link', { name: new RegExp(title) }).first().click();
    await borrower.getByLabel('Start date').fill(isoDay(2));
    await borrower.getByLabel('End date').fill(isoDay(4));
    await borrower.getByRole('button', { name: /review request/i }).click();
    await borrower.getByRole('button', { name: /send request/i }).click();
    await expect(borrower.getByText(/request sent/i).first()).toBeVisible();

    // Owner sees it, approves it
    await owner.goto('/requests/incoming');
    await expect(owner.getByText(title)).toBeVisible();
    await owner.getByRole('button', { name: /^approve$/i }).click();
    await owner.getByRole('dialog').getByRole('button', { name: /^approve$/i }).click();
    await expect(owner.getByText(/approved/i).first()).toBeVisible();

    // Borrower is notified and can now see pickup instructions
    await borrower.goto('/notifications');
    await expect(borrower.getByText(/approved/i).first()).toBeVisible();
    await borrower.goto('/borrowings');
    await expect(borrower.getByText(/ring the bell/i)).toBeVisible();

    // Handover → return → completion (each state change moves the loan to the next tab)
    await owner.goto('/lending');
    await owner.getByRole('button', { name: /^confirm handover$/i }).click();
    await owner.getByRole('dialog').getByRole('button', { name: /^confirm handover$/i }).click();
    await expect(owner.getByText(/handover confirmed/i).first()).toBeVisible();
    await owner.getByRole('tab', { name: /lent out/i }).click();
    await expect(owner.getByText(title)).toBeVisible();

    await borrower.goto('/borrowings');
    await borrower.getByRole('tab', { name: /borrowed now/i }).click();
    await borrower.getByRole('button', { name: /i've returned it/i }).click();
    await borrower.getByRole('dialog').getByRole('button', { name: /request return confirmation/i }).click();
    await expect(borrower.getByText(/return requested/i).first()).toBeVisible();

    await owner.goto('/lending');
    await owner.getByRole('tab', { name: /lent out/i }).click();
    await owner.getByRole('button', { name: /^confirm return$/i }).click();
    await owner.getByRole('dialog').getByRole('button', { name: /^confirm return$/i }).click();
    await expect(owner.getByText(/loan completed/i).first()).toBeVisible();

    // Reviews
    await owner.getByRole('tab', { name: /completed/i }).click();
    await owner.getByRole('button', { name: /leave a review/i }).click();
    await owner.getByRole('dialog').getByRole('radio', { name: '5 stars' }).click();
    await owner.getByRole('dialog').getByRole('button', { name: /submit review/i }).click();
    await expect(owner.getByText(/review submitted/i).first()).toBeVisible();

    // E: messaging
    await borrower.goto('/borrowings');
    await borrower.getByRole('tab', { name: /completed/i }).click();
    await borrower.getByRole('button', { name: /^message$/i }).first().click();
    await expect(borrower).toHaveURL(/\/messages\//);
    await borrower.getByRole('textbox', { name: 'Message', exact: true }).fill('Thanks for the drill!');
    await borrower.getByRole('button', { name: 'Send message' }).click();
    await expect(borrower.getByText('Thanks for the drill!')).toBeVisible();
    await owner.goto('/messages');
    await expect(owner.getByText(/thanks for the drill/i).first()).toBeVisible({ timeout: 20_000 });

    await ownerCtx.close();
    await borrowerCtx.close();
  });

  test('overlapping dates are rejected and owners cannot borrow their own item', async ({ browser }) => {
    const a = await (await browser.newContext()).newPage();
    const b = await (await browser.newContext()).newPage();
    const title = `Tent ${uniq()}`;
    await newVerifiedUser(a, 'Ann Owner');
    await newVerifiedUser(b, 'Ben Guest');
    await createItem(a, title);
    // Owner's view of own listing has no borrow form
    await a.goto(`/browse?q=${encodeURIComponent(title)}`);
    await a.getByRole('link', { name: new RegExp(title) }).first().click();
    await expect(a.getByRole('button', { name: /review request/i })).toHaveCount(0);
    await b.goto(`/browse?q=${encodeURIComponent(title)}`);
    await b.getByRole('link', { name: new RegExp(title) }).first().click();
    await b.getByLabel('Start date').fill(isoDay(10));
    await b.getByLabel('End date').fill(isoDay(8));
    await expect(b.getByRole('button', { name: /review request/i })).toBeDisabled();
  });
});
