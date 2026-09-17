import { test, expect } from '@playwright/test';

test('security headers', async ({ request }) => {
  const res = await request.get('http://127.0.0.1:3010/');
  expect(res.headers()['content-security-policy']).toBeTruthy();
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
  expect(res.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(res.headers()['permissions-policy']).toContain('camera=()');
  expect(res.headers()['x-frame-options']).toBe('DENY');
  const policy = res.headers()['content-security-policy'];
  const nonce = policy.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toBeTruthy();
  expect(policy).toContain("'strict-dynamic'");
  expect(policy.split(';').find((part) => part.trim().startsWith('script-src'))).not.toContain("'unsafe-inline'");
  expect(policy).not.toContain("'unsafe-eval'");
  const html = await res.text();
  expect(html).toContain(`nonce="${nonce}"`);
  const next = await request.get('/');
  expect(next.headers()['content-security-policy']).not.toContain(`'nonce-${nonce}'`);
});

test('the app hydrates while untrusted inline scripts stay blocked', async ({ page }) => {
  // Model injected HTML, not a script created by already-trusted runtime code.
  await page.route('**/jobs', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      '<body>',
      '<body><script>document.documentElement.dataset.untrustedScript = "ran"</script>'
    );
    await route.fulfill({ response, body });
  });
  await page.goto('/jobs');
  await expect(page.locator('header nav').first()).toBeVisible();
  await expect(page.locator('table')).toBeVisible();
  const injectedRan = await page.evaluate(() => document.documentElement.dataset.untrustedScript);
  expect(injectedRan).toBeUndefined();
});
