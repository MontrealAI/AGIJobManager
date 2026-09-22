// Generated from config/usdc-deployment.json. Never infer deployment from historical receipts.
export const OFFICIAL_DEPLOYMENTS = {
  "version": "1.9.0",
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
  "note": "Software release only; no live USDC manager is recorded here. v1.9.0 uses operator-budget admission for new work, with no new review retainers. Existing escrow credits and refunds remain recoverable. Existing manager behavior, ABI, payout rules and eight fixed library links remain unchanged. Complete independent contract review, observed economic evidence and deployment-specific commissioning before authorizing intake. The manual console does not enforce private pre-funding or economic admission policies.",
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
    "defaultRequired": false,
    "snapshot": "job-posting",
    "collectionChanges": "zero outstanding escrow and bonds",
    "payoutEffect": "none"
  }
} as const;
