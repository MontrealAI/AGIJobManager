# AGI.eth member namespaces — v1.0.0

AGIJobManager uses role-specific ENS names for ordinary AGI Agent and AGI Validator membership. It accepts the configured primary and alpha roots for each role. Names identify eligible wallets; they do not establish the truth of off-chain work or the independence of two validators.

| Role | Primary namespace | Alpha namespace | Example label input |
| --- | --- | --- | --- |
| AGI Agent | `agent.agi.eth` | `alpha.agent.agi.eth` | `helper` |
| AGI Validator | `club.agi.eth` | `alpha.club.agi.eth` | `alice` |

The wider ecosystem also uses node and business names, but those names are not agent or validator credentials in this contract. Optional ENS job pages use a different root and mirror job metadata; holding or editing a job page grants no participant role.

## Prove the role from the connected wallet

For `helper.alpha.agent.agi.eth`, submit only `helper`. ENS inputs must be lowercase ASCII labels of 1–63 letters, digits or hyphens, with no dots or leading/trailing hyphen. The contract derives the node under each configured role root and checks qualifying NameWrapper ownership/approval or resolver `addr(node)` against the transaction sender. The primary and alpha roots are alternatives; inspect actual getters rather than assuming a deployment is alpha-only.

The contract preserves owner-managed `additionalAgents`/`additionalValidators` and valid role-specific Merkle proofs as explicit membership exceptions. Additional entries are checked first, then Merkle proofs, then ENS. An exception authorizes a wallet without proving ENS membership. It does not bypass blacklists, agent NFT eligibility, lifecycle requirements, limits or USDC bonds.

Agents need identity authorization and, when their job requires it, an eligible enabled AGI-type NFT. That NFT's legacy score is an eligibility indicator and does not change the successful-job payment share. Validators require their own club-role authorization; an agent name alone is insufficient.

## Complete the job lifecycle

1. Employer confirms the verified manager, canonical USDC and both recipients, approves the exact six-decimal job cost and calls `createJob`.
2. Eligible agent confirms and approves the required performance bond, then calls `applyForJob(jobId, label, proof)`. The first successful application assigns the job.
3. Agent submits the completion metadata before its assignment deadline.
4. Eligible validators review the evidence, approve their bond and cast one approval or disapproval vote during the review period.
5. An eligible finalization transaction after the relevant timers settles or opens a dispute according to contract rules. An approval vote does not itself send payment. Authorized moderators handle active disputes; the owner can resolve a stale dispute after its deadline.

Use `[]` for proofs on the ENS route. A Merkle exception requires the real proof for the current role root and sender. Follow the [full walkthrough](../user-guide/happy-path.md) for deadlines, cancellation, expiry, refunds and bond accounting.

## Owner controls and preservation

The owner may update the ENS Registry, NameWrapper and four roots only before `lockIdentityConfiguration()` and with every escrow/bond reserve zero. The optional job-page pointer is also blocked by that lock. Additional lists and Merkle roots remain owner-managed after locking; the lock does not force an ENS-only policy. Ownership itself requires proposal and acceptance.

Use `pauseIntake()` to stop new jobs while safe existing work settles, or `pauseAll()` for an incident affecting funds. The owner cannot withdraw escrow or bonds as surplus, replace immutable USDC, or alter the fixed 30%/10% shares. See [owner controls](../OWNER_CONTROLS.md).

A fresh USDC manager must preserve the original mainnet manager, its original-token obligations and existing ENS wiring. New job IDs restart at zero, so new optional job pages need a separate helper and dedicated root. Follow the [cutover plan](../qualification/USDC_CUTOVER.md), not an assumed in-place migration.

## Check a rejection

Inspect the intended manager, chain, sender, role roots, label and current wrapper/resolver authority. Then check blacklists, agent NFT eligibility, active-job limits, job state, allowance and balances. Revoked membership affects future role checks; a prior successful action does not establish current authority.

See the [quickstart](AGI_ETH_NAMESPACE_ALPHA_QUICKSTART.md), [exact checks](ENS_IDENTITY_GATING.md), [FAQ](FAQ.md), and [testing scope](TESTING.md). A fork rehearsal uses local transactions and cannot prove production signing access or operational independence.
