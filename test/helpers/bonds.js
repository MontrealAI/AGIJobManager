const AGENT_BOND_BPS = 100;
const AGENT_BOND_MAX = web3.utils.toBN(web3.utils.toWei("200"));

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
  return web3.utils.toBN(await manager.agentBond());
}

async function fundAgents(token, manager, agents, owner, multiplier = 5) {
  const maxPayout = web3.utils.toBN(await manager.maxJobPayout());
  const bond = await computeAgentBond(manager, maxPayout);
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
  if (bond.isZero() && !payout.isZero()) bond = web3.utils.toBN("1");
  return bond;
}

async function computeAgentBond(manager, payout) {
  const minBond = await resolveAgentBond(manager);
  if (AGENT_BOND_BPS === 0 && minBond.isZero() && AGENT_BOND_MAX.isZero()) {
    return web3.utils.toBN("0");
  }
  let bond = payout.muln(AGENT_BOND_BPS).divn(10000);
  if (bond.lt(minBond)) bond = minBond;
  if (bond.gt(AGENT_BOND_MAX)) bond = AGENT_BOND_MAX;
  if (bond.gt(payout)) bond = payout;
  return bond;
}

module.exports = { fundValidators, fundAgents, computeValidatorBond, computeAgentBond };
