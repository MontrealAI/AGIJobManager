async function fundValidators(token, manager, validators, owner, multiplier = 5) {
  const bondMax = await manager.validatorBondMax();
  const amount = bondMax.muln(multiplier);
  for (const validator of validators) {
    await token.mint(validator, amount, { from: owner });
    await token.approve(manager.address, amount, { from: validator });
  }
  return bondMax;
}

async function resolveAgentBond(manager) {
  if (manager.agentBond) {
    return manager.agentBond();
  }
  return web3.utils.toBN(web3.utils.toWei("1"));
}

async function fundAgents(token, manager, agents, owner, multiplier = 5) {
  const bond = await resolveAgentBond(manager);
  const maxBond = web3.utils.toBN(web3.utils.toWei("200"));
  let seedBond = maxBond;
  if (seedBond.lt(bond)) seedBond = bond;
  if (seedBond.isZero()) return seedBond;
  const amount = seedBond.muln(multiplier);
  for (const agent of agents) {
    await token.mint(agent, amount, { from: owner });
    await token.approve(manager.address, amount, { from: agent });
  }
  return seedBond;
}

async function computeValidatorBond(manager, payout) {
  const [bps, min, max] = await Promise.all([
    manager.validatorBondBps(),
    manager.validatorBondMin(),
    manager.validatorBondMax(),
  ]);
  let bond = payout.mul(bps).divn(10000);
  if (bond.lt(min)) bond = min;
  if (bond.gt(max)) bond = max;
  if (bond.gt(payout)) bond = payout;
  return bond;
}

async function computeAgentBond(manager, payout) {
  const minBond = await resolveAgentBond(manager);
  const maxBond = web3.utils.toBN(web3.utils.toWei("200"));
  let bond = payout.muln(500).divn(10000);
  if (bond.lt(minBond)) bond = minBond;
  if (bond.gt(maxBond)) bond = maxBond;
  if (bond.gt(payout)) bond = payout;
  return bond;
}

module.exports = { fundValidators, fundAgents, computeValidatorBond, computeAgentBond };
