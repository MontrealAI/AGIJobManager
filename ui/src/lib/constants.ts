export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 1);
export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_AGI_JOB_MANAGER_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`;
export const AGI_TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_AGI_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`;
export const EXPLORER = process.env.NEXT_PUBLIC_EXPLORER_BASE_URL || 'https://etherscan.io';

export const OFFICIAL_DEPLOYMENT = {
  releaseTag: 'v0.1.0-mainnet-beta',
  chainId: 1,
  deployer: '0x6c8B8897Fb6b08B4070387233B89b3E9A94eD00E',
  finalOwner: '0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201',
  deploymentBlock: 24522684,
  addresses: {
    AGIJobManager: '0xB3AAeb69b630f0299791679c063d68d6687481d1',
    UriUtils: '0x2c6359D42173aaC73Ea053b37c411f7Da44d4706',
    TransferUtils: '0x1e26d8F8E2E4957a06d38Ab046CF64E5d308970f',
    BondMath: '0x0c2a50a9C1db998707662db2A13B93175c3E7394',
    ReputationMath: '0x4F64e44a3693489289B1F20D55CF56130fE66C0b',
    ENSOwnership: '0x6852a13650F5c90342663c9fF7555f97F62515c8'
  },
  compiler: {
    version: '0.8.23',
    optimizerRuns: 40,
    evmVersion: 'shanghai',
    viaIR: false,
    metadataBytecodeHash: 'none',
    revertStrings: 'strip'
  }
} as const;
