'use strict';
const { Interface, ZeroAddress, getAddress, toQuantity } = require('ethers');

function canonicalReference(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== 2 || value.requireCanonical !== true ||
      typeof value.blockHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value.blockHash)) {
    throw new Error('Canonical state reads require an EIP-1898 blockHash and requireCanonical:true.');
  }
  return Object.freeze({ blockHash: value.blockHash.toLowerCase(), requireCanonical: true });
}

// Deliberately no signer, generic send method, or numeric-block fallback.
// Direct RPC calls avoid ethers' number-only block-tag conversion and caches.
function createCanonicalReader(provider, block) {
  if (!provider || typeof provider.send !== 'function' || !Number.isSafeInteger(block?.number) || block.number < 0) {
    throw new Error('Canonical state reads require an RPC provider and a numbered block.');
  }
  const at = canonicalReference({ blockHash: block.hash, requireCanonical: true });
  const sameReference = tag => {
    if (tag !== undefined && canonicalReference(tag).blockHash !== at.blockHash) throw new Error('Canonical state read selected a different block hash.');
  };
  const request = async (method, params) => {
    let result;
    try { result = await provider.send(method, [...params, at]); }
    catch {
      throw new Error(`CANONICAL_STATE_READ_BLOCKED: ${method} failed at ${at.blockHash}. The RPC must support EIP-1898 canonical hash reads; retry with a supported endpoint and a canonical block. No block-number fallback was attempted.`);
    }
    if (typeof result !== 'string' || !/^0x(?:[0-9a-fA-F]{2})*$/.test(result)) throw new Error(`CANONICAL_STATE_READ_BLOCKED: ${method} returned malformed bytes.`);
    return result;
  };
  return Object.freeze({
    blockNumber: block.number, blockHash: at.blockHash, at,
    async getCode(address, tag) { sameReference(tag); return request('eth_getCode', [getAddress(address)]); },
    async getStorage(address, slot, tag) {
      sameReference(tag);
      const value = BigInt(slot);
      if (value < 0n || value >= (1n << 256n)) throw new Error('Invalid storage slot.');
      const result = await request('eth_getStorageAt', [getAddress(address), toQuantity(value)]);
      if (result.length !== 66) throw new Error('CANONICAL_STATE_READ_BLOCKED: storage reply must contain one full word.');
      return result;
    },
    contract(address, abi) {
      const target = getAddress(address), iface = new Interface(abi);
      const contract = { getAddress: async () => target };
      for (const fragment of iface.fragments) {
        if (fragment.type !== 'function' || !['view', 'pure'].includes(fragment.stateMutability)) continue;
        const method = async (...args) => {
          if (args.length === fragment.inputs.length + 1) {
            const overrides = args.pop();
            if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides) || Object.keys(overrides).some(k => k !== 'blockTag')) throw new Error('Only a canonical blockTag override is allowed for read-only calls.');
            sameReference(overrides.blockTag);
          }
          if (args.length !== fragment.inputs.length) throw new Error('Incorrect read-only contract argument count.');
          const data = iface.encodeFunctionData(fragment, args);
          // An explicit inert caller also prevents provider middleware from
          // resolving an unlocked default account for a read-only call.
          const result = iface.decodeFunctionResult(fragment, await request('eth_call', [{ to: target, data, from: ZeroAddress }]));
          return result.length === 1 ? result[0] : result;
        };
        contract[fragment.format('sighash')] = method;
        // Callers use unambiguous view getter names; overloads require signatures.
        if (!Object.hasOwn(contract, fragment.name)) contract[fragment.name] = method;
        else contract[fragment.name] = undefined;
      }
      return Object.freeze(contract);
    },
  });
}

module.exports = { canonicalReference, createCanonicalReader };
