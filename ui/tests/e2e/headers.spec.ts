import { test, expect } from '@playwright/test';

test('security headers are present', async ({ request }) => {
  const res = await request.get('/');
  expect(res.headers()['content-security-policy']).toContain("default-src 'self'");
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
  expect(res.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(res.headers()['permissions-policy']).toContain('camera=()');
  expect(res.headers()['x-frame-options']).toBe('DENY');
});
