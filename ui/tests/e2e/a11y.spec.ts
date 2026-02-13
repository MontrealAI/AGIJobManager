import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('a11y homepage', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
  expect(results.violations.filter((v) => ['critical'].includes(v.impact || '')).length).toBe(0);
});
