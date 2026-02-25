import { test, expect } from '@playwright/test';

test.setTimeout(120000);

test('core pages render in demo mode', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Demo mode enabled')).toBeVisible();
  await page.goto('/jobs');
  await expect(page).toHaveURL(/\/jobs$/);
  await expect(page.getByTestId('csv-output')).toBeVisible();
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText('Not authorized')).toBeVisible();
  await page.goto('/design');
  await expect(page).toHaveURL(/\/design$/);
  await expect(page.getByRole('heading', { name: /Design System Gallery/i })).toBeVisible();
  await page.goto('/demo');
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByRole('heading', { name: /Demo scenario gallery/i })).toBeVisible();
});

test('csv export text present', async ({ page }) => {
  await page.goto('/jobs');
  await expect(page.getByTestId('csv-output')).toContainText('jobId,status,payout,employer,agent');
});
