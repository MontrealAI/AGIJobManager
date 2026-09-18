# Observe the complete user journey

This is a reusable acceptance protocol, not a report of completed user studies. Start every case as **not run**. Use a disposable local environment for issuer-failure/time-control scenarios and a separately configured Sepolia rehearsal for intended wallet signers. The released standalone console targets Ethereum mainnet; do not change its chain guard to make a test pass. Use the supported deployment tools and verified testnet contract interface for Sepolia transactions.

Recruit representative buyers, agents, reviewers and operators who did not build the interface. Give them goals instead of click-by-click instructions. Record where they hesitate, request help, misunderstand a fee or expect a refund that the contract does not provide. Do not record private keys, seed phrases or confidential deliverables.

## Automated browser checks

Run `npm run test:ui:usdc` after installing the root dependencies and Playwright Chromium (`npx playwright install --with-deps chromium`). This opens the actual `ui/agijobmanager-usdc.html` download in Chromium, with its integrity-pinned Web3 library and a deterministic wallet/RPC fixture. The fixture rejects signing and transaction requests; it broadcasts nothing. The runner downloads and verifies the pinned Web3 bytes before testing, or accepts an existing file through `AGIJOBMANAGER_WEB3_PATH` and verifies the same integrity hash.

These checks complement `npm run test:ui`, which exercises the older documentation console against a disposable local chain. They do not establish production wallet compatibility, actual manager identity, transaction settlement, or participant understanding. Continue to record observed-user cases below separately.

## Cases and observable outcomes

| Case | Ask the participant to do | Required observation |
| --- | --- | --- |
| First visit | Identify their role and what must happen before a write | Buying work does not require an agent ENS credential; an unverified manager never appears ready |
| Buyer budget | Explain a 100 USDC successful job with the default rate | 100 total escrow includes 8 shared reviewer budget, 30/10 wallet fees and 52 base agent earnings; bonds and ETH gas are separate |
| Posting | Fund a measurable job and identify its receipt | Approval alone is not posting; participant can find the correct chain, manager, job ID and successful transaction |
| Assignment | Explain who can take the job and when time starts | First eligible successful application assigns it; duration begins at assignment, with the recorded NFT policy and bond |
| Delivery and review | Submit accessible evidence and inspect another participant's work | A URI is not quality proof; reviewers understand the shared reward, bond and possibility of loss |
| Explicit acceptance | Explain what accepting and paying does before signing | Immediate final settlement; buyer understands the loss of further contract dispute rights |
| No delivery | Find the expiry action after the eligible deadline | Full buyer escrow and forfeited agent bond return; a successful transaction is required |
| Poor submission | Find the dispute cutoff and funding requirement | Participant disputes before the displayed deadline; expiry is not substituted for a submitted job |
| No votes or unresolved dispute | Explain escalation and neutral timeout | No automatic agent payment; neutral timeout returns each participant's own funds but pays no work/review reward |
| Payment failure | Locate a reserved payment and its retry | Pending claim is not already received; original beneficiary is preserved, and issuer/settlement restrictions may block retry |
| Context changes | Change account or network during an action review | Stale confirmation cannot submit; the participant must review the correct live context again |
| Incident recovery | Stop intake, explain settlement pause, then restore service | Owner distinguishes the two pause states, understands clock extension and verifies state before reopening |

The 100 USDC example assumes qualifying correct approval reviewers and omits rounding dust and separate collateral. Test the actual job's rate and amounts, including the cost-assessment scenarios in [the economics guide](game-theory.md).

## Keep an evidence record

```text
Release tag and source commit:
Case:
Status: NOT RUN / PASS / FAIL / BLOCKED
Date and environment:
Chain ID / manager / block:
Participant role (use a pseudonymous identifier):
Goal provided:
Observed actions and assistance needed:
What the participant believed the costs and outcome would be:
Transaction hashes or local test evidence:
Expected outcome / actual outcome:
Issue, correction and retest evidence:
Reviewer of this record:
```

A pass requires both the expected system behavior and correct participant understanding without a material intervention. A transaction failure can be the expected result in a rejection case; record why. A missing participant, signer, configuration or RPC is blocked, not passed. Preserve failed attempts beside retests.

Before meaningful mainnet exposure, complete the deployment-specific [launch checklist](LAUNCH_CHECKLIST.md), arrange independent security review and establish actual reviewer/moderator coverage. Successful internal automation does not populate this user-study record.
