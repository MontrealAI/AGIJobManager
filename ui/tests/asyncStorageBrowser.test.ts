import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const storage = require('@agijobmanager/async-storage-browser').default;
const root = path.resolve(__dirname, '../vendor/async-storage-browser');

beforeEach(() => localStorage.clear());
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('official AsyncStorage browser adapter', () => {
  it('preserves every vendored upstream file exactly', () => {
    const hashes: Record<string, string> = JSON.parse(fs.readFileSync(path.join(root, 'UPSTREAM_SHA256.json'), 'utf8'));
    for (const [name, digest] of Object.entries(hashes)) {
      expect(createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex')).toBe(digest);
    }
  });

  it('persists and removes the anonymous-ID operations required by the wallet SDK', async () => {
    expect(await storage.getItem('anonymous-id')).toBeNull();
    await storage.setItem('anonymous-id', 'reviewed-id');
    expect(localStorage.getItem('anonymous-id')).toBe('reviewed-id');
    expect(await storage.getItem('anonymous-id')).toBe('reviewed-id');
    await storage.removeItem('anonymous-id');
    expect(await storage.getItem('anonymous-id')).toBeNull();
  });

  it('retains upstream multi-value and nested JSON merge behavior', async () => {
    await storage.multiSet([['profile', '{"wallet":{"chain":1,"name":"first"}}'], ['other', 'untouched']]);
    await storage.mergeItem('profile', '{"wallet":{"name":"updated"}}');
    expect(JSON.parse(await storage.getItem('profile'))).toEqual({ wallet: { chain: 1, name: 'updated' } });
    expect(await storage.multiGet(['other', 'missing'])).toEqual([['other', 'untouched'], ['missing', null]]);
    await storage.multiRemove(['profile', 'other']);
    expect(await storage.getAllKeys()).toEqual([]);
  });

  it('rejects real storage failures instead of pretending that persistence succeeded', async () => {
    const failure = new DOMException('Storage access denied', 'SecurityError');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw failure; });
    const callback = vi.fn();
    await expect(storage.setItem('anonymous-id', 'value', callback)).rejects.toBe(failure);
    expect(callback).toHaveBeenCalledWith(failure);
  });

  it('maps only the exact native-package request to the reviewed browser entry', () => {
    const config = require('../next.config.js');
    const webpack = config.webpack({ resolve: { alias: { existing: 'retained' } } });
    expect(webpack.resolve.alias['@react-native-async-storage/async-storage$']).toBe(require.resolve('@agijobmanager/async-storage-browser'));
    expect(webpack.resolve.alias.existing).toBe('retained');
    expect(webpack.ignoreWarnings).toBeUndefined();
  });
});
