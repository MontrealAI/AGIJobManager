const AGI_TOKEN_ADDRESS = "0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA";
const CLUB_ROOT_NODE = "0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16";
const AGENT_ROOT_NODE = "0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d";

async function sendRpc(method, params) {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      }
    );
  });
}

function deployedBytecodeFor(artifact) {
  return artifact.deployedBytecode || artifact._json?.deployedBytecode || "";
}

async function resetTokenStorage(accounts) {
  const zeroValue = "0x" + "00".repeat(32);
  for (let i = 0; i < 12; i += 1) {
    const slot = web3.utils.padLeft(web3.utils.numberToHex(i), 64);
    await sendRpc("evm_setAccountStorageAt", [AGI_TOKEN_ADDRESS, slot, zeroValue]);
  }

  for (const account of accounts) {
    const balanceSlot = web3.utils.soliditySha3(
      { type: "address", value: account },
      { type: "uint256", value: 0 }
    );
    await sendRpc("evm_setAccountStorageAt", [AGI_TOKEN_ADDRESS, balanceSlot, zeroValue]);
  }

  for (const owner of accounts) {
    const ownerBase = web3.utils.soliditySha3(
      { type: "address", value: owner },
      { type: "uint256", value: 1 }
    );
    for (const spender of accounts) {
      const allowanceSlot = web3.utils.soliditySha3(
        { type: "address", value: spender },
        { type: "bytes32", value: ownerBase }
      );
      await sendRpc("evm_setAccountStorageAt", [AGI_TOKEN_ADDRESS, allowanceSlot, zeroValue]);
    }
  }
}

async function setTokenCode(artifact) {
  const bytecode = deployedBytecodeFor(artifact);
  if (!bytecode || bytecode === "0x") {
    throw new Error(`Missing deployedBytecode for ${artifact.contractName || "token artifact"}`);
  }
  await sendRpc("evm_setAccountCode", [AGI_TOKEN_ADDRESS, bytecode]);
  const accounts = await web3.eth.getAccounts();
  await resetTokenStorage(accounts);
  return artifact.at(AGI_TOKEN_ADDRESS);
}

module.exports = {
  AGI_TOKEN_ADDRESS,
  CLUB_ROOT_NODE,
  AGENT_ROOT_NODE,
  setTokenCode,
};
