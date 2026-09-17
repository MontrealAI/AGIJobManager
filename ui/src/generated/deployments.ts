// Generated from config/usdc-deployment.json. Never infer deployment from historical receipts.
export const OFFICIAL_DEPLOYMENTS = {
  "version": "0.9.5",
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
  "note": "Software release only; no live USDC manager is recorded here. v0.9.5 buyer-protection rules require a fresh manager and eight fixed linked libraries, including JobSettlement and JobValidation. Preserve every existing job on its original manager and namespace. Verify accepted ownership, both recipients, ENS wiring and READINESS_NFT_CONFIG before opening intake. Initial activation requires zero escrow, bonds and pending claims. Later recipient and NFT collection changes require zero live escrow and bonds; old claims retain their beneficiary.",
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
