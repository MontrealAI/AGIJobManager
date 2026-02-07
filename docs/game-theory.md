# Game‑theoretic incentives & optimal operation (AGIJobManager)

This document explains **how incentives actually work** in the current contract, and how to run the system so the equilibrium is **live, cheap, and predictable** under the **explicit trust model** used here. It is intentionally **not** a “trustless court” narrative. For the exact on‑chain flow, see the contract behavior guide and interface reference.

**Primary references**:
- Contract behavior summary: [`docs/contract-behavior.md`](contract-behavior.md)
- Operator parameters: [`docs/ParameterSafety.md`](ParameterSafety.md) and [`docs/ops/parameter-safety.md`](ops/parameter-safety.md)
- Validator workflow: [`docs/validator-guide.md`](validator-guide.md)
- Trust model overview: [`docs/trust-model-and-security-overview.md`](trust-model-and-security-overview.md)

---

## A. What “game‑theoretically optimal” means for this repository

**Optimal** in this context means: the permissioned validator club + moderator backstop produces **liveness** (jobs settle), **priced deviation** (misbehavior is costly), **predictable turnout** (validators reliably vote), a **predictable moderator backstop** (disputes resolve on time), and **cheap operations** (minimal overhead per job), while honoring the **owner‑operated escrow** trust model.

**Failures that matter (explicitly):**
- **Deadlocks**: escrow stuck because thresholds cannot be reached.
- **Hold‑up**: parties strategically delay settlement for leverage.
- **Validator abstention equilibria**: validators skip voting because expected value is negative or unclear.
- **Low‑participation capture**: a tiny number of votes decides outcomes when more participation is expected.
- **Dispute spam**: disputes used to delay or raise costs.
- **Job capture / over‑commitment**: agents accept too many jobs or low‑quality jobs because penalties are weak.

**Liveness guarantee**: non‑disputed jobs can always be finalized after `completionReviewPeriod` by anyone; disputed jobs rely on **moderators** (or the owner after `disputeReviewPeriod`) to settle. Validator voting ends at `completionReviewPeriod`, and once a dispute is opened, validator votes no longer advance settlement.

This contract **does not** aim for censorship resistance, privacy, or fully decentralized governance. Instead, it optimizes for **business‑run escrow with a permissioned validator club** and a **trusted moderator/owner backstop**.

---

## B. Roles, objectives, actions, and risks

Below, each role’s **goals**, **available actions**, **risks**, and **information** are listed with explicit function references.

### Employer
- **Wants**: verifiable delivery, predictable settlement, and refund on non‑delivery.
- **Actions (on‑chain)**: `createJob`, `cancelJob`, `disputeJob`, `finalizeJob` (anyone), receive NFT on completion.
- **Risks**:
  - Escrow is locked until settlement.
  - If validators/agent are inactive, settlement can still happen after `completionReviewPeriod` (see finalize rules).
- **Information**:
  - On‑chain: `jobSpecURI`, `jobCompletionURI`, vote counts, dispute state, and ENS job page records (if used).
  - Off‑chain: actual deliverables, private artifacts, and any evidence linked from IPFS or other content stores.

### Agent
- **Wants**: get paid quickly, preserve reputation, and minimize bond loss.
- **Actions**: `applyForJob` (posts bond, snapshots payout), `requestJobCompletion`, `finalizeJob` (anyone).
- **Risks**:
  - **Agent bond** posted at apply time (from `agentBondBps`, `agentBond`, `agentBondMax`), with a **duration‑scaled add‑on** when `jobDurationLimit` is set.
  - Bond is slashed to employer on employer‑win outcomes.
  - Missed deadline → `expireJob` slashes bond and refunds employer.
- **Information**:
  - On‑chain: job payout, duration, thresholds, review window, and eligibility rules.
  - Off‑chain: deliverables and proof of completion linked in metadata.

