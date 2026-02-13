import { test, expect } from '@playwright/test';

test('demo dashboard renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('demo-banner')).toBeVisible();
  await expect(page.getByText(/Institutional AGIJobManager Console/i)).toBeVisible();
});

test('admin unauthorized in read-only context', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByText(/Not authorized/i)).toBeVisible();
});
