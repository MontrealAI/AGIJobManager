# Identity wiring lock & treasury pause model

This note summarizes the **operational trust model** for AGIJobManager: the owner operates the marketplace, but escrow funds remain protected and identity wiring can be permanently frozen.

## Marketplace operations model

AGIJobManager is a **business‑operated marketplace**. The owner sets parameters, manages allowlists/blacklists, and can pause/unpause operations. This is **not** a DAO or permissionless court; moderators and the owner have explicit operational authority.

## Escrow protection invariant

All job payouts are escrowed on-chain and tracked in `lockedEscrow`. The owner can **never** withdraw escrowed funds:

```
withdrawableAGI = tokenBalance - lockedEscrow
```

If `withdrawableAGI` is insufficient, `withdrawAGI` reverts. This keeps employer‑funded escrow protected even during incidents.

## Treasury definition

**Treasury** is any non‑escrow AGI held by the contract, including:

- leftover remainder from settlement math,
- rounding dust,
- direct transfers to the contract,
- reward‑pool contributions.

Treasury funds are owner‑withdrawable **only while paused**, and only up to `withdrawableAGI`.

## Pause semantics (brief pause for treasury withdrawals)

Pausing is intended as a **brief incident/withdrawal window** without trapping users. While paused:

**Blocked actions**
- New job creation and assignment (`createJob`, `applyForJob`).
- Validation flow (`validateJob`, `disapproveJob`, `disputeJob`).
- Marketplace listing and purchase (`listNFT`, `purchaseNFT`).
- Reward‑pool contributions.

**Still allowed**
- **Agent completion submission** (`requestJobCompletion`) for assigned, non‑expired, non‑completed jobs.
- **NFT delisting** by the seller (`delistNFT`).
- **Settlement exits** when their normal predicates are met: `cancelJob`, `expireJob`, `finalizeJob`.
- Owner break‑glass tools: `resolveStaleDispute` and `withdrawAGI` (treasury only).

This ensures agents can still submit completion metadata and sellers can exit listings even during a pause.

## Identity wiring lock (permanent)

The identity wiring lock **freezes only identity wiring** and does **not** freeze business operations.

### Frozen after lock
- AGI token address.
- ENS registry.
- NameWrapper.
- Root nodes (identity namespaces).

### Not frozen after lock
- Pausing/unpausing.
- Withdrawals of **non‑escrow** treasury (only when paused).
- Job settlement/payouts.
- Blacklists / allowlists (Merkle roots).
- Economic parameters (thresholds, payout settings, review periods).

Once `lockIdentityConfiguration()` is called, identity wiring is immutable forever.

## Notes on unused parameters

`additionalAgentPayoutPercentage` remains a **reserved configuration value**. It is **not used** in current payout calculations and is retained for future extensibility.

## Reward‑pool contributions

Reward‑pool contributions are treated as **treasury**. They are **owner‑withdrawable while paused** (subject to the escrow invariant).