### Validator (permissioned club)
- **Wants**: earn rewards, preserve reputation, avoid slashing.
- **Actions**: `validateJob` or `disapproveJob` (each posts a bond), `finalizeJob` (anyone).
- **Risks**:
  - **Validator bond** per vote (from `validatorBondBps`, `validatorBondMin`, `validatorBondMax`).
  - **Slashing** on incorrect side (`validatorSlashBps`).
  - Abstaining can reduce rewards but avoid risk.
- **Opt‑in reality**: eligibility is permissioned (allowlist, Merkle proof, or ENS ownership). Validators opt‑in **per job** by choosing to vote within `completionReviewPeriod`. Once a job is disputed, validator votes no longer change settlement.
- **Information**:
  - On‑chain: `jobSpecURI`, `jobCompletionURI`, vote counts, review windows, and any ENS job page links.
  - Off‑chain: evidence and artifacts linked in metadata (often IPFS CIDs).

### Moderator / Owner
- **Wants**: restore liveness, resolve disputes, protect system integrity.
- **Actions**:
  - Moderators: `resolveDisputeWithCode` (or legacy `resolveDispute`).
  - Owner: `pause`, `unpause`, parameter updates, allowlist management, `resolveStaleDispute` after `disputeReviewPeriod`.
- **Risks**:
  - Centralized authority; operator errors can bias outcomes.
  - Reputation/credibility risk if decisions appear arbitrary.
- **Information**:
  - On‑chain: full job state, votes, disputes.
  - Off‑chain: dispute evidence, comms logs.

**Metadata + ENS/IPFS flow (cross‑cutting)**
- `jobSpecURI` and `jobCompletionURI` are the on‑chain anchors for evidence. They typically point to IPFS (or another content‑addressed store). If a completion URI has no scheme, the contract prefixes `baseIpfsUrl` for the NFT token URI.
- ENS job pages, if used, should link to the same spec/completion URIs so validators can independently verify deliverables.

*Operator incentive note: clear, content‑addressed metadata reduces validator abstention and dispute load.*
---

## C. Lifecycle map with incentive commentary

### Economics snapshot (payouts + bonds)
- **Escrow payout split**: on agent wins, the payout is allocated between the agent payout (snapshotted at `applyForJob`) and the validator reward budget (`validationRewardPercentage`). If no validators participate, the validator budget is returned to the employer.
- **Agent bond**: posted at `applyForJob` using `agentBondBps` with `agentBond`/`agentBondMax` caps; **scaled upward by duration** when `jobDurationLimit` is set; returned on agent wins and forfeited to the employer on employer wins or expiry.
- **Validator bond + slashing**: posted per vote (`validatorBondBps` with min/max caps); correct‑side validators earn rewards and get bond back, incorrect‑side validators are slashed by `validatorSlashBps`.
- **Dispute bond**: posted by the disputant in `disputeJob` (bounded by `DISPUTE_BOND_BPS/MIN/MAX`); paid to the winning side when the dispute resolves.
- **Employer refunds**: if validators participated and the employer wins, the refund is reduced by the validator reward pool (validators still get paid).

**Example (numbers):** with a 1,000 AGI payout, a 80% agent payout tier, and a 5% validator reward percentage, the agent receives 800 AGI, the validator pool is 50 AGI split across validators who voted with the final outcome, and any remainder stays in the contract balance (withdrawable only under the `withdrawableAGI()` rules).

Below is the **real settlement path** with incentives at each step. For contract‑accurate rules, see [`contract-behavior.md`](contract-behavior.md).

1) **`createJob` (Employer)**
   - Escrow is funded immediately; this is the employer’s **costly** move.
   - **Best response**: set realistic duration and clear deliverables to reduce disputes.

2) **`applyForJob` (Agent)**
   - Agent posts a bond and locks the payout tier at this moment; bond + effort is the agent’s **costly** move.
   - **Best response**: accept only jobs where expected value exceeds bond + opportunity cost.

3) **`requestJobCompletion` (Agent)**
   - Stores `jobCompletionURI`; enables validation and starts the `completionReviewPeriod`.
   - **Best response**: submit complete, verifiable evidence; missing/weak evidence invites disapproval or disputes.

