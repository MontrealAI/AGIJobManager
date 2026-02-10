const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockERC721 = artifacts.require("MockERC721");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");

const { buildInitConfig } = require("./deploy");
const { computeAgentBond, computeValidatorBond, computeDisputeBond } = require("./bonds");

const ZERO32 = "0x" + "00".repeat(32);

async function deployMainnetFixture(accounts) {
  const [owner] = accounts;
  const token = await MockERC20.new({ from: owner });
  const ens = await MockENS.new({ from: owner });
  const nameWrapper = await MockNameWrapper.new({ from: owner });
  const nft = await MockERC721.new({ from: owner });

  const manager = await AGIJobManager.new(
    ...buildInitConfig(
      token.address,
      "ipfs://base",
      ens.address,
      nameWrapper.address,
      ZERO32,
      ZERO32,
      ZERO32,
      ZERO32,
      ZERO32,
      ZERO32
    ),
    { from: owner }
  );

  await manager.addAGIType(nft.address, 80, { from: owner });

  return { token, ens, nameWrapper, nft, manager };
}

async function seedAgent({ owner, agent, token, nft, manager }) {
  await nft.mint(agent, { from: owner });
  await manager.addAdditionalAgent(agent, { from: owner });
  const maxPayout = web3.utils.toBN(await manager.maxJobPayout());
  const durationLimit = web3.utils.toBN(await manager.jobDurationLimit());
  const requiredBond = await computeAgentBond(manager, maxPayout, durationLimit);
  await token.mint(agent, requiredBond.muln(2), { from: owner });
  await token.approve(manager.address, requiredBond.muln(2), { from: agent });
}

async function seedValidator({ owner, validator, token, manager }) {
  await manager.addAdditionalValidator(validator, { from: owner });
  const maxPayout = web3.utils.toBN(await manager.maxJobPayout());
  const bond = await computeValidatorBond(manager, maxPayout);
  await token.mint(validator, bond.muln(3), { from: owner });
  await token.approve(manager.address, bond.muln(3), { from: validator });
}

async function createJob({ owner, employer, token, manager, payout, duration = 1000, uri = "job-spec" }) {
  await token.mint(employer, payout, { from: owner });
  await token.approve(manager.address, payout, { from: employer });
  const tx = await manager.createJob(uri, payout, duration, "details", { from: employer });
  return tx.logs[0].args.jobId.toNumber();
}

async function fundDisputant({ owner, disputant, token, manager, payout }) {
  const bond = await computeDisputeBond(manager, web3.utils.toBN(payout));
  await token.mint(disputant, bond, { from: owner });
  await token.approve(manager.address, bond, { from: disputant });
  return bond;
}

module.exports = {
  deployMainnetFixture,
  seedAgent,
  seedValidator,
  createJob,
  fundDisputant,
};
