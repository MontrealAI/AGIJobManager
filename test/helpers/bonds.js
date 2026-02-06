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

async function computeDisputeBond(manager, payout) {
  const disputeBondBps = web3.utils.toBN(50);
  const disputeBondMin = web3.utils.toBN(web3.utils.toWei("1"));
  const disputeBondMax = web3.utils.toBN(web3.utils.toWei("88888888"));
  let bond = payout.mul(disputeBondBps).divn(10000);
  if (bond.lt(disputeBondMin)) bond = disputeBondMin;
  if (bond.gt(disputeBondMax)) bond = disputeBondMax;
  if (bond.gt(payout)) bond = payout;
  return bond;
}

async function fundDisputeBond(token, manager, disputant, payout, owner) {
  const bond = await computeDisputeBond(manager, payout);
  await token.mint(disputant, bond, { from: owner });
  await token.approve(manager.address, bond, { from: disputant });
  return bond;
}

const AGENT_BOND_BPS = web3.utils.toBN(500);
const AGENT_BOND_MAX = web3.utils.toBN("0");

async function computeAgentBond(manager, payout, duration) {
  const agentBond = web3.utils.toBN(await manager.agentBond());
  const durationLimit = web3.utils.toBN(await manager.jobDurationLimit());
  let bond = payout.mul(AGENT_BOND_BPS).divn(10000);
  if (!durationLimit.isZero()) {
    bond = bond.mul(durationLimit.add(duration)).div(durationLimit);
  }
  if (bond.lt(agentBond)) bond = agentBond;
  if (!AGENT_BOND_MAX.isZero() && bond.gt(AGENT_BOND_MAX)) bond = AGENT_BOND_MAX;
  if (bond.gt(payout)) bond = payout;
  return bond;
}

module.exports = {
  fundValidators,
  fundAgents,
  fundDisputeBond,
  computeValidatorBond,
  computeDisputeBond,
  computeAgentBond,
};
