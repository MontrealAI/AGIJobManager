import { test, expect } from '@playwright/test';

test.setTimeout(60000);

test('dashboard to jobs to detail flow', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Sovereign Ops Console')).toBeVisible();
  await page.goto('/jobs');
  await expect(page.getByText('Filter by jobId')).toBeVisible();
  const res = await page.goto('/jobs/3');
  expect(res?.ok()).toBeTruthy();
  const body = await page.locator('body').innerText();
  expect(/Job #3|Loading/.test(body)).toBeTruthy();
});

test('degraded rpc banner', async ({ page }) => {
  await page.goto('/?degraded=1');
  await expect(page.getByText('Degraded RPC')).toBeVisible();
  await expect(page.getByText('Retry')).toBeVisible();
});
