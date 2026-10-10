import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/merkle/route';

afterEach(() => vi.unstubAllEnvs());
describe('unimplemented proof lookup', () => {
  it.each([undefined, 'https://example.com/proofs'])('never fabricates a successful empty proof (backend %s)', async backend => {
    vi.stubEnv('MERKLE_PROOF_SERVICE_URL', backend);
    const response = await GET(new NextRequest('https://example.com/api/merkle?kind=agent&address=0x123'));
    expect(response.status).toBe(501);
    expect(await response.json()).not.toHaveProperty('proof');
  });
  it('rejects missing parameters', async () => {
    expect((await GET(new NextRequest('https://example.com/api/merkle'))).status).toBe(400);
  });
});
