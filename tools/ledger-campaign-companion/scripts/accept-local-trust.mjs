// Disposable acceptance helper. Independently pinned real compiler; no device or broadcaster.
import fs from 'node:fs';
import path from 'node:path';
import { Interface } from 'ethers';
import { prepareLocalReviewPolicy } from '../trust/prepare-review.mjs';
import { createTrustedCampaignContext, digest } from '../trust/local-build.mjs';
import { observeSource } from '../coordinators/common.mjs';
import { collectAuthorityReport } from '../verification/authority.mjs';

export function acceptanceTrustedContext({ campaign, supported, privateRoot }) {
  const compilerPath = process.env.COMPANION_ACCEPT_SOLJSON, compilerSha256 = process.env.COMPANION_ACCEPT_SOLJSON_SHA256;
  if (!compilerPath || !path.isAbsolute(compilerPath) || !/^[a-f0-9]{64}$/.test(compilerSha256 || '')) throw Error('EXPLICIT_ACCEPTANCE_COMPILER_PIN_REQUIRED');
  const privateDirectory = path.join(privateRoot, 'local-trusted-build'); fs.mkdirSync(privateDirectory, { mode: 0o700 });
  const nodePath = fs.realpathSync(process.execPath), compiler = { kind: 'soljson', path: fs.realpathSync(compilerPath), sha256: compilerSha256,
    version: '0.8.37+commit.f401782d.Emscripten.clang', nodePath, nodeSha256: digest(fs.readFileSync(nodePath)), nodeVersion: process.versions.node };
  const policy = prepareLocalReviewPolicy({ campaign, compiler, privateDirectory, supported, nativePlanValidated: true });
  return createTrustedCampaignContext({ campaign, plan: JSON.parse(fs.readFileSync(campaign.coordinator.planPath)), policy, expectedPolicySha256: digest(policy), sourceRoot: campaign.coordinator.checkout,
    observeSource: () => observeSource(campaign.coordinator, supported), nativePlanValidated: true });
}
export async function acceptanceAuthority({ adapter, source, graph, creator, governor, provider }) {
  const block = await provider.send('eth_getBlockByNumber', ['latest', false]), snapshot = { number: Number(BigInt(block.number)), hash: block.hash };
  return collectAuthorityReport({ adapter, source, graph, creator, governor, snapshot,
    checkCanonical: async pin => (await provider.send('eth_getBlockByNumber', ['0x' + pin.number.toString(16), false]))?.hash === pin.hash,
    read: async query => { const abi = new Interface([`function ${query.signature}`]), method = query.signature.slice(0, query.signature.indexOf('('));
      const output = await provider.send('eth_call', [{ to: query.target, data: abi.encodeFunctionData(method, query.args) }, '0x' + query.block.number.toString(16)]); return abi.decodeFunctionResult(method, output)[0]; }
  });
}
