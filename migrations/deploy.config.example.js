/**
 * AGIJobManager production deployment config template.
 *
 * VERIFY BEFORE MAINNET:
 * - all addresses
 * - merkle roots
 * - role lists
 * - owner handoff target
 */
module.exports = {
  networks: {
    mainnet: {
      // Legacy-derived defaults (VERIFY BEFORE MAINNET)
      identity: {
        agiTokenAddress: '0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA',
        baseIpfsUrl: 'https://ipfs.io/ipfs/',
        ensRegistry: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
        nameWrapper: '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401',
      },

      // Preferred operator format: ENS names (namehash computed in migration)
      authRoots: {
        roots: {
          club: 'club.agi.eth',
          agent: 'agent.agi.eth',
          alphaClub: 'alpha.club.agi.eth',
          alphaAgent: 'alpha.agent.agi.eth',
        },
        // Optional explicit bytes32 nodes (if set, these override roots.*)
        rootNodes: null,
      },

      merkleRoots: {
        validatorMerkleRoot: '0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b',
        agentMerkleRoot: '0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b',
      },

      // Contract-default values are null (no setter tx). Set explicit values to override.
      parameters: {
        requiredValidatorApprovals: null,
        requiredValidatorDisapprovals: null,
        voteQuorum: null,
        validationRewardPercentage: null,
        premiumReputationThreshold: null,
        maxJobPayout: null,
        jobDurationLimit: null,
        completionReviewPeriod: null, // supports number (seconds) OR strings like "7d"
        disputeReviewPeriod: null, // supports "14d"
        challengePeriodAfterApproval: null, // supports "1d"
        validatorBondBps: null,
        validatorBondMin: null,
        validatorBondMax: null,
        validatorSlashBps: null,
        agentBondBps: null,
        agentBondMin: null,
        agentBondMax: null,
        agentBond: null,
      },

      roles: {
        moderators: [],
        additionalAgents: [],
        additionalValidators: [],
        blacklistedAgents: [],
        blacklistedValidators: [],
      },

      agiTypes: [
        {
          enabled: true,
          label: 'AIMYTHICAL NFT (example gate)',
          nftAddress: '0x130909390ac76c53986957814bde8786b8605ff3',
          payoutPercentage: 80,
        },
      ],

      operationalFlags: {
        paused: false,
        settlementPaused: false,
      },

      postDeployIdentity: {
        ensJobPages: null,
        useEnsJobTokenURI: null,
        lockIdentityConfiguration: false,
      },

      ownership: {
        transferTo: null, // e.g. multisig
      },
    },

    // Example non-mainnet profile.
    sepolia: {
      identity: {
        agiTokenAddress: '0x0000000000000000000000000000000000000001',
        baseIpfsUrl: 'https://ipfs.io/ipfs/',
        ensRegistry: '0x0000000000000000000000000000000000000000',
        nameWrapper: '0x0000000000000000000000000000000000000000',
      },
      authRoots: {
        // Keep explicit zero nodes with zero ENS wiring for sample non-mainnet dry-runs.
        rootNodes: {
          clubRootNode: '0x0000000000000000000000000000000000000000000000000000000000000000',
          agentRootNode: '0x0000000000000000000000000000000000000000000000000000000000000000',
          alphaClubRootNode: '0x0000000000000000000000000000000000000000000000000000000000000000',
          alphaAgentRootNode: '0x0000000000000000000000000000000000000000000000000000000000000000',
        },
      },
      merkleRoots: {
        validatorMerkleRoot: '0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b',
        agentMerkleRoot: '0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b',
      },
      parameters: {},
      roles: {
        moderators: [],
        additionalAgents: [],
        additionalValidators: [],
        blacklistedAgents: [],
        blacklistedValidators: [],
      },
      agiTypes: [],
      operationalFlags: {
        paused: false,
        settlementPaused: false,
      },
      postDeployIdentity: {
        ensJobPages: null,
        useEnsJobTokenURI: null,
        lockIdentityConfiguration: false,
      },
      ownership: {
        transferTo: null,
      },
    },
  },
};
