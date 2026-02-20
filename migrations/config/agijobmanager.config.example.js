/**
 * AGIJobManager production deployment config.
 *
 * VERIFY BEFORE MAINNET: placeholder defaults are convenience values only.
 */
module.exports = {
  defaults: {
    identity: {
      // VERIFY BEFORE MAINNET
      agiTokenAddress: '0xA61a3B3a130a9c20768EEBF97E21515A6046a1Fa',
      baseIpfsUrl: 'https://ipfs.io/ipfs/',
      ensRegistry: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
      nameWrapper: '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401',
      ensJobPages: null,
      useEnsJobTokenURI: false,
      lockIdentityConfiguration: false,
    },
    authorizationRoots: {
      roots: {
        clubName: 'club.agi.eth',
        agentName: 'agent.agi.eth',
        alphaClubName: 'alpha.club.agi.eth',
        alphaAgentName: 'alpha.agent.agi.eth',
      },
      rootNodes: null,
    },
    merkleRoots: {
      // VERIFY BEFORE MAINNET
      validatorMerkleRoot: '0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b',
      agentMerkleRoot: '0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b',
    },
    protocolParameters: {
      requiredValidatorApprovals: null,
      requiredValidatorDisapprovals: null,
      voteQuorum: null,
      validationRewardPercentage: null,
      premiumReputationThreshold: null,
      maxJobPayout: null,
      jobDurationLimit: null,
      completionReviewPeriod: null,
      disputeReviewPeriod: null,
      challengePeriodAfterApproval: null,
      validatorBondBps: null,
      validatorBondMin: null,
      validatorBondMax: null,
      validatorSlashBps: null,
      agentBondBps: null,
      agentBondMin: null,
      agentBondMax: null,
      agentBondMinOverride: null,
    },
    dynamicLists: {
      moderators: [],
      additionalAgents: [],
      additionalValidators: [],
      blacklistedAgents: [],
      blacklistedValidators: [],
    },
    agiTypes: [
      {
        // VERIFY BEFORE MAINNET (example only)
        nftAddress: '0x130909390ac76c53986957814bde8786b8605ff3',
        payoutPercentage: 80,
      },
    ],
    operationalFlags: {
      paused: null,
      settlementPaused: null,
    },
    ownership: {
      finalOwner: null,
      requireFinalOwnerOnMainnet: true,
    },
  },
  networks: {
    mainnet: {},
    sepolia: {},
    development: {},
  },
};
