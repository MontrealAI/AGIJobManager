import { formatUnits } from 'viem';

export const fmtAddr = (a?: string) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '—');
export const fmtToken = (v?: bigint, d = 18) =>
  v === undefined ? '—' : Number(formatUnits(v, d)).toLocaleString(undefined, { maximumFractionDigits: 4 });
export const fmtTime = (ts?: bigint | number) => (!ts ? '—' : new Date(Number(ts) * 1000).toISOString());

export const formatToken = (v?: bigint, d = 18) => (v === undefined ? '—' : `${fmtToken(v, d)} AGI`);
export const shortAddress = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—');
export const formatTimestamp = fmtTime;
