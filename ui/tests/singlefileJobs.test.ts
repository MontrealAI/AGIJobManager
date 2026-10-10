import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
const source = fs.readFileSync(path.resolve(__dirname, '../scripts/singlefile-template.html'), 'utf8');
const bootstrap = [...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('const hydrateJobs='))!;
const word = (n: bigint) => n.toString(16).padStart(64, '0');
const hash = `0x${'ab'.repeat(32)}`;
async function boot(total: bigint, failure = false) {
  const dom = new JSDOM('<html><body><main></main></body></html>', { url: 'https://example.com/agijobmanager.html#/jobs', runScripts: 'outside-only' });
  const calls: any[] = [];
  (dom.window as any).fetch = vi.fn(async (_url, options) => {
    const call = JSON.parse(options.body); calls.push(call); let result: unknown;
    if (call.method === 'eth_chainId') result = '0x1';
    else if (call.method === 'eth_getBlockByNumber') result = { hash, number: '0x64' };
    else {
      expect(call.params[1]).toEqual({ blockHash: hash, requireCanonical: true });
      if (call.params[0].data === '0x15e84af9') result = `0x${word(total)}`;
      else if (call.params[0].data === '0x8da5cb5b') result = `0x${word(1n)}`;
      else if (failure) throw new Error('unavailable core');
      else result = `0x${[1n, 2n, 1234567n, 100n, 0n, 0n, 0n, 0n, 50n].map(word).join('')}`;
    }
    return { ok: true, json: async () => ({ jsonrpc: '2.0', id: 1, result }) };
  });
  dom.window.eval(bootstrap.replace('status:"deployment-required"', 'status:"deployed"'));
  await vi.waitFor(() => expect(dom.window.document.getElementById('jobs-status')?.textContent).toMatch(/Newest|No live jobs|Failed to fetch/));
  return { dom, calls };
}
describe('IPFS dashboard live job decoding', () => {
  it('includes job zero and decodes the actual payout and addresses', async () => {
    const { dom, calls } = await boot(1n);
    expect([...dom.window.document.querySelectorAll('#jobs-ledger-body td')].map(c => c.textContent)).toEqual(['0', '1.234567', `0x${'0'.repeat(39)}1`, `0x${'0'.repeat(39)}2`]);
    expect(calls.filter(c => c.method === 'eth_call' && c.params[0].data.startsWith('0x0a0f704e'))).toHaveLength(1);
    dom.window.close();
  });
  it('keeps large IDs exact and bounds the preview to three newest jobs', async () => {
    const total = 9007199254740995n; const { dom } = await boot(total);
    expect([...dom.window.document.querySelectorAll('#jobs-ledger-body tr td:first-child')].map(c => c.textContent)).toEqual([total - 1n, total - 2n, total - 3n].map(String));
    dom.window.close();
  });
  it('fails atomically without placeholder payouts when a core read fails', async () => {
    const { dom } = await boot(2n, true);
    expect(dom.window.document.querySelectorAll('#jobs-ledger-body tr')).toHaveLength(0);
    expect(dom.window.document.getElementById('jobs-status')?.textContent).toContain('Failed to fetch');
    dom.window.close();
  });
});
