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
) {
  return [
    token,
    baseIpfsUrl,
    [ens, nameWrapper],
    [clubRootNode, agentRootNode, alphaClubRootNode, alphaAgentRootNode],
    [validatorMerkleRoot, agentMerkleRoot],
  ];
}

module.exports = { buildInitConfig };
