import { Interface, getAddress, keccak256, ZeroAddress } from 'ethers';
import { canonicalJson } from './explorer.mjs';
import { GOVERNOR } from './authority.mjs';

export const WALLET_ALPHA_SOURCE = Object.freeze({ repository: 'MontrealAI/AGI-Alpha-Agent-v0', commit: '38064bec3423218f87c6b81760ac6768b3e7d4e5', tree: '4fe59cb9b8c7e65ea087fd27b0e2abed6bf34c68' });
export const WALLET_ALPHA_NAMES = Object.freeze(['AscensionAccess', 'NovaSeed', 'AscensionRiskOracle', 'AscensionJobMarket', 'AscensionMark']);
const abi = new Interface(['function bindMarketplace(address marketplace)', 'function bindMark(address mark)']);
const specifications = Object.freeze([{ contract: 'AscensionRiskOracle', method: 'bindMarketplace', argument: 'AscensionJobMarket', getter: 'marketplace' }, { contract: 'AscensionJobMarket', method: 'bindMark', argument: 'AscensionMark', getter: 'mark' }]);
const stop = code => { throw Object.assign(new Error(code), { code }); };
const need = (condition, code = 'WALLET_CONFIGURATION_INVALID') => { if (!condition) stop(code); };
const address = value => { try { const result = getAddress(value); need(result !== ZeroAddress); return result; } catch { stop('WALLET_CONFIGURATION_INVALID'); } };
const hash = value => typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value);
const equalAddress = (a, b) => address(a) === address(b);
const number = value => { try { const result = Number(BigInt(value)); need(Number.isSafeInteger(result) && result >= 0); return result; } catch { stop('WALLET_CONFIGURATION_RECEIPT_MISMATCH'); } };

export function walletConfigurationCalls({ source, governor, graph }) {
  need(canonicalJson(source) === canonicalJson(WALLET_ALPHA_SOURCE), 'WALLET_CONFIGURATION_SOURCE_UNREVIEWED');
  need(address(governor) === GOVERNOR, 'WALLET_CONFIGURATION_GOVERNOR_MISMATCH');
  need(graph && Object.keys(graph).length === 5 && WALLET_ALPHA_NAMES.every(name => graph[name]), 'WALLET_CONFIGURATION_GRAPH_INVALID');
  const normalized = Object.fromEntries(WALLET_ALPHA_NAMES.map(name => [name, address(graph[name]) ]));
  need(new Set(Object.values(normalized)).size === 5, 'WALLET_CONFIGURATION_GRAPH_INVALID');
  return Object.freeze(specifications.map((specification, index) => Object.freeze({ schema: 'manual-ledger-wallet-call-v1', index, chainId: 1, from: GOVERNOR, to: normalized[specification.contract], valueWei: '0', contract: specification.contract, method: specification.method, arguments: Object.freeze([normalized[specification.argument]]), argumentContract: specification.argument, data: abi.encodeFunctionData(specification.method, [normalized[specification.argument]]), expectedPostState: Object.freeze({ getter: specification.getter, equals: normalized[specification.argument] }), explorerWriteUrl: null, manualWalletApprovalRequired: true, signingSupported: false, relaySupported: false, activationAuthorized: false })));
}

