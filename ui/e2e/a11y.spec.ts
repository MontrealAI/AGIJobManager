import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.setTimeout(90000);

for (const p of ['/', '/jobs', '/jobs/2', '/design']) {
  test(`axe ${p}`, async ({ page }) => {
    await page.goto(`${p}?scenario=baseline`, { waitUntil: 'networkidle' });
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact || ''));
    expect(serious).toEqual([]);
  });
}
