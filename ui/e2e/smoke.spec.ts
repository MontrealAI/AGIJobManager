import { test, expect } from '@playwright/test';

test.setTimeout(120000);

test('navigates key pages', async ({ page }) => {
  await page.goto('/?scenario=edge', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Sovereign Ops Console')).toBeVisible();

  await page.goto('/jobs?scenario=edge', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Jobs Ledger')).toBeVisible();

  await page.goto('/jobs/3?scenario=edge', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/jobs\/3\?scenario=edge/);

  await page.goto('/admin?scenario=edge', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Not authorized')).toBeVisible();

  await page.goto('/design', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Design System Gallery')).toBeVisible();
});
