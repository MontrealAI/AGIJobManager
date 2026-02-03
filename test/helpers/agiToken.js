const {
  AGI_TOKEN_ADDRESS,
  CLUB_ROOT_NODE,
  AGENT_ROOT_NODE,
  ALPHA_CLUB_ROOT_NODE,
  ALPHA_AGENT_ROOT_NODE,
} = require("./constants");

function pad32(value) {
  return web3.utils.padLeft(value, 64);
}

function rpc(method, params) {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      { jsonrpc: "2.0", id: Date.now(), method, params },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result ? result.result : null);
      }
    );
  });
}

async function setAccountCode(address, bytecode) {
  await rpc("evm_setAccountCode", [address, bytecode]);
}

async function setStorageAt(address, position, value) {
  const slot = typeof position === "number" ? pad32(web3.utils.numberToHex(position)) : position;
  const storedValue = pad32(value);
  await rpc("evm_setAccountStorageAt", [address, slot, storedValue]);
}

function mappingSlot(types, values) {
  return web3.utils.keccak256(web3.eth.abi.encodeParameters(types, values));
}

function balanceSlot(address) {
  return mappingSlot(["address", "uint256"], [address, 0]);
}

function allowanceSlot(owner, spender) {
  const outer = mappingSlot(["address", "uint256"], [owner, 1]);
  return mappingSlot(["address", "bytes32"], [spender, outer]);
}

async function resetErc20Storage(address, accounts) {
  for (let slot = 0; slot <= 10; slot += 1) {
    await setStorageAt(address, slot, "0x0");
  }

  for (const account of accounts) {
    await setStorageAt(address, balanceSlot(account), "0x0");
  }

  for (const owner of accounts) {
    for (const spender of accounts) {
      await setStorageAt(address, allowanceSlot(owner, spender), "0x0");
    }
  }
}

async function setupAgiToken(artifact, accounts) {
  const runtimeBytecode =
    artifact.deployedBytecode ||
    artifact?._json?.deployedBytecode ||
    artifact?._json?.evm?.deployedBytecode?.object;
  if (!runtimeBytecode) {
    throw new Error(`Missing deployed bytecode for ${artifact?.contractName || "token"}`);
  }
  const bytecode = runtimeBytecode.startsWith("0x") ? runtimeBytecode : `0x${runtimeBytecode}`;
  await setAccountCode(AGI_TOKEN_ADDRESS, bytecode);
  await resetErc20Storage(AGI_TOKEN_ADDRESS, accounts);
  return artifact.at(AGI_TOKEN_ADDRESS);
}

module.exports = {
  setupAgiToken,
  resetErc20Storage,
  AGI_TOKEN_ADDRESS,
  CLUB_ROOT_NODE,
  AGENT_ROOT_NODE,
  ALPHA_CLUB_ROOT_NODE,
  ALPHA_AGENT_ROOT_NODE,
};