4) **`validateJob` / `disapproveJob` (Validators)**
   - Validators bond per vote; correct votes are rewarded, incorrect are slashed.
   - **Best response**: vote if evidence is clear; abstain or escalate if evidence is missing.

5) **`disputeJob` (Employer or Agent)**
   - Requires a dispute bond; freezes validator votes once disputed.
   - **Best response**: use only for genuine disagreements; disputes are costly and delay payouts.

6) **`finalizeJob` (Anyone)**
   - After `completionReviewPeriod`, settlement is deterministic:
     - **0 votes** → agent wins **without reputation** (no‑vote liveness).
     - **Under quorum or tie** → job is forced into dispute.
     - **More approvals** → agent wins.
     - **More disapprovals** → employer refund.
   - **Best response**: if you want a say, vote before the review window ends.

7) **`resolveDisputeWithCode` / `resolveStaleDispute` (Moderator/Owner)**
   - Moderator decides outcome; owner can resolve stale disputes after `disputeReviewPeriod`.
   - **Best response**: moderators should resolve quickly; owners use stale resolution only for recovery.

8) **Settlement & NFT mint**
   - Payouts, bonds, slashing, validator rewards, and job NFT issuance happen on completion.
   - **Best response**: parties should assume settlement is final; reputation updates follow payout.

**Lifecycle order (contract‑accurate sequence)**:
`createJob` → `applyForJob` → `requestJobCompletion` → `validateJob`/`disapproveJob`
→ `disputeJob` (optional) → `finalizeJob` → `resolveDisputeWithCode`/`resolveStaleDispute`
→ settle payouts/bonds → mint NFT. Each transition is cheap to call but **costly in bonded risk** for the acting party.

---

## D. Cheap deviation strategies (status + mitigation)

| Strategy | Who benefits | How it works here | Status | Operator best practice |
| --- | --- | --- | --- | --- |
| **Settlement stalling / hold‑up** | Employer or agent | Delay `requestJobCompletion`, or delay finalization to gain leverage. | **Priced**: `completionReviewPeriod` + liveness rules reduce deadlocks, but delays still possible. | Enforce SLAs; auto‑monitor for completion requests and call `finalizeJob` on schedule. |
| **Validator abstention equilibrium** | Validators | Avoid voting to dodge bond risk if evidence is unclear. | **Still possible**: abstention is rational when evidence is thin; no‑vote liveness still pays the agent but yields **no validator rewards**. | Require minimum response SLAs and evidence standards; rotate validators; clarify abstention reasons. |
| **Low‑participation capture** | Small voting minority | A few votes decide outcomes if quorum is met by 1–2 validators. | **Mitigated**: `voteQuorum` forces dispute under low participation, but capture is **still possible** when quorum is set too low. | Keep `voteQuorum` aligned with expected turnout; audit 1–2 vote outcomes. |
| **Dispute spam / delay weapon** | Disputant | Use `disputeJob` to delay settlement. | **Priced** by dispute bond; moderators can resolve quickly. | Enforce dispute‑filing policy; require evidence checklist; fast‑track frivolous disputes. |
| **Job capture / over‑commitment** | Agents | Accept too many jobs if penalties are weak. | **Priced** by agent bond + expiry slashing. | Monitor agent throughput; cap concurrent jobs off‑chain if needed. |
| **Bribery / herding** | Third parties | Public vote counts + transparent evidence can sway votes. | **Still possible**: votes are public and immediate. | Use validator rotation, audit trails, and post‑vote reviews; consider future commit‑reveal. |

**Zero‑vote stalling status**: addressed by the **no‑vote liveness** rule—after `completionReviewPeriod`, `finalizeJob` settles in favor of the agent **without reputation** if no votes were cast.

**Prior critique checklist (explicit):**
- **Zero‑vote stalling**: fixed via the no‑vote liveness rule; settlement no longer requires validator participation.
- **Rational validator abstention**: still possible when evidence is weak; mitigated by SLA expectations, clear metadata standards, and rotating validators.
- **Low‑participation capture**: possible when `voteQuorum` is too low; mitigated by quorum tuning and auditing 1–2 vote outcomes.

