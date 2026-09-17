import { formatUnits } from 'viem';

export const fmtAddr = (a?: string) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '—');
export const fmtToken = (v?: bigint, d = 6) => {
  if (d !== 6) throw new Error('Only six-decimal USDC amounts are supported.');
  if (v === undefined) return '—';
  const [whole, fraction] = formatUnits(v < 0n ? -v : v, 6).split('.');
  return `${v < 0n ? '-' : ''}${BigInt(whole).toLocaleString()}${fraction ? '.' + fraction : ''}`;
};
export const fmtTime = (ts?: bigint | number) => (!ts ? '—' : new Date(Number(ts) * 1000).toISOString());

export const formatToken = (v?: bigint, d = 6) => (v === undefined ? '—' : `${fmtToken(v, d)} USDC`);
export const shortAddress = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—');
export const formatTimestamp = fmtTime;
