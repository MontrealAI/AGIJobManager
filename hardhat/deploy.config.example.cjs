// Copy to deploy.config.cjs (or set DEPLOY_CONFIG to a reviewed copy).
// Fill the owner and both settlement wallets before even a read-only deployment plan.
// New managers start with NFT admission disabled and no registered collections.
// To opt in, accept ownership, register collections and setAgentNftRequired(true), then
// verify the explicit choice with READINESS_NFT_CONFIG before unpausing.
// Membership roots identify agents/validators; they are separate from JOBS_ROOT_NAME.
const ZERO_ROOT = '0x0000000000000000000000000000000000000000000000000000000000000000';

module.exports = {
  mainnet: {
    usdcTokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    settlementWallets: ['', ''], // Required: 30% wallet, then distinct 10% wallet. Owner rotation requires paused intake and zero job escrow/bonds; pending claims retain their beneficiaries.
    baseIpfsUrl: 'https://ipfs.io/ipfs/',
    ensConfig: [
      '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
      '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401',
    ],
    rootNodes: [
      '0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16', // club.agi.eth: validators
      '0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d', // agent.agi.eth: agents
      '0x6487f659ec6f3fbd424b18b685728450d2559e4d68768393f9c689b2b6e5405e', // alpha.club.agi.eth: validators
      '0xc74b6c5e8a0d97ed1fe28755da7d06a84593b4de92f6582327bc40f41d6c2d5e', // alpha.agent.agi.eth: agents
    ],
    merkleRoots: [
      ZERO_ROOT, // validators: no Merkle exception unless an explicit reviewed list is configured
      ZERO_ROOT, // agents: no Merkle exception unless an explicit reviewed list is configured
    ],
    // Owner-managed Merkle/additional allowlist exceptions remain available after identity locking.
    finalOwner: '', // Required: reviewed governance wallet; manager ownership is accepted in two steps.
  },
  sepolia: {
    // Supply verified Sepolia ENS contracts, controlled membership roots and the intended owner.
    usdcTokenAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    settlementWallets: ['', ''], // Required: 30% wallet, then distinct 10% wallet. Owner rotation requires paused intake and zero job escrow/bonds; pending claims retain their beneficiaries.
    baseIpfsUrl: 'https://ipfs.io/ipfs/',
    ensConfig: [
      '', // Required: verified Sepolia ENS registry
      '', // Required: verified Sepolia NameWrapper, or explicit zero address if unused
    ],
    rootNodes: [
      ZERO_ROOT, // Replace with the reviewed validator root for the rehearsal
      ZERO_ROOT, // Replace with the reviewed agent root for the rehearsal
      ZERO_ROOT, // Optional alternate validator root
      ZERO_ROOT, // Optional alternate agent root
    ],
    merkleRoots: [
      ZERO_ROOT, // Optional reviewed validator exception list
      ZERO_ROOT, // Optional reviewed agent exception list
    ],
    finalOwner: '', // Required: the actual owner/signing setup used for the rehearsal
  },
};
