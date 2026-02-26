import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('build-ipfs hash router generation', () => {
  const scriptPath = path.resolve(__dirname, '../scripts/build-ipfs.mjs');
  const source = fs.readFileSync(scriptPath, 'utf8');

  it('keeps navigateHashRoute scoped to routePath/mode inputs', () => {
    const match = source.match(/const navigateHashRoute = \(routePath, mode\) => \{([\s\S]*?)\n  \};/);
    expect(match, 'navigateHashRoute function must be present').toBeTruthy();

    const body = match?.[1] ?? '';
    expect(body).not.toMatch(/\brawHash\b/);
    expect(body).toMatch(/if \(mode === 'replace'\)/);
    expect(body).toMatch(/rawReplaceState\(history\.state, '', pathUrl\)/);
    expect(body).toMatch(/rawPushState\(history\.state, '', pathUrl\)/);
  });

  it('guards rawHash in hashchange handler only', () => {
    expect(source).toMatch(/window\.addEventListener\('hashchange', \(\) => \{\s*const rawHash = window\.location\.hash \|\| '';\s*if \(!rawHash\.startsWith\('#\/'\)\) return;/s);
  });
});
