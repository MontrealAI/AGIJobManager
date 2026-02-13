import { test, expect } from '@playwright/test';

test.setTimeout(120000);

test('core pages render in demo mode', async ({ page }) => {
  await page.goto('/?scenario=baseline');
  await expect(page.getByText('Demo mode enabled')).toBeVisible();
  await page.goto('/jobs?scenario=baseline');
  await expect(page.getByTestId('csv-output')).toBeVisible();
  await page.goto('/admin?scenario=baseline');
  await expect(page.getByText('Safety toggles')).toBeVisible();
  await page.goto('/design');
  await expect(page.getByText('Design System Gallery')).toBeVisible();
  await page.goto('/demo');
  await expect(page.getByText('Demo scenario gallery')).toBeVisible();
});

test('degraded scenario route responds', async ({ page }) => {
  await page.goto('/?scenario=degraded-paused');
  await expect(page.getByText('Demo mode enabled')).toBeVisible();
});

test('csv export text present', async ({ page }) => {
  await page.goto('/jobs?scenario=baseline');
  await expect(page.getByTestId('csv-output')).toContainText('jobId,status,payout,employer,agent');
});
