# AGIJobManager v1.13.0 — Reviewer capacity and Astra pilot evidence

The synthetic Work + Astra M1 study identified review participation and deadline pressure as operating bottlenecks. This release turns the finding into explicit offline planning and evaluation tools.

- `workforce:reserve` books declared time for independent reviewers across competing jobs, checks existing reservations, review readiness, challenge periods and recovery margin, and rejects jobs that cannot fit. It refuses duplicate control, overlapping bookings and replayed job IDs. It does not change contract quorum or private fleet intake.
- `workforce:pilot` reports useful/admitted, human minutes per useful result, losing Agent and Node engagements, audited settlement defects, and independently scored review judgment errors separately. Missing audit or ground truth fails its corresponding target. A Wilson upper bound makes small apparent zero-error samples visible.
- The Astra reference fixture reproduces the canonical synthetic fleet case: 137 useful of 446 admitted, 79.8 human minutes per useful result, and 308/446 losing Agent and 588/948 losing Node engagements. It fails the candidate thresholds. No new simulation result or measured capacity improvement is claimed.
- A concise guide records the three principal scenario tradeoffs, provenance hashes, commands and the required real-machine pilot measurements. Current docs, CLI inventory, version labels and standalone console links are synchronized.

The public contract source, ABI, payout rules, review quorum and dependency resolutions are unchanged. New work retains the no-retainer operator-budget approach; outstanding refunds, claims and historical jobs remain under their original contracts. Fleet 1.10.0, Agent 1.16.0 and Node 2.17.0 remain the separately distributed private companion editions; this release does not update or install them.

Download the COMPLETE ZIP and open START_HERE.md. The release manifest and SHA256SUMS.txt bind the qualified source and assets. These planning tools grant no authority and are not a live scheduler, an OpenClaw adapter, a paid-customer result, or proof of independent validation. See VALIDATION.md for actual checks and remaining commissioning.
