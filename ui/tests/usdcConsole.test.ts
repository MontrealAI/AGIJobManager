import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
const html = fs.readFileSync(path.resolve(__dirname, '../agijobmanager-usdc.html'), 'utf8');
describe('USDC standalone console boot', () => {
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
