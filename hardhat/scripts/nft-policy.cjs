const { isAddress, ZeroAddress } = require('ethers');
const { fetchAgiTypes } = require('../../scripts/lib/operations');

function normalizeNftPolicy(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config) ||
      Object.keys(config).some(key => !['agentNftRequired', 'agiTypes'].includes(key)) ||
      typeof config.agentNftRequired !== 'boolean' || !Array.isArray(config.agiTypes) || config.agiTypes.length > 32) {
    throw new Error('READINESS_NFT_CONFIG must contain agentNftRequired (JSON true/false) and agiTypes (the complete registry, at most 32 entries), and no other fields.');
  }
  const seen = new Set();
  const agiTypes = config.agiTypes.map(entry => {
    if (!entry || Object.keys(entry).some(key => !['nftAddress', 'payoutPercentage'].includes(key)) ||
        !isAddress(entry.nftAddress) || entry.nftAddress.toLowerCase() === ZeroAddress ||
        !/^(?:0|[1-9]\d*)$/.test(String(entry.payoutPercentage)) || BigInt(entry.payoutPercentage) > 100n) {
      throw new Error('READINESS_NFT_CONFIG entries need a nonzero nftAddress and integer payoutPercentage score 0..100 (0 means disabled).');
    }
    const nftAddress = entry.nftAddress.toLowerCase();
    if (seen.has(nftAddress)) throw new Error('READINESS_NFT_CONFIG contains a duplicate collection.');
    seen.add(nftAddress);
    return { nftAddress, payoutPercentage: String(entry.payoutPercentage) };
  }).sort((a, b) => a.nftAddress.localeCompare(b.nftAddress));
  if (config.agentNftRequired && !agiTypes.some(entry => BigInt(entry.payoutPercentage) > 0n)) {
    throw new Error('NFTs are required but no collection is enabled. Register a reviewed ERC-721 collection before activation, or explicitly choose agentNftRequired: false for future jobs.');
  }
  return { agentNftRequired: config.agentNftRequired, agiTypes };
}

async function checkNftPolicy(manager, expected, calls) {
  const [agentNftRequired, agiTypes] = await Promise.all([manager.agentNftRequired(calls), fetchAgiTypes(manager, calls)]);
  const observed = normalizeNftPolicy({ agentNftRequired, agiTypes });
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    throw new Error('On-chain NFT policy differs from READINESS_NFT_CONFIG. Review the default and every registry entry, including disabled collections; no readiness report was written.');
  }
  return observed;
}

module.exports = { normalizeNftPolicy, checkNftPolicy };
