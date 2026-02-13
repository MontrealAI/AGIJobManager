import { test, expect } from '@playwright/test';

test('dashboard renders read-only', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('ASI Sovereign Operations Console')).toBeVisible();
});

test('jobs list renders', async ({ page }) => {
  await page.goto('/jobs');
  await expect(page.getByText('Jobs')).toBeVisible();
});

test('job detail renders', async ({ page }) => {
  await page.goto('/jobs/1');
  await expect(page.getByText('Job #1')).toBeVisible();
});

test('admin unauthorized for non-owner', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByText('Not authorized')).toBeVisible();
});
