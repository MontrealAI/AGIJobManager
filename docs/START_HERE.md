# Start here — AGIJobManager v1.1.0

Before signing, verify the actual deployment operator, fees and service terms. The [legal center](LEGAL/README.md) explains publisher/owner roles, privacy and risk. The console's fresh acknowledgement is a local safeguard, not an operator agreement or regulatory clearance.


Read [what this release includes and how existing managers remain compatible](V1_RELEASE_SCOPE.md). [v1.1.0 adds read-only deployment defaults and clearer guides while retaining public-content safeguards and safer browser storage](V1_RELEASE_SCOPE.md#published-download-versus-current-source).

AGIJobManager holds a job's USDC payment until the work reaches a settlement outcome. Employers post work, eligible agents take jobs, validators assess the submitted evidence, and moderators handle disputes. The owner configures the instance and can pause it.

**This download supplies software, not a running marketplace.** A deployment operator must deploy and verify the manager, configure its owner and two recipients, arrange eligible participants, and open intake. No live manager address or recipient wallets are supplied.

AGI Agents normally qualify through a name under `agent.agi.eth` or `alpha.agent.agi.eth`; AGI Validators through `club.agi.eth` or `alpha.club.agi.eth`. The connected wallet must satisfy the configured name's NameWrapper ownership/approval or resolver-address check. Enter only the label, such as `alice`. The contract preserves owner-managed `additionalAgents`/`additionalValidators` and role-specific Merkle proofs as explicit membership exceptions; those routes are not proof of ENS membership. Agents also need a qualifying enabled NFT when the job’s posting-time NFT requirement is on. Fresh v1.1.0 managers start with that requirement disabled; owners can enable it for future jobs. These participant identity checks are separate from optional ENS job-page metadata.

## Choose your next step

| Your goal | Start with | What you need |
| --- | --- | --- |
| Post, perform or validate a job | [USDC console guide](ui/GENESIS_JOB_MAINNET_HTML_UI.md), then [participant guide](USERS.md) | A verified deployed manager, the correct wallet, USDC and ETH for gas |
| See how a real job would proceed | [Genesis artwork worked example](examples/GENESIS_JOB_TODAY.md) | Read the participant steps, cost tables, review timing and recovery branches |
| Deploy the software | [Launch checklist](LAUNCH_CHECKLIST.md), then [Hardhat guide](../hardhat/README.md) | Reviewed configuration, both recipients, intended owner and a testnet rehearsal |
| Operate an existing instance | [Owner runbook](OWNER_RUNBOOK.md) | The accepted owner wallet and verified on-chain configuration |
| Respond to a problem | [Incident response](OPERATIONS/INCIDENT_RESPONSE.md) | Manager address, chain, transaction hashes and current pause/reserve state |
| Evaluate the release | [Mainnet readiness](MAINNET_READINESS.md) and [testing](TESTING.md) | Source, release manifest, checksums and the linked CI evidence |

Download the [v1.1.0 complete package](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.1.0/AGIJobManager-v1.1.0-COMPLETE.zip) or [standalone USDC console](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.1.0/agijobmanager-usdc.html) from the repository's release page. Check its `SHA256SUMS.txt` before use. Open `agijobmanager-usdc.html` in a browser with an Ethereum wallet. It needs internet access for the integrity-pinned Web3 library, wallet/RPC communication and display resources; it is not an offline transaction application. Never enter a seed phrase or private key into the console. Public submissions must contain no added personal information, confidential material or secrets; read the [user-data rules](LEGAL/USER_DATA_RULES.md). Draft saving is explicit and unencrypted. Review each public-content confirmation before an upload or submission.

For a practical cost comparison, operators can run `npm run economics:check -- --example`, then replace its hypothetical assumptions with their own scenario. See [economics](game-theory.md).

## Understand the payment before signing

For a successful **100 USDC** job with the default 8% validator budget and qualifying approval votes:

| Paid in this order | Amount from the original job cost |
| --- | ---: |
| Correct-side validators | 8 USDC total |
| First configured wallet | 30 USDC |
| Second configured wallet | 10 USDC |
| Assigned agent | 52 USDC |

The 30% and 10% shares are fixed and included in the job cost. The owner can set the validator percentage to 1–60% for future postings; every posted job retains its rate. Bond deposits, refunds and slashing are accounted separately. Integer rounding and unallocated rewards are described in the [payout specification](USDC_PAYOUT_SPLIT.md). USDC uses six decimals; ETH is required for gas.

After the full review and any later approval challenge, finalization with no votes, insufficient participation, or a tie opens a dispute and pays nobody. Only explicit buyer acceptance or an authorized agent-win decision can pay unreviewed work; with no validators, the agent receives the 60% remainder. Voting, expiry, finalization and refunds require transactions; elapsed time alone never sends money. [See what to do if work is missing or poor](BUYER_PROTECTION.md).

## Complete one job

Need an agent credential? The console’s **Get free name + identity NFT** option (included in v1.1.0) uses `FreeTrialSubdomainRegistrarIdentity` to register both an `*.alpha.agent.agi.eth` name and a soulbound Alpha Agent Identity NFT for your connected wallet. Registration is free; Ethereum gas is separate. Validity lasts up to 30 days, capped by the parent expiry. Check the live preview: an NFT can remain visible after the credential expires. The separate ENS-only option does not create this identity NFT. Read [identity and job eligibility](guides/IDENTITY_AND_PROOFS.md#free-alpha-agent-name-and-identity-nft) before applying; buyers do not need this credential. If the owner enables this ENS root and NFT collection, these free credentials can qualify you to take jobs without an additional paid identity. Bonds and gas still apply, and payment follows successful settlement. Follow the [agent guide](roles/AGENT.md) from registration through payment.

1. **Employer:** write the scope, acceptance criteria and evidence requirements; choose a USDC cost and duration. Confirm the deployed manager and both recipients, approve only the required USDC, then post the job. Approval alone does not create a job. Save its ID and transaction hash.
2. **Agent:** confirm eligibility, the job’s recorded NFT requirement and any required credential, the posted payment and current bond. The first eligible successful application assigns the job; the employer does not choose among an application queue. Approve the required bond and apply. The duration starts on assignment.
3. **Agent:** finish the work and submit its completion URI before the assignment deadline. The URI identifies evidence; it does not itself prove quality.
4. **Validators:** review the work, confirm eligibility and the bond, then approve or disapprove during the review period. A validator can vote once per job. Votes can lead to approval, a dispute or a later finalization outcome.
5. **Any caller:** after the applicable review/challenge conditions are satisfied, submit finalization. For a disputed job, follow the moderator or stale-dispute owner path. Inspect the receipt, job state and USDC transfers; the UI simulation is a precheck, not a promise of inclusion or success.

The employer can cancel before assignment. Expiry requires an assigned job whose duration has elapsed without a completion request. A completion request instead enters review/dispute rules. [Participant guidance](USERS.md) and [lifecycle reference](PROTOCOL_FLOW.md) explain these branches.

## If a transaction does not finish

- **Wallet/network changed:** return to the intended account and Ethereum mainnet, reload state and review again. Do not reuse a stale confirmation.
- **Approval succeeded but the job action failed:** no job action occurred merely because approval succeeded. Check allowance and on-chain state before retrying; revoke unused allowance if abandoning the action.
- **Transaction pending or receipt unavailable:** inspect its hash on the correct chain before sending a replacement. An RPC timeout is not proof that the transaction failed.
- **Paused manager or changed terms:** read the current pause flags, limits, bond and job state. Ask the operator to resolve the cause; do not change networks or approve another token to bypass it.
- **USDC paused or a recipient blocked:** failed outgoing payments stay reserved for the original beneficiary. Other eligible recipients can still be paid. Use **Retry my payment** after the issuer restriction resolves; wallet rotation cannot redirect existing entitlements.

Only a successful receipt and verified resulting state establish the outcome. Source review, an independent operational security review and instance-specific [readiness checks](MAINNET_READINESS.md) remain necessary for a high-stakes launch.
