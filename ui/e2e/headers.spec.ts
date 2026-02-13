import { test, expect } from '@playwright/test';

test('security headers', async ({ request }) => {
  const res = await request.get('http://127.0.0.1:3010/');
  expect(res.headers()['content-security-policy']).toBeTruthy();
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
  expect(res.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(res.headers()['permissions-policy']).toContain('camera=()');
  expect(res.headers()['x-frame-options']).toBe('DENY');
});
