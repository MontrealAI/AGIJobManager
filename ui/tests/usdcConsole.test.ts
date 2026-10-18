import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DeploymentPage from '../src/app/deployment/page';
import { LATEST_REPORTED_MAINNET_INSTANCE as latest } from '../src/generated/deployments';
const html = fs.readFileSync(path.resolve(__dirname, '../agijobmanager-usdc.html'), 'utf8');
describe('USDC standalone console boot', () => {
  it('presents the latest record before the separate historical instance without wallet controls', () => {
    const dom = new JSDOM(html);
    try {
      const panel = dom.window.document.querySelector('#latestReportedDeployment')?.parentElement;
      expect(panel?.textContent).toContain(latest.recordDate);
      expect(panel?.textContent).toContain(latest.manager);
      expect(panel?.textContent).toContain('6 Exact Match and 3 retained Similar Match');
      expect(panel?.textContent).toContain('not live state');
      expect(panel?.querySelector(`a[href="${latest.managerCodeUrl}"]`)).not.toBeNull();
      expect(panel?.querySelector(`a[href$="${latest.recordPath}"]`)).not.toBeNull();
      const evidenceBase = 'https://github.com/MontrealAI/AGIJobManager/blob/d5d4ad93f00a3dfe6439b0f32edb1a2fcf70e0c2/';
      expect(latest.evidenceRevision).toBe('d5d4ad93f00a3dfe6439b0f32edb1a2fcf70e0c2');
      expect(panel?.querySelector(`a[href="${evidenceBase}${latest.recordPath}"]`)).not.toBeNull();
      expect(panel?.querySelector(`a[href="${evidenceBase}${latest.guidePath}"]`)).not.toBeNull();
      expect(panel?.nextElementSibling?.querySelector(`a[href="${evidenceBase}docs/deployments/MAINNET_USDC_2026-10-10.md"]`)).not.toBeNull();
      expect(panel?.querySelector('input, button, script, [onclick]')).toBeNull();
      expect(panel?.nextElementSibling?.querySelector('summary')?.textContent).toContain('Historical instance · October 10, 2026');
      expect(panel?.nextElementSibling?.textContent).toContain('historical helper is not attached to the latest Manager');
    } finally { dom.window.close(); }
  });
  it('renders the Next deployment page as read-only recorded evidence with blank transaction defaults', () => {
    const dom = new JSDOM(renderToStaticMarkup(createElement(DeploymentPage)));
    try {
      const panel = dom.window.document.querySelector('[aria-labelledby="latest-reported-instance"]');
      expect(panel?.textContent).toContain(latest.manager);
      expect(panel?.textContent).toContain(latest.recordDate);
      expect(panel?.textContent).toContain('Recorded evidence, not live state');
      expect(panel?.querySelector(`a[href="${latest.managerCodeUrl}"]`)).not.toBeNull();
      const evidenceBase = 'https://github.com/MontrealAI/AGIJobManager/blob/d5d4ad93f00a3dfe6439b0f32edb1a2fcf70e0c2/';
      expect(panel?.querySelector(`a[href="${evidenceBase}${latest.recordPath}"]`)).not.toBeNull();
      expect(panel?.querySelector(`a[href="${evidenceBase}${latest.guidePath}"]`)).not.toBeNull();
      expect(dom.window.document.querySelector(`a[href="${evidenceBase}docs/deployments/MAINNET_USDC_2026-10-10.md"]`)).not.toBeNull();
      expect(dom.window.document.body.textContent).toContain('Historical instance · October 10, 2026');
      expect(dom.window.document.body.textContent).toContain('No manager selected');
      expect(dom.window.document.body.textContent).toContain('No helper selected');
      expect(dom.window.document.querySelector('input, button, script, [onclick]')).toBeNull();
    } finally { dom.window.close(); }
  });
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
  it('keeps the operator-selected stored target instead of replacing it with a reported address', async () => {
    const dom = new JSDOM(html, {url:'https://example.test/usdc.html',runScripts:'outside-only',pretendToBeVisual:true});
    const chosen = '0x1111111111111111111111111111111111111111';
    try {
      dom.window.localStorage.setItem('agijobmanager_usdc_v096_manager', chosen);
      dom.window.fetch = async () => { throw new Error('Offline test'); };
      const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=> !/\bsrc\s*=/.test(m[1]));
      for (const script of scripts) new vm.Script(script[2]).runInContext(dom.getInternalVMContext());
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(dom.window.document.querySelector<HTMLInputElement>('#usdcManagerAddress')?.value).toBe(chosen);
      expect(dom.window.localStorage.getItem('agijobmanager_usdc_v096_manager')).toBe(chosen);
      expect(dom.window.document.querySelector<HTMLButtonElement>('#createJobBtn')?.disabled).toBe(true);
    } finally { dom.window.close(); }
  });
});
