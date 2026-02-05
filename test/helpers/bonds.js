async function fundValidators(token, manager, validators, owner, multiplier = 5) {
  const [, , bondMax] = await manager.getValidatorConfig();
  const amount = bondMax.muln(multiplier);
  for (const validator of validators) {
    await token.mint(validator, amount, { from: owner });
    await token.approve(manager.address, amount, { from: validator });
  }
  return bondMax;
}

async function computeValidatorBond(manager, payout) {
  const [bps, min, max] = await manager.getValidatorConfig();
  let bond = payout.mul(bps).divn(10000);
  if (bond.lt(min)) bond = min;
  if (bond.gt(max)) bond = max;
  return bond;
}

module.exports = { fundValidators, computeValidatorBond };
