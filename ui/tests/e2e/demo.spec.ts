import { test, expect } from '@playwright/test';

test.setTimeout(90000);

test('dashboard to jobs to detail', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Demo mode enabled')).toBeVisible();
  await page.goto('/jobs');
  await expect(page.getByText('Jobs Ledger')).toBeVisible();
  await page.goto('/jobs/3');
  await expect(page.getByText('Sovereign ledger timeline')).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('heading', { name: /Disputed/ })).toBeVisible();
});

test('admin page renders in demo mode', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByText('Safety toggles')).toBeVisible();
});
