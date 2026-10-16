import { Wallet, Transaction } from 'ethers';
import { policyDigest, attachAndValidateSignature } from '../src/envelope.mjs';

export const fixtureWallet = new Wallet(`0x${'11'.repeat(32)}`);
export const fixtureTime = Date.parse('2030-01-01T00:00:00.000Z');
export function campaignFixture(count = 1) {
  const expiry = new Date(fixtureTime + 60_000).toISOString();
  const operations = Array.from({ length: count }, (_v, index) => {
    const tx = Transaction.from({ type: 2, chainId: 1, nonce: index, to: null, data: '0x6000', value: 0n, gasLimit: 100_000n, maxFeePerGas: 2n, maxPriorityFeePerGas: 1n, accessList: [] });
    const review = { chainId: '1', expectedSender: fixtureWallet.address, expiresAt: expiry, maxGasLimit: '100000', maxFeePerGas: '2', maxPriorityFeePerGas: '1', maxTotalFeeWei: '200000', maxValueWei: '0', operationId: `synthetic-step-${index}`, sourceSha256: `0x${'a'.repeat(64)}` };
    return { operationId: review.operationId, unsignedHex: tx.unsignedSerialized, expectedUnsignedHash: tx.unsignedHash, expectedPolicyHash: policyDigest(review, tx.unsignedHash), review };
  });
  return { format: 'manual-ledger-campaign-v1', campaignId: 'synthetic-local-only', adapter: 'synthetic', packetSchema: 'synthetic-packet-v1', expiresAt: expiry, reviewedManifest: { source: { repository: 'test/local-only', commit: '1'.repeat(40), tree: '2'.repeat(40) }, sourceSha256: `0x${'a'.repeat(64)}`, planSha256: 'b'.repeat(64), operations }, coordinator: {}, network: { chainId: '1', name: 'Ethereum Mainnet envelope — synthetic test only' }, route: { name: 'USDC test route', token: 'Synthetic test fixture', symbol: 'USDC', decimals: 6 }, actors: { creator: fixtureWallet.address, governor: '0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99', feeRecipients: [], treasuries: [] }, qualification: Object.fromEntries(['source','browser','coordinator','physical','provider','configuration','explorer','authority'].map(key => [key, 'SYNTHETIC_ONLY'])), maxTotalFeeWei: String(count * 200000), operations: operations.map((_operation, index) => ({ index, purpose: 'Synthetic disposable operation', account: 'creator', destination: 'CREATE', decodedArguments: [], expectedPostState: 'Synthetic fixture only', dependsOn: index ? [index - 1] : [] })) };
}
export function adapterFixture(campaign, controls = {}) {
  const calls = { prepare: 0, importSigned: 0, observe: 0, relayOne: 0, inspectCampaign: 0 };
  let hashes = {};
  const adapter = Object.freeze({ id: campaign.adapter, supported: Object.freeze({ ...campaign.reviewedManifest.source, packetSchema: campaign.packetSchema }),
    inspectCampaign() { calls.inspectCampaign += 1; return {}; },
    async prepare({ step }) { calls.prepare += 1; if (controls.prepareError) throw new Error('RAW_SECRET_DIAGNOSTIC'); const { operationId, ...prepared } = campaign.reviewedManifest.operations[step]; return { operationId, prepared, state: 'awaiting-owner-approval' }; },
    async importSigned({ step, raw }) { calls.importSigned += 1; if (controls.importError) throw new Error('RAW_SECRET_DIAGNOSTIC'); hashes[step] = Transaction.from(raw).hash; return { state: 'signed', transactionHash: hashes[step], acknowledgement: `EXACT_ACK_${step}` }; },
    async observe({ step }) { calls.observe += 1; if (controls.observeError) throw new Error('RAW_SECRET_DIAGNOSTIC'); return { state: controls.observeState ?? 'pending', transactionHash: controls.changedHash ?? hashes[step], verified: controls.observeState === 'verified', finalized: controls.observeState === 'verified' }; },
    async relayOne() { calls.relayOne += 1; throw new Error('SYNTHETIC_RELAY_NOT_ENABLED'); }
  });
  return { adapter, calls, controls };
}
export function signedFixture(prepared, now = fixtureTime) { return attachAndValidateSignature(prepared, fixtureWallet.signingKey.sign(prepared.expectedUnsignedHash), now); }
