/**
 * Official Hardhat deployment config.
 *
 * VERIFY BEFORE MAINNET.
 * Provenance for mainnet defaults: migrations/6_deploy_agijobmanager_production_operator.js
 * with the root defaults in migrations/config/agijobmanager.config.example.js.
 */
module.exports = {
  mainnet: {
    agiTokenAddress: '0xA61a3B3a130a9c20768EEBF97E21515A6046a1Fa',
    baseIpfsUrl: 'https://ipfs.io/ipfs/',
    ensConfig: {
      ensRegistry: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
      nameWrapper: '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401',
    },
    rootNodes: {
      clubRootNode: '0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16',
      agentRootNode: '0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d',
      alphaClubRootNode: '0x6487f659ec6f3fbd424b18b685728450d2559e4d68768393f9c689b2b6e5405e',
      alphaAgentRootNode: '0xc74b6c5e8a0d97ed1fe28755da7d06a84593b4de92f6582327bc40f41d6c2d5e',
    },
    merkleRoots: {
      validatorMerkleRoot: '0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b',
      agentMerkleRoot: '0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b',
    },
    finalOwner: '',
  },
  sepolia: {
    // SET THESE BEFORE USE.
    agiTokenAddress: '0x0000000000000000000000000000000000000000',
    baseIpfsUrl: 'https://ipfs.io/ipfs/',
    ensConfig: {
      ensRegistry: '0x0000000000000000000000000000000000000000',
      nameWrapper: '0x0000000000000000000000000000000000000000',
    },
    rootNodes: {
      clubRootNode: '0x0000000000000000000000000000000000000000000000000000000000000000',
      agentRootNode: '0x0000000000000000000000000000000000000000000000000000000000000000',
      alphaClubRootNode: '0x0000000000000000000000000000000000000000000000000000000000000000',
      alphaAgentRootNode: '0x0000000000000000000000000000000000000000000000000000000000000000',
    },
    merkleRoots: {
      validatorMerkleRoot: '0x0000000000000000000000000000000000000000000000000000000000000000',
      agentMerkleRoot: '0x0000000000000000000000000000000000000000000000000000000000000000',
    },
    finalOwner: '',
  },
};
