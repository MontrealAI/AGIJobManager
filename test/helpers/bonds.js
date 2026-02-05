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
  const [minBond, bps, maxBond, durationLimit] = await Promise.all([
    manager.agentBond(),
    manager.agentBondBps(),
    manager.agentBondMax(),
    manager.jobDurationLimit(),
  ]);
  return { minBond: web3.utils.toBN(minBond), bps: web3.utils.toBN(bps), maxBond: web3.utils.toBN(maxBond), durationLimit: web3.utils.toBN(durationLimit) };
}

async function fundAgents(token, manager, agents, owner, multiplier = 5) {
  const { minBond, maxBond } = await resolveAgentBond(manager);
  const baseBond = maxBond.isZero() ? minBond : maxBond;
  const amount = baseBond.muln(multiplier);
  for (const agent of agents) {
    await token.mint(agent, amount, { from: owner });
    await token.approve(manager.address, amount, { from: agent });
  }
  return baseBond;
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
  if (!max.isZero() && bond.gt(max)) bond = max;
  if (bond.gt(payout)) bond = payout;
  return bond;
}

async function computeAgentBond(manager, payout) {
  const { minBond, bps, maxBond, durationLimit } = await resolveAgentBond(manager);
  const durationArg = arguments.length > 2 ? arguments[2] : null;
  const duration = durationArg ? web3.utils.toBN(durationArg) : web3.utils.toBN(0);
  if (bps.isZero() && minBond.isZero() && maxBond.isZero()) return web3.utils.toBN(0);
  let bond = payout.mul(bps).divn(10000);
  if (bond.lt(minBond)) bond = minBond;
  if (!maxBond.isZero() && bond.gt(maxBond)) bond = maxBond;
  if (!durationLimit.isZero() && !duration.isZero()) {
    bond = bond.mul(durationLimit.add(duration)).div(durationLimit);
    if (!maxBond.isZero() && bond.gt(maxBond)) bond = maxBond;
  }
  if (bond.gt(payout)) bond = payout;
  return bond;
}

module.exports = { fundValidators, fundAgents, computeValidatorBond, computeAgentBond };
