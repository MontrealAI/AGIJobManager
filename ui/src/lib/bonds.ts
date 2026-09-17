export function estimateDisputeBond(payout: bigint) {
  if (payout < 0n) throw new Error('USDC payout cannot be negative.');
  let bond = (payout * 50n) / 10000n;
  if (bond < 1000000n) bond = 1000000n;
  if (bond > 200000000n) bond = 200000000n;
  return bond > payout ? payout : bond;
}
