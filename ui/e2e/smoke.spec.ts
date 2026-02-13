import { test, expect } from '@playwright/test';

test('dashboard renders read-only', async ({ page }) => { await page.goto('/'); await expect(page.getByText('AGIJobManager')).toBeVisible(); });
test('jobs list renders', async ({ page }) => { await page.goto('/jobs'); await expect(page.locator('table')).toBeVisible(); });
test('admin unauthorized', async ({ page }) => { await page.goto('/admin'); await expect(page.getByText(/Not authorized/)).toBeVisible(); });
