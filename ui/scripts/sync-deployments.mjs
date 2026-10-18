import fs from 'node:fs';
import path from 'node:path';
import { loadLatestReportedDeployment } from '../../site/deployments.mjs';
const repoRoot = path.resolve(process.cwd(), '..');
const config = JSON.parse(fs.readFileSync(path.join(repoRoot, 'config/usdc-deployment.json'), 'utf8'));
const record = JSON.parse(fs.readFileSync(path.join(repoRoot, 'config/mainnet/agi-jobs-usdc.json'), 'utf8'));
const { record: latest, recordPath, guidePath } = loadLatestReportedDeployment(repoRoot);
const recorded = { chainId: record.chainId, manager: record.manager, helper: record.helper, namespace: record.jobsRootName, block: record.connection.snapshot.number, blockHash: record.connection.snapshot.hash, recordDate: record.recordDate, activation: record.activation.decision };
const reported = { chainId: latest.chainId, manager: latest.manager, recordDate: latest.recordDate, sourceCommit: latest.source.commit, block: latest.reportedAuthoritySnapshot.blockNumber, blockHash: latest.reportedAuthoritySnapshot.blockHash, owner: latest.reportedAuthoritySnapshot.owner, intakePaused: latest.reportedAuthoritySnapshot.intakePaused, contractCount: latest.deployment.finalizedCount, exactMatches: latest.explorerVerification.exactMatches, retainedSimilarMatches: latest.explorerVerification.retainedSimilarMatches, recordPath, guidePath, managerCodeUrl: latest.verificationLinks.managerCode };
const output = path.join(process.cwd(), 'src/generated/deployments.ts');
const content = `// Generated from config/usdc-deployment.json and the dated deployment records. Never infer transaction defaults from these records.
export const OFFICIAL_DEPLOYMENTS = ${JSON.stringify(config, null, 2)} as const;

// Historical display only; never a transaction default.
export const RECORDED_MAINNET_INSTANCE = ${JSON.stringify(recorded, null, 2)} as const;

// Latest owner-reported display only; not a live observation or transaction default.
export const LATEST_REPORTED_MAINNET_INSTANCE = ${JSON.stringify(reported, null, 2)} as const;
`;
const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const github = 'https://github.com/MontrealAI/AGIJobManager/blob/main/';
const display = `      <!-- recorded-deployment-display:start -->
      <h2>USDC deployment · v${escapeHtml(config.version)} software</h2>
      <div class="helper" style="margin:14px 0;overflow-wrap:anywhere" aria-labelledby="latestReportedDeployment">
        <h3 id="latestReportedDeployment">Latest reported Manager deployment · ${escapeHtml(reported.recordDate)}</h3>
        <p>Ethereum mainnet · Chain ${reported.chainId}<br>Manager: <a href="${escapeHtml(reported.managerCodeUrl)}" target="_blank" rel="noopener noreferrer"><code>${escapeHtml(reported.manager)}</code></a></p>
        <p>${reported.contractCount} creations reported finalized. Explorer report: ${reported.exactMatches} Exact Match and ${reported.retainedSimilarMatches} retained Similar Match. Authority snapshot: block ${reported.block.toLocaleString('en-US')}; intake ${reported.intakePaused ? 'paused' : 'not paused'}.</p>
        <p>Owner-reported evidence, not live state. Paid intake remains held; this record does not establish an ENS helper attachment or select a transaction target. <a href="${github}${escapeHtml(guidePath)}" target="_blank" rel="noopener noreferrer">Review the latest deployment and all nine contracts</a> · <a href="${github}${escapeHtml(recordPath)}" target="_blank" rel="noopener noreferrer">Machine-readable record</a>.</p>
      </div>
      <details class="helper" style="margin:14px 0;overflow-wrap:anywhere">
        <summary>Historical instance · October 10, 2026 — no wallet needed</summary>
        <p><b>Historical deployment and ENS connection at block ${recorded.block.toLocaleString('en-US')}.</b> This older instance is separate from the latest reported Manager above. Current state is unavailable in this historical panel.</p>
        <p>Ethereum mainnet · Chain ${recorded.chainId}<br>Historical manager: <code>${escapeHtml(recorded.manager)}</code><br>Historical helper: <code>${escapeHtml(recorded.helper)}</code><br>Historical namespace: <code>${escapeHtml(recorded.namespace)}</code></p>
        <p>The historical helper is not attached to the latest Manager by this record. This panel does not select a transaction target. <a href="${github}docs/deployments/MAINNET_USDC_2026-10-10.md" target="_blank" rel="noopener noreferrer">Review the October 10 historical record</a>.</p>
      </details>
      <!-- recorded-deployment-display:end -->`;
const consolePath = path.join(process.cwd(), 'agijobmanager-usdc.html');
const consoleBefore = fs.readFileSync(consolePath, 'utf8');
const marker = /      <!-- recorded-deployment-display:start -->[\s\S]*?      <!-- recorded-deployment-display:end -->/g;
const legacyDisplay = `      <h2>USDC deployment · v1.19.1 candidate</h2>
      <details class="helper" style="margin:14px 0;overflow-wrap:anywhere">
        <summary>View the recorded mainnet instance — no wallet needed</summary>
        <p><b>Deployed and ENS-connected at block 26,165,026 on October 10, 2026.</b> Activation is held pending separate review. Current state is unavailable in this historical panel.</p>
        <p>Ethereum mainnet · Chain 1<br>Manager: <code>0xCFA78f9980eA9B55c705B3E44467baE383cE1fA7</code><br>Helper: <code>0x6EE7A600C56C1Bfd12c482190d5dAbDD7194CDBC</code><br>Namespace: <code>usdc.jobs.agi.eth</code></p>
        <p>This panel does not select a transaction target. <a href="https://github.com/MontrealAI/AGIJobManager/blob/main/docs/OPERATIONS/COMMISSIONING.md" target="_blank" rel="noopener noreferrer">Inspect the existing instance and review A1–A5</a>.</p>
      </details>`;
const matches = [...consoleBefore.matchAll(marker)];
if (matches.length > 1 || (!matches.length && consoleBefore.split(legacyDisplay).length !== 2)) throw new Error('Console deployment display is missing or ambiguous.');
const consoleAfter = matches.length ? consoleBefore.replace(marker, () => display) : consoleBefore.replace(legacyDisplay, () => display);
if (process.argv.includes('--check')) {
  if (fs.readFileSync(output, 'utf8') !== content) throw new Error('Run npm run sync:deployments and commit the result.');
  if (consoleBefore !== consoleAfter) throw new Error('Console deployment display is stale. Run npm run sync:deployments and commit the result.');
} else {
  fs.writeFileSync(output, content);
  fs.writeFileSync(consolePath, consoleAfter);
}
