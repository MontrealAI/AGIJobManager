const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");

const { buildInitConfig } = require("./helpers/deploy");

const { toBN } = web3.utils;

contract("AGIJobManager deployment wiring", (accounts) => {
  const [owner] = accounts;

  it("propagates constructor wiring for token, ENS, NameWrapper, roots, and Merkle roots", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });

    const clubRoot = web3.utils.soliditySha3("club-root");
    const agentRoot = web3.utils.soliditySha3("agent-root");
    const alphaClubRoot = web3.utils.soliditySha3("alpha-club-root");
    const alphaAgentRoot = web3.utils.soliditySha3("alpha-agent-root");
    const validatorMerkleRoot = web3.utils.soliditySha3("validator-root");
    const agentMerkleRoot = web3.utils.soliditySha3("agent-root");

    const manager = await AGIJobManager.new(
      ...buildInitConfig(
        token.address,
        "ipfs://base",
        ens.address,
        nameWrapper.address,
        clubRoot,
        agentRoot,
        alphaClubRoot,
        alphaAgentRoot,
        validatorMerkleRoot,
        agentMerkleRoot,
      ),
      { from: owner },
    );

    assert.equal(await manager.agiToken(), token.address);
    assert.equal(await manager.ens(), ens.address);
    assert.equal(await manager.nameWrapper(), nameWrapper.address);
    assert.equal(await manager.clubRootNode(), clubRoot);
    assert.equal(await manager.agentRootNode(), agentRoot);
    assert.equal(await manager.alphaClubRootNode(), alphaClubRoot);
    assert.equal(await manager.alphaAgentRootNode(), alphaAgentRoot);
    assert.equal(await manager.validatorMerkleRoot(), validatorMerkleRoot);
    assert.equal(await manager.agentMerkleRoot(), agentMerkleRoot);

    const tokenBalance = await token.balanceOf(manager.address);
    assert.equal(tokenBalance.toString(), toBN(0).toString());
  });

  it("keeps ENSOwnership linked in artifacts and prevents unresolved placeholders", async () => {
    const artifact = AGIJobManager._json;
    const unresolved = (artifact.deployedBytecode || "").includes("__$");
    assert.equal(unresolved, false, "deployed bytecode must not contain unresolved library placeholders");
  });

});
