# Architecture

## Repository-level architecture

```text
AGI ERC20  --->  AGIJobManager (escrow + lifecycle + disputes + reputation + completion NFT)
                    |            \
                    |             \--> ERC721 completion NFTs (AGIJobs / Job)
                    |
                    +--> ENSJobPages (optional, best-effort hooks)
                             |
                             +--> ENS Registry / NameWrapper / PublicResolver

External AGIType ERC721 collections gate agent payout percentages.
```

## What the system does
- Employer escrows AGI for jobs.
- Eligible agent applies and posts agent bond.
- Agent requests completion.
- Validators vote (approve/disapprove) with validator bonds.
- Job settles by `finalizeJob`, dispute resolution, or expiration.
- Completion NFT is minted to employer on agent-win completion.
- ENS hooks can publish job records and optional ENS tokenURI mode.

## Trust model
- Owner-operated protocol with strong owner authority: pause controls, parameter tuning, allowlists, moderators, and identity wiring updates before lock.
- Moderators resolve disputes.
- Validator/agent eligibility is permissioned via additional allowlists, Merkle proofs, and ENS/NameWrapper ownership checks.
- `settlementPaused` is a separate settlement switch from OpenZeppelin pause.

## Core invariants
- Solvency check: `agiToken.balanceOf(this) >= lockedEscrow + lockedValidatorBonds + lockedAgentBonds + lockedDisputeBonds` must hold for withdrawals.
- Settlement paths must release locked balances exactly once (`_releaseEscrow`, bond settlement helpers).
- Max validators per job is bounded (`MAX_VALIDATORS_PER_JOB = 50`) to keep loops bounded.

## Key gotchas
- `lockIdentityConfiguration()` permanently freezes AGI token + ENS wiring/root updates.
- ENS hooks are best-effort; hook failures emit `EnsHookAttempted(..., success=false)` and do not revert core settlement flow.
- No-vote finalization after completion review window deterministically favors the agent (with `repEligible=false`).
