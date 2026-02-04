async function fundValidators(token, manager, validators, owner, multiplier = 5) {
  const bond = await manager.validatorBond();
  const amount = bond.muln(multiplier);
  for (const validator of validators) {
    await token.mint(validator, amount, { from: owner });
    await token.approve(manager.address, amount, { from: validator });
  }
  return bond;
}

module.exports = { fundValidators };
