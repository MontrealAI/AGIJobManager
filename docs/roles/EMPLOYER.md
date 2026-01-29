# Employer Guide

This guide is for job posters (employers). It shows how to safely create and manage a job, and how to handle disputes and NFTs.

## Prerequisites
- AGI tokens in your wallet.
- The AGIJobManager contract address.
- Confidence that the AGI token address is correct.

## Step‑by‑step (non‑technical)
> **Screenshot placeholder:** Etherscan “Write Contract” tab showing `createJob` inputs filled in.
### 1) Approve escrow amount
Use your wallet or Etherscan to approve **only the exact payout amount**.

### 2) Create a job
Call `createJob(ipfsHash, payout, duration, details)`.
- **ipfsHash**: CID/hash only (no `ipfs://`)
- **payout**: token amount (18 decimals)
- **duration**: seconds (max `jobDurationLimit`)
- **details**: short plain text

**On‑chain results**
- Event: `JobCreated`
- Token movement: employer → contract (escrow)

### 3) Monitor applications and completion
Agents can apply and then request completion. You can monitor events:
- `JobApplied`
- `JobCompletionRequested`

### 4) Cancel (if no agent assigned)
If no agent has been assigned and the job is not completed, call `cancelJob(jobId)`.

### 5) Dispute (if needed)
Call `disputeJob(jobId)` if you disagree with the completion or validation direction.

### 6) Receive NFT receipt
When a job completes, an NFT is minted to your wallet.
- Event: `NFTIssued`
- Token URI: `baseIpfsUrl + "/" + ipfsHash`

## Common mistakes
- **Insufficient allowance** → `TransferFailed`
- **Job already assigned or completed** → `InvalidState`
- **Wrong jobId** → `JobNotFound`

## For developers
### Key functions
- `createJob` → escrows payout & emits `JobCreated`
- `cancelJob` → refunds if no agent
- `disputeJob` → triggers dispute mode

### State fields to inspect
- `jobs[jobId].assignedAgent`
- `jobs[jobId].completionRequested`
- `jobs[jobId].completed`
- `jobs[jobId].disputed`

### Events to index
`JobCreated`, `JobApplied`, `JobCompletionRequested`, `JobCompleted`, `NFTIssued`, `JobDisputed`, `DisputeResolved`
