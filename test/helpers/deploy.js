function buildInitConfig(
  token,
  baseIpfsUrl,
  ens,
  nameWrapper,
  ensJobPages,
  clubRootNode,
  agentRootNode,
  alphaClubRootNode,
  alphaAgentRootNode,
  validatorMerkleRoot,
  agentMerkleRoot,
) {
  if (agentMerkleRoot === undefined) {
    agentMerkleRoot = validatorMerkleRoot;
    validatorMerkleRoot = alphaAgentRootNode;
    alphaAgentRootNode = alphaClubRootNode;
    alphaClubRootNode = agentRootNode;
    agentRootNode = clubRootNode;
    clubRootNode = ensJobPages;
    ensJobPages = "0x0000000000000000000000000000000000000000";
  }
  return [
    token,
    baseIpfsUrl,
    [ens, nameWrapper, ensJobPages],
    [clubRootNode, agentRootNode, alphaClubRootNode, alphaAgentRootNode],
    [validatorMerkleRoot, agentMerkleRoot],
  ];
}

module.exports = { buildInitConfig };
