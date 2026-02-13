import { formatEther } from 'viem'

export function shortAddress(address?: string) {
  if (!address) return '—'
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function formatToken(value?: bigint, symbol = 'AGI') {
  if (value === undefined) return `0 ${symbol}`
  return `${Number(formatEther(value)).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${symbol}`
}

export function formatTs(value?: bigint | number) {
  if (!value || Number(value) === 0) return '—'
  return new Date(Number(value) * 1000).toISOString()
}
