const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockResolver = artifacts.require("MockResolver");

const ZERO_ROOT = "0x" + "00".repeat(32);
const AGI_TOKEN_ADDRESS = "0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA";
const CLUB_ROOT_NODE = "0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16";
const AGENT_ROOT_NODE = "0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d";

async function setAccountCode(address, bytecode) {
  await new Promise((resolve, reject) => {
    web3.currentProvider.send(
      { jsonrpc: "2.0", id: Date.now(), method: "evm_setAccountCode", params: [address, bytecode] },
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

module.exports = async function (deployer, network, accounts) {
  if (network === "development" || network === "test") {
    await deployer.deploy(MockERC20);
    await setAccountCode(AGI_TOKEN_ADDRESS, MockERC20.deployedBytecode);
    const token = await MockERC20.at(AGI_TOKEN_ADDRESS);

    await deployer.deploy(MockENS);
    const ens = await MockENS.deployed();

    await deployer.deploy(MockNameWrapper);
    const nameWrapper = await MockNameWrapper.deployed();

    await deployer.deploy(MockResolver);
    await MockResolver.deployed();

    await deployer.deploy(
      AGIJobManager,
      AGI_TOKEN_ADDRESS,
      "https://ipfs.io/ipfs/",
      ens.address,
      nameWrapper.address,
      CLUB_ROOT_NODE,
      AGENT_ROOT_NODE,
      ZERO_ROOT,
      ZERO_ROOT
    );

    const mintAmount = web3.utils.toWei("100000");
    await token.mint(accounts[0], mintAmount);
    return;
  }

  deployer.deploy(
    AGIJobManager,
    AGI_TOKEN_ADDRESS,
    "https://ipfs.io/ipfs/",
    "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
    "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401",
    CLUB_ROOT_NODE,
    AGENT_ROOT_NODE,
    "0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b",
    "0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b"
  );
};
