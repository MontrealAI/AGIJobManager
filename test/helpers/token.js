const { AGI_TOKEN_ADDRESS } = require("./constants");

function sendRpc(method, params) {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      { jsonrpc: "2.0", method, params, id: Date.now() },
      (err, result) => {
        if (err) return reject(err);
        return resolve(result);
      }
    );
  });
}

async function setAccountCode(address, code) {
  await sendRpc("evm_setAccountCode", [address, code]);
}

async function setAccountStorageAt(address, slot, value) {
  await sendRpc("evm_setAccountStorageAt", [address, slot, value]);
}

async function resetTokenStorage(accounts) {
  const zeroValue = "0x" + "00".repeat(32);
  for (let slot = 0; slot <= 12; slot += 1) {
    const slotHex = web3.utils.padLeft(web3.utils.toHex(slot), 64);
    await setAccountStorageAt(AGI_TOKEN_ADDRESS, slotHex, zeroValue);
  }
  if (Array.isArray(accounts)) {
    for (const account of accounts) {
      const balanceSlot = web3.utils.soliditySha3(
        { type: "address", value: account },
        { type: "uint256", value: 0 }
      );
      await setAccountStorageAt(AGI_TOKEN_ADDRESS, balanceSlot, zeroValue);
    }
  }
}

async function setupFixedToken(artifact, accounts) {
  const tokenCode = artifact.deployedBytecode || artifact.bytecode;
  await setAccountCode(AGI_TOKEN_ADDRESS, tokenCode);
  await resetTokenStorage(accounts);
  return artifact.at(AGI_TOKEN_ADDRESS);
}

module.exports = {
  setupFixedToken,
  AGI_TOKEN_ADDRESS,
};
