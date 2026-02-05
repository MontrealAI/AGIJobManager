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

async function resolveAgentBondParams(manager) {
  const [bond, bps, max, jobDurationLimit, maxJobPayout] = await Promise.all([
    manager.agentBond(),
    manager.agentBondBps(),
    manager.agentBondMax(),
    manager.jobDurationLimit(),
    manager.maxJobPayout(),
  ]);
  return {
    bond: web3.utils.toBN(bond),
    bps: web3.utils.toBN(bps),
    max: web3.utils.toBN(max),
    jobDurationLimit: web3.utils.toBN(jobDurationLimit),
    maxJobPayout: web3.utils.toBN(maxJobPayout),
  };
}

async function fundAgents(token, manager, agents, owner, multiplier = 5) {
  const { maxJobPayout, jobDurationLimit } = await resolveAgentBondParams(manager);
  const bond = await computeAgentBond(manager, maxJobPayout, jobDurationLimit);
  const amount = bond.muln(multiplier || 1);
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
  if (bps.eq(web3.utils.toBN(0)) && min.eq(web3.utils.toBN(0)) && max.eq(web3.utils.toBN(0))) {
    return web3.utils.toBN(0);
  }
  let bond = payout.mul(bps).divn(10000);
  if (bond.lt(min)) bond = min;
  if (bond.gt(max)) bond = max;
  if (bond.gt(payout)) bond = payout;
  return bond;
}

async function computeAgentBond(manager, payout, duration) {
  const { bond, bps, max, jobDurationLimit } = await resolveAgentBondParams(manager);
  if (bps.eq(web3.utils.toBN(0)) && bond.eq(web3.utils.toBN(0)) && max.eq(web3.utils.toBN(0))) {
    return web3.utils.toBN(0);
  }
  let computed = payout.mul(bps).divn(10000);
  if (computed.lt(bond)) computed = bond;
  if (!max.eq(web3.utils.toBN(0)) && computed.gt(max)) computed = max;
  if (jobDurationLimit.gt(web3.utils.toBN(0))) {
    const usedDuration = duration ? web3.utils.toBN(duration) : web3.utils.toBN(0);
    computed = computed.mul(jobDurationLimit.add(usedDuration)).div(jobDurationLimit);
  }
  if (!max.eq(web3.utils.toBN(0)) && computed.gt(max)) computed = max;
  if (computed.gt(payout)) computed = payout;
  return computed;
}

module.exports = {
  fundValidators,
  fundAgents,
  computeValidatorBond,
  computeAgentBond,
  resolveAgentBondParams,
};