// Field-level reconciliation is independent of any companion signing session.
// The fixed native collector also reconstructs the signed transaction/recovered
// sender and validates exact source, compiler output and runtime/getter values.
export function validateWalletReceipt({ call, transaction, receipt, canonicalBlock, expectedRuntimeCodeHash, actualRuntime, observedGetter }) {
  try {
    const spec = specifications[call?.index]; need(spec && call.schema === 'manual-ledger-wallet-call-v1' && call.chainId === 1 && call.from === GOVERNOR && call.contract === spec.contract && call.method === spec.method && call.argumentContract === spec.argument && call.valueWei === '0' && call.arguments?.length === 1);
    need(call.data === abi.encodeFunctionData(spec.method, [address(call.arguments[0])]) && call.expectedPostState.getter === spec.getter && equalAddress(call.expectedPostState.equals, call.arguments[0]));
    need(transaction && receipt && hash(transaction.hash) && transaction.hash.toLowerCase() === receipt.transactionHash?.toLowerCase(), 'WALLET_CONFIGURATION_RECEIPT_MISMATCH');
    need(number(transaction.chainId) === 1 && number(transaction.type) === 2 && number(receipt.type) === 2 && number(receipt.status) === 1 && BigInt(transaction.value) === 0n && equalAddress(transaction.from, GOVERNOR) && equalAddress(receipt.from, GOVERNOR) && equalAddress(transaction.to, call.to) && equalAddress(receipt.to, call.to) && transaction.input?.toLowerCase() === call.data.toLowerCase() && receipt.contractAddress === null, 'WALLET_CONFIGURATION_RECEIPT_MISMATCH');
    need(!transaction.authorizationList && !transaction.blobVersionedHashes && Array.isArray(transaction.accessList) && transaction.accessList.length === 0, 'WALLET_CONFIGURATION_RECEIPT_MISMATCH');
    need(hash(canonicalBlock?.hash) && transaction.blockHash?.toLowerCase() === canonicalBlock.hash.toLowerCase() && receipt.blockHash?.toLowerCase() === canonicalBlock.hash.toLowerCase() && number(transaction.blockNumber) === number(canonicalBlock.number) && number(receipt.blockNumber) === number(canonicalBlock.number) && number(transaction.transactionIndex) === number(receipt.transactionIndex), 'WALLET_CONFIGURATION_CANONICAL_RECEIPT_REQUIRED');
    need(hash(expectedRuntimeCodeHash) && typeof actualRuntime === 'string' && /^0x(?:[a-f0-9]{2})+$/i.test(actualRuntime) && keccak256(actualRuntime) === expectedRuntimeCodeHash && equalAddress(observedGetter, call.expectedPostState.equals), 'WALLET_CONFIGURATION_RUNTIME_OR_GETTER_MISMATCH');
    return Object.freeze({ state: 'reconciled', transactionHash: transaction.hash.toLowerCase(), callIndex: call.index, chainId: 1, from: GOVERNOR, to: address(call.to), block: Object.freeze({ hash: canonicalBlock.hash.toLowerCase(), number: number(canonicalBlock.number) }), runtimeCodeHash: expectedRuntimeCodeHash, getter: spec.getter, observedGetter: address(observedGetter), signingSupported: false, relaySupported: false, activationAuthorized: false });
  } catch (error) { stop(/^WALLET_CONFIGURATION_/.test(error?.code || '') ? error.code : 'WALLET_CONFIGURATION_RECEIPT_MISMATCH'); }
}

export function verifiedWalletLinks({ calls, graph, verificationResults, completedCount = 0 }) {
  need(Array.isArray(calls) && calls.length === 2 && Number.isSafeInteger(completedCount) && completedCount >= 0 && completedCount <= 2);
  need(canonicalJson(calls) === canonicalJson(walletConfigurationCalls({ source: WALLET_ALPHA_SOURCE, governor: GOVERNOR, graph })), 'WALLET_CONFIGURATION_CALL_DIFFERS_FROM_REVIEW');
  need(Array.isArray(verificationResults) && verificationResults.length === 5 && new Set(verificationResults.map(item => item.address?.toLowerCase())).size === 5 && WALLET_ALPHA_NAMES.every(name => verificationResults.some(item => equalAddress(item.address, graph[name]) && item.state === 'verified' && item.explorerStatus === 'EXACT_SOURCE_VERIFIED')), 'WALLET_CONFIGURATION_EXACT_EXPLORER_PROOF_REQUIRED');
  return Object.freeze(calls.map(call => Object.freeze({ ...call, state: call.index < completedCount ? 'already-reconciled-do-not-repeat' : call.index === completedCount ? 'owner-review-required' : 'await-prior-reconciliation', explorerWriteUrl: call.index === completedCount ? `https://etherscan.io/address/${address(call.to)}#writeContract` : null })));
}
