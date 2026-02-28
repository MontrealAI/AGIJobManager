import { test, expect } from '@playwright/test';

test.setTimeout(120000);

test('core pages render in demo mode', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Demo mode enabled')).toBeVisible();
  await page.goto('/jobs');
  await expect(page).toHaveURL(/\/jobs$/);
  await page.goto('/identity');
  await expect(page).toHaveURL(/\/identity$/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/design');
  await expect(page).toHaveURL(/\/design$/);
  await page.goto('/demo');
  await expect(page).toHaveURL(/\/demo$/);
});

test('top navigation tabs change route content', async ({ page }) => {
  await page.goto('/');

  const topNav = page.locator('header nav').first();
  await topNav.getByRole('link', { name: 'Jobs', exact: true }).click();
  await expect(page).toHaveURL(/\/jobs$/);

  await topNav.getByRole('link', { name: 'Identity', exact: true }).click();
  await expect(page).toHaveURL(/\/identity$/);
  await expect(page.getByRole('heading', { name: 'Identity Layer Console' })).toBeVisible();

  await topNav.getByRole('link', { name: 'Deployment', exact: true }).click();
  await expect(page).toHaveURL(/\/deployment$/);
  await expect(page.getByRole('heading', { name: 'Official Mainnet Deployment Registry' })).toBeVisible();
});

test('design route renders gallery heading', async ({ page }) => {
  await page.goto('/design');
  await expect(page.getByText('Design System Gallery')).toBeVisible();
});

test('demo route renders scenario gallery heading', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.getByText('Demo scenario gallery')).toBeVisible();
});

test('csv export text present', async ({ page }) => {
  await page.goto('/jobs');
  await expect(page.getByTestId('csv-output')).toContainText('jobId,status,payout,employer,agent');
});
