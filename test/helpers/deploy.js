function buildInitConfig(
  token,
  baseIpfsUrl,
  ens,
  nameWrapper,
  clubRootNode,
  agentRootNode,
  alphaClubRootNode,
  alphaAgentRootNode,
  validatorMerkleRoot,
  agentMerkleRoot,
  settlementWallets = ['0x1111111111111111111111111111111111111111', '0x2222222222222222222222222222222222222222'],
) {
  return [
    token,
    baseIpfsUrl,
    [ens, nameWrapper],
    [clubRootNode, agentRootNode, alphaClubRootNode, alphaAgentRootNode],
    [validatorMerkleRoot, agentMerkleRoot],
    settlementWallets,
  ];
}

async function deployActive(Artifact, ...args) {
  const manager = await Artifact.new(...args);
  await manager.unpause({ from: await manager.owner() });
  return manager;
}

module.exports = { buildInitConfig, deployActive };
