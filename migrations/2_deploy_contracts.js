const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockResolver = artifacts.require("MockResolver");

const {
  ZERO_ROOT,
  ZERO_ADDRESS,
  DEFAULT_IPFS_BASE,
  buildInitConfig,
  resolveDeployConfig,
} = require("./deploy-config");

function isTrue(value) {
  return (value || "").toLowerCase() === "true";
}

module.exports = async function (deployer, network, accounts) {
  if (network === "development" || network === "test") {
    await deployer.deploy(MockERC20);
    const token = await MockERC20.deployed();

    await deployer.deploy(MockENS);
    const ens = await MockENS.deployed();

    await deployer.deploy(MockNameWrapper);
    const nameWrapper = await MockNameWrapper.deployed();

    await deployer.deploy(MockResolver);
    await MockResolver.deployed();

    await deployer.deploy(
      AGIJobManager,
      ...buildInitConfig(
        token.address,
        DEFAULT_IPFS_BASE,
        ens.address,
        nameWrapper.address,
        ZERO_ADDRESS,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT
      )
    );

    const mintAmount = web3.utils.toWei("100000");
    await token.mint(accounts[0], mintAmount);
    return;
  }

  const networkId = Number(deployer.network_id);
  const {
    tokenAddress,
    baseIpfsUrl,
    ensAddress,
    nameWrapperAddress,
    ensJobPagesAddress,
    clubRootNode,
    agentRootNode,
    alphaClubRootNode,
    alphaAgentRootNode,
    validatorMerkleRoot,
    agentMerkleRoot,
    isMainnet,
  } = resolveDeployConfig(network, networkId);

  await deployer.deploy(
    AGIJobManager,
    ...buildInitConfig(
      tokenAddress,
      baseIpfsUrl,
      ensAddress,
      nameWrapperAddress,
      ensJobPagesAddress,
      clubRootNode,
      agentRootNode,
      alphaClubRootNode,
      alphaAgentRootNode,
      validatorMerkleRoot,
      agentMerkleRoot
    )
  );

  const manager = await AGIJobManager.deployed();
  if (isTrue(process.env.LOCK_IDENTITY_CONFIG) || isTrue(process.env.LOCK_CONFIG)) {
    await manager.lockIdentityConfiguration({ from: accounts[0] });
  }

  console.log("AGIJobManager deployment summary:");
  console.log(`- network: ${network} (id ${networkId})`);
  console.log(`- token: ${tokenAddress}`);
  console.log(`- ENS registry: ${ensAddress}`);
  console.log(`- NameWrapper: ${nameWrapperAddress}`);
  console.log(`- ENS job pages: ${ensJobPagesAddress}`);
  console.log(`- club root: ${clubRootNode}`);
  console.log(`- alpha club root: ${alphaClubRootNode}`);
  console.log(`- agent root: ${agentRootNode}`);
  console.log(`- alpha agent root: ${alphaAgentRootNode}`);
  console.log(`- validator merkle root: ${validatorMerkleRoot}`);
  console.log(`- agent merkle root: ${agentMerkleRoot}`);
  console.log(`- identity config locked: ${await manager.lockIdentityConfig()}`);
};
