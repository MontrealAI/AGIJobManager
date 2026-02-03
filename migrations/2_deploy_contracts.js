const AGIJobManager = artifacts.require("AGIJobManager");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockResolver = artifacts.require("MockResolver");
const MockERC20 = artifacts.require("MockERC20");

const AGI_TOKEN_ADDRESS = "0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA";
const ZERO_ROOT = "0x" + "00".repeat(32);

function setAccountCode(address, code) {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      { jsonrpc: "2.0", method: "evm_setAccountCode", params: [address, code], id: Date.now() },
      (err, result) => {
        if (err) return reject(err);
        return resolve(result);
      }
    );
  });
}

module.exports = async function (deployer, network, accounts) {
  if (network === "development" || network === "test") {
    await deployer.deploy(MockENS);
    const ens = await MockENS.deployed();

    await deployer.deploy(MockNameWrapper);
    const nameWrapper = await MockNameWrapper.deployed();

    await deployer.deploy(MockResolver);
    await MockResolver.deployed();

    const tokenCode = MockERC20.deployedBytecode || MockERC20.bytecode;
    await setAccountCode(AGI_TOKEN_ADDRESS, tokenCode);
    const token = await MockERC20.at(AGI_TOKEN_ADDRESS);

    await deployer.deploy(
      AGIJobManager,
      "https://ipfs.io/ipfs/",
      ens.address,
      nameWrapper.address,
      ZERO_ROOT,
      ZERO_ROOT
    );

    const mintAmount = web3.utils.toWei("100000");
    await token.mint(accounts[0], mintAmount);
    return;
  }

  deployer.deploy(
    AGIJobManager,
    "https://ipfs.io/ipfs/",
    "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
    "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401",
    "0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b",
    "0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b"
  );
};