---

## E. Parameter tuning playbook (operator guide)

These knobs are **operator tools** for shaping incentives. Always cross‑check with [`ParameterSafety.md`](ParameterSafety.md).

### Core thresholds
- **`requiredValidatorApprovals` / `requiredValidatorDisapprovals`**
  - **Small vetted club default**: approvals 2–3, disapprovals 1–2, **sum <= 50**.
  - **If participation drops**: lower approvals or add validators.
  - **If disputes spike / bribery risk rises**: raise approvals and `voteQuorum` modestly.
- **`voteQuorum`**
  - **Small vetted club default**: 2–3 total votes.
  - **If low‑participation capture is a concern**: raise it, but only if validator turnout can reliably meet it.
- **`challengePeriodAfterApproval`**
  - **Small vetted club default**: short (hours) to allow rapid finalization while permitting last‑minute disapprovals.
  - **If bribery risk rises**: lengthen slightly to give time for counter‑votes.

### Review windows
- **`completionReviewPeriod`**
  - **Default**: 24h–7d for human review.
  - **If payouts are too slow**: shorten, but maintain enough time for validator response.
- **`disputeReviewPeriod`**
  - **Default**: 7d–30d for moderator response.
  - **If moderators are slow**: lengthen; if disputes deadlock, shorten cautiously.

### Bonds and slashing
- **Validator bond + `validatorSlashBps`**
  - **Default**: bond large enough to matter, slash enough to deter negligent votes.
  - **If bribery risk rises**: increase bond or slash rate to raise deviation cost.
- **Agent bond (`agentBondBps` / `agentBond` / `agentBondMax`)**
  - **Default**: bond sized to cover expected coordination cost of failure.
  - **Duration scaling**: when `jobDurationLimit` is set, an extra bond add‑on scales with duration; long jobs are more expensive for agents.
  - **If agent no‑shows spike**: raise bond or lower max job duration.
- **Dispute bond (`DISPUTE_BOND_BPS/MIN/MAX`)**
  - **Default**: small but non‑trivial to discourage spam while keeping legitimate disputes affordable.
  - **If dispute spam rises**: increase dispute bond bounds in a redeploy or adopt stricter off‑chain filing rules.

### Practical “if X then Y”
- **Low turnout** → lower approval threshold **or** add validators; raise `voteQuorum` only if you can sustain turnout.
- **Frequent disputes** → tighten job spec requirements; consider raising dispute bond and validator thresholds.
- **Bribery signals** → increase validator bond, use rotation, and publicly document decisions.

---

## F. Operational policies that make equilibria good (off‑chain)

- **Validator SLA + rotation**: publish expected response times; rotate validators to reduce bribery and fatigue.
- **Explicit abstention policy**: abstain only when evidence is missing or access blocked; require a short reason.
- **Moderator response times**: define dispute triage windows and required evidence for a ruling.
- **Transparency + logs**: publish job‑level evidence checklists and decision logs (off‑chain).
- **Ambiguous jobs**: require clear acceptance criteria in `jobSpecURI`; ambiguous specs should be rejected or rewritten.

---

## G. Known limitations (be explicit)

- **No on‑chain truth oracle**: outcomes are judged by humans.
- **No commit‑reveal voting**: votes are public and can be influenced.
- **No privacy guarantees**: metadata URIs are public.
- **No censorship resistance**: owner and moderators are trusted.

This is acceptable **only** for a **business‑run escrow** with **permissioned validators** and a **moderator backstop**. **Do not assume** decentralized governance or trustless dispute resolution.

---

## H. Future improvements (docs‑only, not implemented)

These are optional upgrades, not present in the current contract:

- **Slow‑path quorum gating**: deterministic escalation rules if quorum is repeatedly missed.
- **Commit‑reveal voting**: reduce bribery and herding by hiding votes until reveal.
- **Committee assignment + EIP‑712 batches**: lower voting cost and improve accountability.
- **Active‑job caps / cooldowns**: limit agent over‑commitment and reduce tail risk.
