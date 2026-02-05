async function fundValidators(token, manager, validators, owner, multiplier = 5) {
  const bondMax = await manager.validatorBondMax();
  const amount = bondMax.muln(multiplier);
  for (const validator of validators) {
    await token.mint(validator, amount, { from: owner });
    await token.approve(manager.address, amount, { from: validator });
  }
  return bondMax;
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
  return bond;
}

async function computeAgentBond(manager, payout) {
  const [bps, min, max] = await Promise.all([
    manager.agentBondBps(),
    manager.agentBondMin(),
    manager.agentBondMax(),
  ]);
  if (bps.isZero()) {
    return payout.muln(0);
  }
  let bond = payout.mul(bps).divn(10000);
  if (bond.lt(min)) bond = min;
  if (bond.gt(max)) bond = max;
  if (bond.gt(payout)) bond = payout;
  return bond;
}

module.exports = { fundValidators, computeValidatorBond, computeAgentBond };
