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
  const bondMax = await manager.agentBondMax();
  const amount = bondMax.muln(multiplier);
  for (const agent of agents) {
    await token.mint(agent, amount, { from: owner });
    await token.approve(manager.address, amount, { from: agent });
  }
  return bondMax;
}

async function computeValidatorBond(manager, payout) {
  const [bps, min, max] = await Promise.all([
    manager.validatorBondBps(),
    manager.validatorBondMin(),
    manager.validatorBondMax(),
  ]);
  if (bps.isZero() && min.isZero() && max.isZero()) {
    return web3.utils.toBN(0);
  }
  let bond = payout.mul(bps).divn(10000);
  if (bond.lt(min)) bond = min;
  if (bond.gt(max)) bond = max;
  if (bond.isZero() && payout.gt(web3.utils.toBN(0))) bond = web3.utils.toBN(1);
  if (bond.gt(payout)) bond = payout;
  return bond;
}

async function computeAgentBond(manager, payout) {
  const [bps, min, max] = await Promise.all([
    manager.agentBondBps(),
    manager.agentBondMin(),
    manager.agentBondMax(),
  ]);
  if (bps.isZero() && min.isZero() && max.isZero()) {
    return web3.utils.toBN(0);
  }
  let bond = payout.mul(bps).divn(10000);
  if (bond.lt(min)) bond = min;
  if (bond.gt(max)) bond = max;
  if (bond.isZero() && payout.gt(web3.utils.toBN(0))) bond = web3.utils.toBN(1);
  if (bond.gt(payout)) return payout;
  return bond;
}

module.exports = { fundValidators, fundAgents, computeValidatorBond, computeAgentBond, resolveAgentBond };
