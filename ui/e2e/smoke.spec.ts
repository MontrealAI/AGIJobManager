import { test, expect } from '@playwright/test'

test.setTimeout(90_000)

test('dashboard renders read-only', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')
  await expect(page.locator('body')).toContainText('AGIJobManager')
})

test('jobs and admin pages render', async ({ page }) => {
  await page.goto('/jobs')
  await page.waitForLoadState('domcontentloaded')
  await expect(page.locator('body')).toContainText('Jobs')
  await page.goto('/admin')
  await expect(page.locator('body')).toContainText('Not authorized')
})
