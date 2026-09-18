// Generated from config/usdc-deployment.json. Never infer deployment from historical receipts.
export const OFFICIAL_DEPLOYMENTS = {
  "version": "1.0.0",
  "status": "deployment-required",
  "chainId": 1,
  "explorerBaseUrl": "https://etherscan.io",
  "baseIpfsUrl": "https://ipfs.io/ipfs/",
  "managerAddress": "",
  "ensJobPagesAddress": "",
  "finalOwner": "",
  "usdc": {
    "symbol": "USDC",
    "decimals": 6,
    "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  },
  "addressSource": "https://developers.circle.com/stablecoins/usdc-contract-addresses",
  "note": "Software release only; no live USDC manager is recorded here. v1.0.0 retains the v0.9.6 manager ABI and executable bytecode and uses eight fixed linked libraries. A verified v0.9.6 or v0.9.7 instance can use this console; older incompatible managers require a fresh deployment to gain these features. Preserve existing jobs on their original manager and namespace. Verify accepted ownership, both recipients, ENS wiring and READINESS_NFT_CONFIG before opening intake. A fresh manager requires NFTs but has no registered collections: register reviewed collections or explicitly disable the requirement. Initial activation requires zero escrow, bonds and pending claims. Later recipient and NFT collection changes require zero live escrow and bonds; old claims retain their beneficiary.",
  "settlementWallets": {
    "wallet30": "",
    "wallet10": ""
  },
  "settlement": {
    "wallet30Percentage": 30,
    "wallet10Percentage": 10,
    "defaultValidatorPercentage": 8,
    "validatorRateSnapshot": "job-posting",
    "agent": "remaining balance"
  },
  "nftPolicy": {
    "defaultRequired": true,
    "snapshot": "job-posting",
    "collectionChanges": "zero outstanding escrow and bonds",
    "payoutEffect": "none"
  }
} as const;
