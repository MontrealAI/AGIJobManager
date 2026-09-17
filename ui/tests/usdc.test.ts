import { describe, it, expect, vi } from 'vitest';
import { verifyUSDCDeployment, assertUSDCWriteTarget, USDC_ADDRESSES } from '../src/lib/usdc';
import { fmtToken } from '../src/lib/format';
import { estimateDisputeBond } from '../src/lib/bonds';
const manager = '0x1111111111111111111111111111111111111111';
const client = (token = USDC_ADDRESSES[1], decimals = 6, chain = 1, code = '0x6000') => ({
  getChainId: vi.fn(async () => chain), getBytecode: vi.fn(async () => code),
  readContract: vi.fn(async ({functionName}: {functionName: string}) => functionName === 'usdcToken' ? token : decimals)
});
describe('USDC transaction preflight', () => {
  it('requires a configured manager on the canonical chain with six-decimal USDC', async () => {
    await expect(verifyUSDCDeployment(client(), manager, 1)).resolves.toBe(USDC_ADDRESSES[1]);
    for (const c of [client(manager),client(undefined,18),client(undefined,6,11155111),client(undefined,6,1,'0x')]) {
      await expect(verifyUSDCDeployment(c, manager, 1)).rejects.toThrow();
    }
    await expect(verifyUSDCDeployment(client(), '0x0000000000000000000000000000000000000000', 1)).rejects.toThrow();
    await expect(verifyUSDCDeployment(client(), manager, 137)).rejects.toThrow();
  });
  it('permits only verified manager calls and USDC approvals to that manager', () => {
    assertUSDCWriteTarget(manager, manager, USDC_ADDRESSES[1], 'createJob');
    assertUSDCWriteTarget(USDC_ADDRESSES[1], manager, USDC_ADDRESSES[1], 'approve', [manager, 1n]);
    expect(() => assertUSDCWriteTarget(USDC_ADDRESSES[11155111], manager, USDC_ADDRESSES[1], 'approve', [manager,1n])).toThrow();
    expect(() => assertUSDCWriteTarget(USDC_ADDRESSES[1], manager, USDC_ADDRESSES[1], 'approve', [USDC_ADDRESSES[1],1n])).toThrow();
  });
  it('formats every micro-USDC exactly without floating point rounding', () => {
    expect(fmtToken(1n)).toBe('0.000001');
    expect(fmtToken(9007199254740993123456n)).toBe('9,007,199,254,740,993.123456');
    expect(() => fmtToken(1n,18)).toThrow();
    expect(estimateDisputeBond(1n)).toBe(1n);
    expect(estimateDisputeBond(100000000n)).toBe(1000000n);
    expect(estimateDisputeBond(100000000000n)).toBe(200000000n);
  });
});
