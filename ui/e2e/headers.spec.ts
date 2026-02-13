import { test, expect } from '@playwright/test';

test('security headers present', async ({ request }) => {
  const res = await request.get('/');
  expect(res.headers()['content-security-policy']).toBeTruthy();
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
  expect(res.headers()['referrer-policy']).toBeTruthy();
  expect(res.headers()['permissions-policy']).toBeTruthy();
  expect(res.headers()['x-frame-options']).toBe('DENY');
});
