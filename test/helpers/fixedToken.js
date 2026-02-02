const { toBN } = web3.utils;

const AGI_TOKEN_ADDRESS = "0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA";

function sendRpc(method, params = []) {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        id: toBN(Date.now()).toString(),
        method,
        params,
      },
      (error, result) => {
        if (error) return reject(error);
        if (result && result.error) return reject(result.error);
        return resolve(result.result);
      },
    );
  });
}

async function setAccountCode(address, bytecode) {
  const code = bytecode.startsWith("0x") ? bytecode : `0x${bytecode}`;
  try {
    await sendRpc("evm_setAccountCode", [address, code]);
  } catch (error) {
    await sendRpc("hardhat_setCode", [address, code]);
  }
}

async function snapshot() {
  return sendRpc("evm_snapshot");
}

async function revertSnapshot(id) {
  await sendRpc("evm_revert", [id]);
}

async function setFixedTokenCode(artifact) {
  await setAccountCode(AGI_TOKEN_ADDRESS, artifact.deployedBytecode);
  return artifact.at(AGI_TOKEN_ADDRESS);
}

async function createFixedTokenManager(defaultArtifact) {
  let snapshotId;

  async function reset(artifact = defaultArtifact) {
    if (snapshotId) {
      await revertSnapshot(snapshotId);
    }
    await setFixedTokenCode(artifact);
    snapshotId = await snapshot();
    return artifact.at(AGI_TOKEN_ADDRESS);
  }

  return { reset };
}

module.exports = {
  AGI_TOKEN_ADDRESS,
  createFixedTokenManager,
  setFixedTokenCode,
};
