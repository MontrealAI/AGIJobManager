import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('a11y audit dashboard', async ({ page }) => {
  await page.goto('/?scenario=open');
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact || ''));
  expect(serious).toEqual([]);
});
