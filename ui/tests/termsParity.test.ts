import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { expect, it } from 'vitest';

it('reproduces the immutable protocol terms without relabeling their settlement notice', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../contracts/AGIJobManager.sol'), 'utf8');
  const terms = source.split('/*', 2)[1].split('*/', 1)[0].trim();
  const html = fs.readFileSync(path.resolve(__dirname, '../agijobmanager-usdc.html'), 'utf8');
  const dom = new JSDOM(html);
  try {
    expect(dom.window.document.querySelector('.term-body')?.textContent?.trim()).toBe(terms);
  } finally {
    dom.window.close();
  }
});
