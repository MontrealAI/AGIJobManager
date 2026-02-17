# Security Verification Report

## Scope
- `contracts/AGIJobManager.sol`
- utility libraries in `contracts/utils/`
- ENS integration contracts in `contracts/ens/`

## Tool versions
- Foundry: `forge --version`
- Solidity compiler: `0.8.19` (Foundry profile), `0.8.23` (Truffle)
- Slither: `slither --version`

## Reproducible commands
```bash
# install dependencies
npm ci
curl -L https://foundry.paradigm.xyz | bash
~/.foundry/bin/foundryup
pip install slither-analyzer==0.11.3

# static formatting/build/tests
forge fmt --check
forge build
FOUNDRY_PROFILE=ci forge test
FOUNDRY_PROFILE=ci forge test --match-path 'forge-test/invariant/*.t.sol'

# static analysis
npm run security:slither
```

## Added verification checks

### Unit/regression checks
- ENS selector compatibility:
  - `handleHook(uint8,uint256)` == `0x1f76f7a2`
  - `jobEnsURI(uint256)` == `0x751809b4`
  - exact low-level calldata lengths `0x44` and `0x24`
- Fee-on-transfer token reverts where exact transfer semantics are required.
- ENS hook revert resilience and malformed ENS URI return-data handling.
- Reentrancy regression on completion NFT mint callback path.

### Fuzz checks
- URI boundary fuzzing for create/completion URI caps.
- Validator tie behavior at review/finalization boundary.
- Dispute bond min/max bounded behavior against payout caps.

### Handler-based invariants
The handler drives multi-actor action sequences over:
- `createJob`, `applyForJob`, `requestJobCompletion`
- `validateJob`, `disapproveJob`, `finalizeJob`
- `disputeJob`, `resolveDisputeWithCode`, `resolveStaleDispute`
- `expireJob`, `cancelJob`, `delistJob`
- owner pause toggles and settlement pause toggles
- owner `withdrawAGI` path and `rescueERC20` on non-AGI token

Invariants enforced:
1. **Solvency and withdraw safety**:
   `balanceOf(manager) >= lockedEscrow + lockedAgentBonds + lockedValidatorBonds + lockedDisputeBonds`, and `withdrawableAGI()` never reverts.
2. **Locked totals consistency**:
   on-chain aggregate locked totals match per-job sums from harness getters.
3. **Vote accounting sanity**:
   validators length equals approvals + disapprovals per job.
4. **Terminal state sanity**:
   no job can be simultaneously completed/disputed/expired in contradictory combinations.
5. **Agent active-job cap**:
   tracked `activeJobsByAgent` never exceeds `maxActiveJobsPerAgent`.
6. **No negative settlement artifacts**:
   locked totals remain non-negative and bounded across repeated settlement attempts.

## Slither triage summary
- CI runs Slither through repo-local `slither.config.json`.
- High-confidence/high-severity findings fail CI via `--fail-high`.
- Accepted-by-design areas:
  - owner/admin privilege controls (business-operated trust model),
  - pause and treasury operations gated by solvency and role checks.
- Reentrancy detector family is excluded in config because non-ETH callback-heavy pathways are intentionally covered by explicit regression tests and nonReentrant guards.

## Residual risks / assumptions
- Owner/moderator privilege is intentionally trusted (explicit business-operated model).
- Economic/governance parameter misconfiguration remains an operational risk and must be governed by runbooks.
- ENS external integrations are treated as best-effort hooks and are intentionally non-blocking for core escrow lifecycle.

## Echidna
- Not included. The Foundry handler+invariant suite already covers multi-step adversarial sequencing with deterministic CI bounds and lower runtime overhead.
