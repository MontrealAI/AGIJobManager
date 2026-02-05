async function fundValidators(token, manager, validators, owner, multiplier = 5) {
  const bondMax = await manager.validatorBondMax();
  const amount = bondMax.muln(multiplier);
  for (const validator of validators) {
    await token.mint(validator, amount, { from: owner });
    await token.approve(manager.address, amount, { from: validator });
  }
  return bondMax;
}

const AGENT_BOND_BPS = 500;

async function resolveAgentBond(manager) {
  return web3.utils.toBN(web3.utils.toWei("1"));
}

async function fundAgents(token, manager, agents, owner, multiplier = 5) {
  const [maxPayout, min] = await Promise.all([
    manager.maxJobPayout(),
    resolveAgentBond(manager),
  ]);
  let bond = maxPayout.muln(AGENT_BOND_BPS).divn(10000);
  if (bond.lt(min)) bond = min;
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
  let bond = payout.mul(bps).divn(10000);
  if (bond.lt(min)) bond = min;
  if (bond.gt(max)) bond = max;
  if (bond.gt(payout)) bond = payout;
  return bond;
}

async function computeAgentBond(manager, payout) {
  const min = await resolveAgentBond(manager);
  let bond = payout.muln(AGENT_BOND_BPS).divn(10000);
  if (bond.lt(min)) bond = min;
  if (bond.gt(payout)) return payout;
  return bond;
}

module.exports = { fundValidators, fundAgents, computeValidatorBond, computeAgentBond };
