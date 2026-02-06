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
  const bps = web3.utils.toBN("50");
  const min = web3.utils.toBN(web3.utils.toWei("1"));
  const max = web3.utils.toBN(web3.utils.toWei("200"));
  let bond = payout.mul(bps).divn(10000);
  if (bond.lt(min)) bond = min;
  if (bond.gt(max)) bond = max;
  if (bond.gt(payout)) bond = payout;
  return bond;
}

async function fundDisputeBond(token, manager, disputant, payout, owner) {
  const bond = await computeDisputeBond(manager, payout);
  await token.mint(disputant, bond, { from: owner });
  await token.approve(manager.address, bond, { from: disputant });
  return bond;
}

async function computeAgentBond(manager, payout, duration) {
  const [agentBondBps, agentBond, agentBondMax] = await Promise.all([
    manager.agentBondBps(),
    manager.agentBond(),
    manager.agentBondMax(),
  ]);
  const durationLimit = web3.utils.toBN(await manager.jobDurationLimit());
  if (agentBondBps.isZero() && agentBond.isZero() && agentBondMax.isZero()) {
    return web3.utils.toBN("0");
  }
  let bond = payout.mul(agentBondBps).divn(10000);
  if (bond.lt(agentBond)) bond = agentBond;
  if (!durationLimit.isZero()) {
    bond = bond.add(bond.mul(duration).div(durationLimit));
  }
  if (!agentBondMax.isZero() && bond.gt(agentBondMax)) bond = agentBondMax;
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
