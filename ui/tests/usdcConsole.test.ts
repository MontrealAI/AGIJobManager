import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
const html = fs.readFileSync(path.resolve(__dirname, '../agijobmanager-usdc.html'), 'utf8');
describe('USDC standalone console boot', () => {
  it('previews posting-time shares and exact gross-cost wallet amounts', () => {
    const start = html.indexOf('function simulateJobSettlement(');
    const end = html.indexOf('async function fetchJobTimeline(', start);
    const context = vm.createContext({
      computeValidatorBondFromPayout: () => 0n, getNumericText: () => 0n,
      el: () => ({textContent: '1'}), getProtocolNumber: () => 1, nowSec: () => 10
    });
    vm.runInContext(html.slice(start, end), context);
    for (const [amount, rate, votes] of [[100000000n, 8, 1], [101n, 12, 1], [1n, 8, 1], [100000000n, 8, 0]]) {
      const p = BigInt(amount);
      const sim = context.simulateJobSettlement({payout: p, agentPayoutPct: 60 - Number(rate), approvals: Number(votes)});
      const reward = votes ? p * BigInt(rate) / 100n : 0n;
      expect(sim.rewardPool).toBe(reward);
      expect(sim.wallet30Amount).toBe(p * 30n / 100n);
      expect(sim.wallet10Amount).toBe(p * 10n / 100n);
      expect(sim.agentPayout + sim.wallet30Amount + sim.wallet10Amount + sim.rewardPool).toBe(p);
    }
  });
  it('boots with no legacy manager and keeps transaction controls disabled', async () => {
    const dom = new JSDOM(html, {url:'https://example.test/usdc.html',runScripts:'outside-only',pretendToBeVisual:true});
    try {
      dom.window.fetch = async () => { throw new Error('Offline test'); };
      const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=> !/\bsrc\s*=/.test(m[1]));
      for (const script of scripts) new vm.Script(script[2]).runInContext(dom.getInternalVMContext());
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(dom.window.document.querySelector<HTMLInputElement>('#usdcManagerAddress')?.value).toBe('');
      expect(dom.window.document.querySelector<HTMLButtonElement>('#createJobBtn')?.disabled).toBe(true);
      expect(dom.window.document.body.textContent).toContain('USDC');
      expect(dom.window.document.querySelector('#bridgeBtn')).toBeNull();
    } finally { dom.window.close(); }
  });
});
