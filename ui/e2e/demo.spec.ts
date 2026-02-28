import { test, expect, type Page } from '@playwright/test';

test.setTimeout(120000);

async function clickPrimaryNav(page: Page, href: string) {
  const link = page.locator(`header nav a[href="${href}"]`).first();
  await expect(link).toBeVisible();
  await link.click();
}

test('core pages render in demo mode', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Demo mode enabled')).toBeVisible();
  await page.goto('/jobs');
  await expect(page).toHaveURL(/\/jobs$/);
  await page.goto('/identity');
  await expect(page).toHaveURL(/\/identity$/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/design');
  await expect(page).toHaveURL(/\/design$/);
  await page.goto('/demo');
  await expect(page).toHaveURL(/\/demo$/);
});

test('top navigation tabs change route content', async ({ page }) => {
  await page.goto('/');

  await clickPrimaryNav(page, '/jobs');
  await expect(page).toHaveURL(/\/jobs$/);

  await page.goto('/');
  await clickPrimaryNav(page, '/identity');
  await expect(page).toHaveURL(/\/identity$/);

  await page.goto('/');
  await clickPrimaryNav(page, '/deployment');
  await expect(page).toHaveURL(/\/deployment$/);
});

test('design route renders gallery heading', async ({ page }) => {
  await page.goto('/design');
  await expect(page.getByText('Design System Gallery')).toBeVisible();
});

test('demo route renders scenario gallery heading', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.getByText('Demo scenario gallery')).toBeVisible();
});

test('csv export text present', async ({ page }) => {
  await page.goto('/jobs');
  await expect(page.getByTestId('csv-output')).toContainText('jobId,status,payout,employer,agent');
});
