import { test, expect, Page } from '@playwright/test';

test.setTimeout(120000);

async function clickTopTab(page: Page, label: string) {
  const topNav = page.locator('header nav').first();
  await expect(topNav).toBeVisible();
  await topNav.getByRole('link', { name: label, exact: true }).click();
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
  await clickTopTab(page, 'Jobs');
  await expect(page).toHaveURL(/\/jobs$/);

  await page.goto('/');
  await clickTopTab(page, 'Identity');
  await expect(page).toHaveURL(/\/identity$/);

  await page.goto('/');
  await clickTopTab(page, 'Admin');
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto('/');
  await clickTopTab(page, 'Advanced');
  await expect(page).toHaveURL(/\/advanced$/);

  await page.goto('/');
  await clickTopTab(page, 'Design');
  await expect(page).toHaveURL(/\/design$/);

  await page.goto('/');
  await clickTopTab(page, 'Deployment');
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
