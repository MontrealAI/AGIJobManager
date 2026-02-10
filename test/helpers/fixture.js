const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockResolver = artifacts.require("MockResolver");
const MockERC721 = artifacts.require("MockERC721");

const { buildInitConfig } = require("./deploy");
const { rootNode, setNameWrapperOwnership } = require("./ens");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];

async function deployFixture(accounts) {
  const [owner, employer, agent, validator1, validator2, validator3] = accounts;
  const token = await MockERC20.new({ from: owner });
  const ens = await MockENS.new({ from: owner });
  const nameWrapper = await MockNameWrapper.new({ from: owner });
  const resolver = await MockResolver.new({ from: owner });
  const agiTypeNft = await MockERC721.new({ from: owner });

  const clubRoot = rootNode("club-root");
  const agentRoot = rootNode("agent-root");

  const manager = await AGIJobManager.new(
    ...buildInitConfig(
      token.address,
      "ipfs://base",
      ens.address,
      nameWrapper.address,
      clubRoot,
      agentRoot,
      clubRoot,
      agentRoot,
      ZERO_ROOT,
      ZERO_ROOT
    ),
    { from: owner }
  );

  await manager.addAGIType(agiTypeNft.address, 92, { from: owner });
  await agiTypeNft.mint(agent, { from: owner });

  await setNameWrapperOwnership(nameWrapper, agentRoot, "agent", agent);
  await setNameWrapperOwnership(nameWrapper, clubRoot, "validator1", validator1);
  await setNameWrapperOwnership(nameWrapper, clubRoot, "validator2", validator2);
  await setNameWrapperOwnership(nameWrapper, clubRoot, "validator3", validator3);

  return {
    owner,
    employer,
    agent,
    validator1,
    validator2,
    validator3,
    token,
    ens,
    nameWrapper,
    resolver,
    agiTypeNft,
    manager,
    clubRoot,
    agentRoot,
    EMPTY_PROOF,
  };
}

module.exports = { deployFixture, EMPTY_PROOF };
