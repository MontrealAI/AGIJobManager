const ZERO_BYTES32 = `0x${'00'.repeat(32)}`;

function namehash(name, web3) {
  const labels = String(name || '')
    .trim()
    .toLowerCase()
    .split('.')
    .filter(Boolean);

  let node = ZERO_BYTES32;
  for (let i = labels.length - 1; i >= 0; i -= 1) {
    const labelHash = web3.utils.keccak256(labels[i]);
    node = web3.utils.soliditySha3({ type: 'bytes32', value: node }, { type: 'bytes32', value: labelHash });
  }
  return node;
}

module.exports = {
  ZERO_BYTES32,
  namehash,
};
