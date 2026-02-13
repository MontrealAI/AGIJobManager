import { test, expect } from '@playwright/test';

test('navigates key pages in demo mode', async ({ page }) => {
  await page.goto('/?scenario=default');
  await expect(page.getByText('Demo mode enabled: writes disabled.')).toBeVisible();
  await page.goto('/jobs?scenario=default');
  await expect(page.getByRole('table')).toBeVisible();
  await page.goto('/jobs/3?scenario=default');
  await expect(page.getByText('Blocked non-allowlisted scheme.')).toBeVisible();
  await expect(page.locator('a[aria-disabled="true"]').first()).toBeVisible();
  await page.goto('/admin?scenario=default');
  await expect(page.getByText(/Not authorized/)).toBeVisible();
  await page.goto('/design');
  await expect(page.getByText('Design system gallery')).toBeVisible();
});

test('csv export string is deterministic', async ({ page }) => {
  await page.goto('/jobs?scenario=default');
  const csv = await page.getByTestId('csv-output').innerText();
  expect(csv).toContain('jobId,status,payout,employer,agent,nextDeadline');
  expect(csv).toContain('0,Open');
});
