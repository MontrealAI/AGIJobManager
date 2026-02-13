import { test, expect } from '@playwright/test'

for (const route of ['/', '/jobs', '/jobs/0', '/admin']) {
  test(`route ${route} renders`, async ({ page }) => {
    await page.goto(route)
    await expect(page.locator('body')).toBeVisible()
  })
}
