import { createHash } from 'node:crypto';
import { AbiCoder, Interface, Transaction, getAddress, keccak256 } from 'ethers';

const stop = code => { throw Object.assign(new Error(code), { code }); };
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const configurationDigest = policy => createHash('sha256').update(JSON.stringify(canonical(policy))).digest('hex');
const contractAddress = value => { try { const address = getAddress(value); if (/^0x0{40}$/.test(address)) stop('ZERO_CONFIGURATION_ADDRESS'); return address; } catch { stop('INVALID_CONFIGURATION_ADDRESS'); } };
const bindInterface = new Interface(['function bindMarketplace(address marketplace)', 'function bindMark(address mark)']);
const specs = [{ method: 'bindMarketplace', target: 'AscensionRiskOracle', argument: 'AscensionJobMarket', getter: 'marketplace' }, { method: 'bindMark', target: 'AscensionJobMarket', argument: 'AscensionMark', getter: 'mark' }];
const unsigned = bytes => { try { const tx = Transaction.from(bytes); if (tx.signature || tx.type !== 2 || tx.chainId !== 1n || tx.unsignedSerialized !== bytes.toLowerCase()) stop('INVALID_CONFIGURATION_ENVELOPE'); return tx; } catch { stop('INVALID_CONFIGURATION_ENVELOPE'); } };

export function configurationScope(coordinator) {
  return coordinator === 'alpha' ? { supported: ['bindMarketplace(address)', 'bindMark(address)'], missing: ['Other governor configuration', 'ENS custody or enrollment', 'Admission, funding and activation'], arbitraryCallsAllowed: false } : { supported: [], missing: ['Configuration is outside this coordinator adapter'], arbitraryCallsAllowed: false };
}

export async function approvedConfiguration({ coordinator, policy, expectedPolicySha256, graph, verifyCanonicalTarget, approvedUnsigned }) {
  if (coordinator !== 'alpha') stop('CONFIGURATION_SCOPE_UNSUPPORTED');
  if (!/^[a-f0-9]{64}$/.test(expectedPolicySha256 || '') || configurationDigest(policy) !== expectedPolicySha256) stop('CONFIGURATION_POLICY_MISMATCH');
  if (policy.schema !== 'manual-ledger-configuration-policy-v1' || policy.chainId !== 1 || !Array.isArray(policy.operations) || policy.operations.length !== 2 || !Array.isArray(approvedUnsigned) || approvedUnsigned.length !== 2 || typeof verifyCanonicalTarget !== 'function') stop('CONFIGURATION_POLICY_UNSUPPORTED');
  const governor = contractAddress(policy.governor), creator = contractAddress(policy.creator);
  if (governor === creator) stop('CONFIGURATION_ACTORS_MUST_DIFFER');
  const result = [];
  for (const [index, spec] of specs.entries()) {
    const selected = policy.operations[index];
    if (selected.method !== spec.method || selected.target !== spec.target || selected.argument !== spec.argument) stop('CONFIGURATION_OPERATION_UNSUPPORTED');
    const target = graph?.[spec.target], argument = graph?.[spec.argument];
    for (const record of [target, argument]) {
      if (!record || !/^0x[0-9a-f]{64}$/.test(record.creationTransactionHash || '') || !/^0x[0-9a-f]{64}$/.test(record.blockHash || '') || !/^0x[0-9a-f]{64}$/.test(record.runtimeCodeHash || '') || !Number.isSafeInteger(record.blockNumber) || record.blockNumber < 0) stop('RECEIPT_PROVEN_NEW_TARGET_REQUIRED');
      contractAddress(record.address);
      if (await verifyCanonicalTarget(record) !== true) stop('CANONICAL_CONFIGURATION_TARGET_REJECTED');
    }
    const tx = unsigned(approvedUnsigned[index]);
    if (tx.to !== contractAddress(target.address) || tx.value !== 0n || tx.accessList.length !== 0 || tx.gasLimit <= 0n || tx.gasLimit > 16777216n) stop('CONFIGURATION_ENVELOPE_MISMATCH');
    for (const key of ['nonce', 'gasLimit', 'maxFeePerGas', 'maxPriorityFeePerGas']) if (String(tx[key]) !== String(selected[key])) stop('CONFIGURATION_ENVELOPE_MISMATCH');
    const data = bindInterface.encodeFunctionData(spec.method, [contractAddress(argument.address)]);
    if (tx.data !== data) stop('CONFIGURATION_ARGUMENT_MISMATCH');
    const decoded = bindInterface.decodeFunctionData(spec.method, tx.data);
    if (bindInterface.encodeFunctionData(spec.method, decoded) !== tx.data) stop('CONFIGURATION_REENCODING_MISMATCH');
    result.push({ operationId: selected.operationId, account: 'governor', expectedSender: governor, purpose: spec.method, unsignedHex: tx.unsignedSerialized, destination: tx.to, decodedArguments: [{ name: spec.argument, value: decoded[0] }], expectedPostState: { target: tx.to, getter: spec.getter, equals: contractAddress(argument.address) }, displayScope: 'HOST_DECODED_NOT_DEVICE_CONFIRMED', requiresManualLedgerApproval: true });
  }
  return { operations: result, policySha256: expectedPolicySha256, arbitraryCallsAllowed: false, authorityComplete: false, activationReady: false };
}

export function decodeSupportedBinding(unsignedHex) {
  const tx = unsigned(unsignedHex);
  if (!tx.to || tx.value !== 0n || tx.accessList.length !== 0) stop('CONFIGURATION_SCOPE_UNSUPPORTED');
  let decoded;
  try { decoded = bindInterface.parseTransaction({ data: tx.data, value: tx.value }); } catch { stop('CONFIGURATION_SCOPE_UNSUPPORTED'); }
  if (!decoded || !specs.some(spec => spec.method === decoded.name) || bindInterface.encodeFunctionData(decoded.name, decoded.args) !== tx.data) stop('CONFIGURATION_SCOPE_UNSUPPORTED');
  return { method: decoded.name, destination: tx.to, arguments: decoded.args.map(String), displayScope: 'HOST_DECODED_NOT_DEVICE_CONFIRMED' };
}

export function describeCreation({ unsignedHex, abi, linkedBytecode, expectedLinkedBytecodeHash, constructorArguments }) {
  const tx = unsigned(unsignedHex);
  if (tx.to !== null || !/^0x(?:[a-f0-9]{2})+$/.test(linkedBytecode || '') || keccak256(linkedBytecode) !== expectedLinkedBytecodeHash) stop('REVIEWED_CREATION_TEMPLATE_REQUIRED');
  const iface = new Interface(abi), encoded = iface.encodeDeploy(constructorArguments);
  if (tx.data !== linkedBytecode + encoded.slice(2)) stop('CREATION_ARGUMENT_MISMATCH');
  const values = AbiCoder.defaultAbiCoder().decode(iface.deploy.inputs, encoded);
  if (iface.encodeDeploy(values) !== encoded) stop('CREATION_REENCODING_MISMATCH');
  return { destination: 'CREATE', constructorArguments: iface.deploy.inputs.map((input, i) => ({ name: input.name || String(i), type: input.format('sighash'), value: JSON.parse(JSON.stringify(values[i], (_key, value) => typeof value === 'bigint' ? value.toString() : value)) })), dataHash: keccak256(tx.data), displayScope: 'HOST_DECODED_NOT_DEVICE_CONFIRMED', deviceSemanticsConfirmed: false };
}
