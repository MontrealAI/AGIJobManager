import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execute, privateWrite, readJson, need } from './common.mjs';
import { verifyRuntimeEvidence } from '../verification/runtime.mjs';

export async function exportRuntimeEvidence({ campaign, supported, privateDir, tasks, proofs }) {
  const config = campaign.coordinator, proofPath = privateWrite(privateDir, proofs);
  const output = path.join(privateDir, `${crypto.randomUUID()}-exact-runtime.json`);
  await execute(config, supported, fileURLToPath(new URL('./native-runtime-snapshot.cjs', import.meta.url)),
    [supported.id, config.checkout, config.planPath, proofPath, output, ...(supported.id === 'manager' ? [config.catalogPath, config.catalogSha256, config.buildId] : [])],
    supported.id === 'manager' ? { MANAGER_READ_RPC_URL: config.readRpcUrl } : { ALPHA_READ_ONLY_RPC_URL: config.readRpcUrl });
  const rows = readJson(output); need(Array.isArray(rows) && rows.length === tasks.length, 'COMPLETE_RUNTIME_EVIDENCE_REQUIRED');
  return tasks.map((task, index) => {
    const row = rows[index]; need(row.address === task.address, 'RUNTIME_EVIDENCE_ADDRESS_MISMATCH');
    const { canonical, finalized, runtimeVerified, ...creation } = task.creation;
    const evidence = { schema: 'manual-ledger-runtime-evidence-v1', chainId: 1, address: task.address, source: campaign.reviewedManifest.source,
      qualifiedName: task.qualifiedName, compilerVersion: task.compilerVersion, standardInputSha256: task.standardInputSha256,
      libraries: task.libraries, creation, ...row };
    verifyRuntimeEvidence(evidence, { task, expectedSource: campaign.reviewedManifest.source }); return evidence;
  });
}
