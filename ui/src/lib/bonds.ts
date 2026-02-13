export function estimateDisputeBond(payout: bigint, bps: bigint = 500n) {
  return (payout * bps) / 10000n
}
