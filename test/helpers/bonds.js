async function fundValidators(token, manager, validators, owner, multiplier = 5) {
  const bondMax = await manager.validatorBondMax();
  const amount = bondMax.muln(multiplier);
  for (const validator of validators) {
    await token.mint(validator, amount, { from: owner });
    await token.approve(manager.address, amount, { from: validator });
  }
  return bondMax;
}

async function fundAgents(token, manager, agents, owner, multiplier = 5) {
  const maxPayout = web3.utils.toBN(await manager.maxJobPayout());
  const durationLimit = web3.utils.toBN(await manager.jobDurationLimit());
  const bond = await computeAgentBond(manager, maxPayout, durationLimit);
  const amount = bond.muln(multiplier);
  for (const agent of agents) {
    await token.mint(agent, amount, { from: owner });
    await token.approve(manager.address, amount, { from: agent });
  }
  return bond;
}

async function computeValidatorBond(manager, payout) {
  const [bps, min, max] = await Promise.all([
    manager.validatorBondBps(),
    manager.validatorBondMin(),
    manager.validatorBondMax(),
  ]);
  if (bps.isZero() && min.isZero() && max.isZero()) {
    return web3.utils.toBN("0");
  }
  let bond = payout.mul(bps).divn(10000);
  if (bond.lt(min)) bond = min;
  if (bond.gt(max)) bond = max;
  if (bond.gt(payout)) bond = payout;
  return bond;
}

const AGENT_BOND_BPS = web3.utils.toBN(500);
const AGENT_BOND_MAX = web3.utils.toBN(web3.utils.toWei("200"));
const DISPUTE_BOND_BPS = web3.utils.toBN(100);

async function computeAgentBond(manager, payout, duration) {
  let bond = payout.mul(AGENT_BOND_BPS).divn(10000);
  const durationLimit = web3.utils.toBN(await manager.jobDurationLimit());
  if (!durationLimit.isZero()) {
    bond = bond.mul(durationLimit.add(duration)).div(durationLimit);
  }
  const floorBond = web3.utils.toBN(await manager.agentBond());
  if (bond.lt(floorBond)) bond = floorBond;
  if (bond.gt(AGENT_BOND_MAX)) bond = AGENT_BOND_MAX;
  if (bond.gt(payout)) bond = payout;
  return bond;
}

async function computeDisputeBond(manager, payout) {
  let bond = payout.mul(DISPUTE_BOND_BPS).divn(10000);
  const floorBond = web3.utils.toBN(await manager.agentBond());
  if (bond.lt(floorBond)) bond = floorBond;
  if (bond.gt(payout)) bond = payout;
  return bond;
}

module.exports = { fundValidators, fundAgents, computeValidatorBond, computeAgentBond, computeDisputeBond };
