# AGIJobManager security considerations — v0.9.2

Read the [security model](SECURITY_MODEL.md), [trust model](trust-model-and-security-overview.md), [dependency scope](DEPENDENCY_SECURITY.md) and [source-specific verification report](../SECURITY_VERIFICATION_REPORT.md) together. A passing automated suite is not an independent audit or a guarantee that no vulnerability remains.

## Contract controls

- State guards reject nonexistent jobs, repeat votes and repeated settlement. Reserved USDC includes job escrow and all three bond categories.
- Transfer helpers require successful ERC-20 calls and exact escrow/bond receipt. The supported token is native six-decimal Circle USDC, not a fee-on-transfer alternative.
- Sensitive fund-moving paths use reentrancy guards; completion-NFT callbacks and optional ENS hooks are bounded and covered by dedicated regressions.
- Settlement transfers and reserve changes are atomic. An issuer pause, blocked recipient or failed transfer reverts the whole operation and permits retry only after the cause is resolved.
- Successful settlement pays correct-side validators, fixed 30%/10% gross-cost recipients, then the agent remainder; bonds are accounted separately. [Payout specification](USDC_PAYOUT_SPLIT.md).
- Intake starts paused. Duration limits are bounded, wallet rotation requires empty reserves, ownership requires acceptance and USDC cannot be rescued or replaced.

## Human and external dependencies

The owner retains power over pauses, eligibility, moderators and stale disputes. Moderators decide disputes. Validators must assess real evidence; bonds do not prove honest judgment. A no-vote fallback favors the agent after review expiry without independent validation. ENS and metadata systems can fail or provide misleading information. Circle retains issuer powers over USDC.

The identity lock is irreversible and does not remove owner authority over other controls. Use a reviewed signing arrangement, explicit policy, monitoring and rehearsed [incident procedures](OPERATIONS/INCIDENT_RESPONSE.md). Complete [mainnet readiness](MAINNET_READINESS.md) for the actual instance before significant exposure.
