import { test, expect } from '@playwright/test';

test('dashboard/jobs/admin in demo mode', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('demo-banner')).toBeVisible();
  await page.goto('/jobs', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('jobs-table')).toBeVisible();
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('admin-not-authorized')).toBeVisible();
});
