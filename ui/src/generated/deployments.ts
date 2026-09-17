// Generated from config/usdc-deployment.json. Never infer deployment from historical receipts.
export const OFFICIAL_DEPLOYMENTS = {
  "version": "0.5.0",
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
  "note": "Software release only. No USDC manager has been deployed or verified by this release. Existing pre-v0.5.0 deployment receipts are historical and are not USDC deployments."
} as const;
