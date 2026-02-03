const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const { buildInitConfig } = require("./helpers/deploy");
const { rootNode } = require("./helpers/ens");

const { toBN } = web3.utils;

contract("AGIJobManager deployment wiring", (accounts) => {
  const [owner] = accounts;

  it("propagates constructor wiring into storage", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });

    const clubRoot = rootNode("club-root-main");
    const agentRoot = rootNode("agent-root-main");
    const alphaClubRoot = rootNode("alpha-club-root-main");
    const alphaAgentRoot = rootNode("alpha-agent-root-main");
    const validatorMerkleRoot = web3.utils.soliditySha3({ type: "uint256", value: toBN(1) });
    const agentMerkleRoot = web3.utils.soliditySha3({ type: "uint256", value: toBN(2) });

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
        agentMerkleRoot
      ),
      { from: owner }
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
  });
});
