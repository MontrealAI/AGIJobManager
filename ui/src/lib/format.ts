import { formatEther } from 'viem'

export function formatToken(value: bigint, symbol = 'AGI') {
  return `${Number(formatEther(value)).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${symbol}`
}

export function shortAddress(address?: string) {
  if (!address) return '—'
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function formatTimestamp(ts?: bigint) {
  if (!ts || ts === 0n) return '—'
  return new Date(Number(ts) * 1000).toISOString()
}

export function secondsLeft(ts?: bigint, now = Math.floor(Date.now() / 1000)) {
  if (!ts || ts === 0n) return '—'
  const diff = Number(ts) - now
  if (diff <= 0) return 'elapsed'
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`
}
