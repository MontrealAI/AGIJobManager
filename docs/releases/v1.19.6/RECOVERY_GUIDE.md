# v1.19.6 maintenance recovery

Preserve the exact previous source, lockfiles, deployment journals, original compiler inputs, transaction receipts and configured operator data before updating local software. Existing deployed contracts, jobs, claims and paused-intake state are unchanged by this candidate. Use the matching historical source for recovery of an existing transaction or deployment.

A failed installation or check is a failed attempt; retain its logs and diagnose it before retrying. Install root and Hardhat workspaces sequentially because their postinstall compiler patcher operates on both compiler dependency copies. Never replace missing original evidence with a fresh build or treat old release qualification as applying to this candidate.

Use the previous published release and its original archive if the new maintenance candidate is not qualified for your intended use. No rollback transaction, deployment, owner change or new intake is part of this guide.
