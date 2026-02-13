import { test, expect } from '@playwright/test';

for (const path of ['/?scenario=baseline', '/jobs?scenario=baseline', '/jobs/3?scenario=baseline', '/admin?scenario=baseline', '/design', '/demo']) {
  test(`route ${path} responds`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.ok()).toBeTruthy();
  });
}

test('safe link is disabled for blocked schemes', async ({ page }) => {
  await page.goto('/jobs/3?scenario=baseline');
  await expect(page.getByTestId('safe-link')).toHaveClass(/pointer-events-none/);
});

test('csv export includes expected columns', async ({ page }) => {
  await page.goto('/jobs?scenario=baseline');
  const csv = await page.getByTestId('csv-export').getAttribute('data-csv');
  expect(csv).toContain('id,employer,agent,payout');
});
