import { expect, test } from '@playwright/test';

test('dashboard renders read-only', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Sovereign Ops Console/i })).toBeVisible();
});

test('jobs list renders', async ({ page }) => {
  await page.goto('/jobs');
  await expect(page.locator('table')).toBeVisible();
});

test('admin unauthorized', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByText('Connect the current owner wallet to view this dashboard.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download the USDC console' })).toBeVisible();
});


test('advanced console renders', async ({ page }) => {
  await page.goto('/advanced');
  await expect(page.getByTestId('advanced-console')).toBeVisible();
});
