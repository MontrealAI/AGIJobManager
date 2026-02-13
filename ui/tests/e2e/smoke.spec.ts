import { test, expect } from '@playwright/test'

for (const path of ['/', '/jobs', '/jobs/0', '/admin']) {
  test(`route ${path} responds`, async ({ page }) => {
    const res = await page.goto(`http://127.0.0.1:3000${path}`)
    expect(res?.ok()).toBeTruthy()
  })
}
