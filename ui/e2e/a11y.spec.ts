import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const route of ['/?scenario=default', '/jobs?scenario=default', '/jobs/3?scenario=default', '/design']) {
  test(`axe ${route}`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact || ''));
    if (serious.length) console.log('A11Y', route, serious.map((s) => s.id).join(','));
    expect(serious.length).toBe(0);
  });
}
