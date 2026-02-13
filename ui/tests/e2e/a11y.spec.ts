import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const path of ['/', '/jobs?scenario=baseline', '/jobs/2?scenario=baseline', '/design']) {
  test(`axe ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact || ''));
    expect(serious).toEqual([]);
  });
}
