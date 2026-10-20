import fs from 'node:fs';
import path from 'node:path';
import { loadLatestReportedDeployment } from '../../site/deployments.mjs';
const c = JSON.parse(fs.readFileSync('../config/usdc-deployment.json', 'utf8'));
const { record: latest, recordPath, guidePath } = loadLatestReportedDeployment(path.resolve('..'));
fs.writeFileSync('../docs/ui/DEPLOYMENT_MAINNET.md', `# USDC deployment registry

The [v${c.version} transformation adapter](../successor/TRANSFORMATIONAL_WORK.md) is free inspection only for the current native zero-currency pilot. It creates no deployment, transaction or new intake authority. Existing deployment records and recovery inputs retain their original source identities.

## Software version

AGIJobManager v${c.version}. Status: **${c.status}**.

${c.note.replace(/^Candidate software;/, 'Software package;')}

- Chain ID: ${c.chainId}
- Manager: ${c.managerAddress || 'Not recorded'}
- ENS job-page helper: ${c.ensJobPagesAddress || 'Not recorded (optional)'}
- Final owner: ${c.finalOwner || 'Operator must supply and verify'}
- 30% recipient: ${c.settlementWallets.wallet30 || 'Operator must supply and verify'}
- 10% recipient: ${c.settlementWallets.wallet10 || 'Operator must supply and verify'}
- USDC: ${c.usdc.address}
- Decimals: ${c.usdc.decimals}
- Address reference: ${c.addressSource}

## Latest reported Manager deployment

Reported ${latest.recordDate}: [${latest.manager}](${latest.verificationLinks.managerCode}) on Ethereum mainnet. All ${latest.deployment.finalizedCount} creations were reported finalized. The explorer report records **${latest.explorerVerification.exactMatches} Exact Match and ${latest.explorerVerification.retainedSimilarMatches} retained Similar Match**, not nine Exact Matches.

The owner-reported authority snapshot at block ${latest.reportedAuthoritySnapshot.blockNumber.toLocaleString('en-US')} reports intake paused. This is recorded evidence, not a live observation or paid-intake qualification. It does not establish an ENS helper attachment or select a transaction target. Review [all nine contracts and the remaining commissioning steps](../../${guidePath}) and the [machine-readable record](../../${recordPath}).

The [October 10 deployment and ENS helper](../deployments/MAINNET_USDC_2026-10-10.md) are a separate historical instance. Do not attach that helper to the latest Manager by inference.

## Constructor arguments

Follow the [Hardhat deployment guide](../../hardhat/README.md), [readiness guide](../MAINNET_READINESS.md) and [deployment runbook](../DEPLOY_RUNBOOK.md). Supply the two settlement wallets and explicit final governor through the reviewed constructor profile. All monetary arguments use six-decimal base units. Preserve original-asset jobs on their existing manager; legacy deployment snapshots are not USDC configurations. v${c.version} includes explicit-governor constructor profiles and eight fixed library links. Use the exact selected source, constructor schema and compiler settings; do not substitute current constructor inputs into a historical deployment. The ENS membership correction introduced in v1.17.0 remains included, and NFT admission remains disabled by default. A verified v0.9.6 manager remains compatible with this console. v0.9.5 and older managers lack the getJobBonds getter and must keep their original interfaces for existing jobs. First deployments and moves from incompatible older versions require a fresh manager.

AGI Agents use agent.agi.eth or alpha.agent.agi.eth subnames; AGI Club validators use club.agi.eth or alpha.club.agi.eth. The contract preserves owner-managed allowlist and Merkle exceptions, and agents need a configured NFT eligibility credential only when their job requires it. Fresh v${c.version} managers start with NFT admission disabled and an empty registry; owner changes affect future jobs only. Existing deployed settings remain unchanged. To opt in, register reviewed collections and enable the requirement before posting the affected jobs. Readiness requires READINESS_NFT_CONFIG with the chosen mode and complete collection registry. Optional job-page ENS wiring is separate from member identity. Review the four membership root nodes and any exceptions in the deployment plan.

## Verification

Compile with pinned solc 0.8.37 and the exact source-selected repository settings (via IR, optimizer 40 runs, Shanghai target and the reviewed no-L/E optimizer sequence). Preserve original compiler inputs and settings for historical verification; never replace them with the current profile. Verify the exact source and linked libraries, constructor arguments, chain ID, owner, USDC address and decimals before configuring any UI. Record the actual deployment receipt and update config/usdc-deployment.json only after verification. Blank defaults do not mean no instance was deployed. Start with the [latest reported Manager record](../../${guidePath}) and [current inspection](../OPERATIONS/COMMISSIONING.md). The October 10 ENS-connected instance remains explicitly historical; activation requires separate review.
`);
