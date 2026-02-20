function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function redactAddress(address) {
  if (!address || typeof address !== 'string' || !address.startsWith('0x') || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatEthWei(wei, web3) {
  try {
    return web3.utils.fromWei(String(wei), 'ether');
  } catch (_) {
    return String(wei);
  }
}

module.exports = {
  pretty,
  redactAddress,
  formatEthWei,
};
