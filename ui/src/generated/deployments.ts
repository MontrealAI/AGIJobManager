// Generated from config/usdc-deployment.json and the dated deployment records. Never infer transaction defaults from these records.
export const OFFICIAL_DEPLOYMENTS = {
  "version": "1.20.1",
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
  "note": "Software package; no transaction target is selected by default. The latest reported Manager deployment is recorded on 2026-10-17 in config/mainnet/manager-8815-2026-10-17.json; its authority snapshot reports paused intake. This owner-reported record is not live state or paid-intake qualification and does not establish an ENS helper attachment. The October 10 ENS-connected instance is historical and separate. Public-input work, no new review retainers, existing credits/claims and deployed contract behavior remain unchanged.",
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

// Historical display only; never a transaction default.
export const RECORDED_MAINNET_INSTANCE = {
  "chainId": 1,
  "manager": "0xCFA78f9980eA9B55c705B3E44467baE383cE1fA7",
  "helper": "0x6EE7A600C56C1Bfd12c482190d5dAbDD7194CDBC",
  "namespace": "usdc.jobs.agi.eth",
  "block": 26165026,
  "blockHash": "0x6d9d1af91485b6e1567cea4f905087051b3beb921024e90b4573b5361d814fa3",
  "recordDate": "2026-10-10",
  "activation": "HOLD_INTAKE_ACTIVATION"
} as const;

// Latest owner-reported display only; not a live observation or transaction default.
export const LATEST_REPORTED_MAINNET_INSTANCE = {
  "chainId": 1,
  "manager": "0x3a9B3A0712e066de4265404Fa5ff4171fE29a3F8",
  "recordDate": "2026-10-17",
  "sourceCommit": "8815ed3181778664595f951befd672afbd7a9352",
  "block": 26214525,
  "blockHash": "0xcf2dd7ad97c9499d813206a1c87bc492ae78b3ac0eb6ad4ce30bd3b5bb87cde1",
  "owner": "0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99",
  "intakePaused": true,
  "contractCount": 9,
  "exactMatches": 6,
  "retainedSimilarMatches": 3,
  "recordPath": "config/mainnet/manager-8815-2026-10-17.json",
  "guidePath": "docs/deployments/MAINNET_MANAGER_2026-10-17.md",
  "evidenceRevision": "d5d4ad93f00a3dfe6439b0f32edb1a2fcf70e0c2",
  "managerCodeUrl": "https://etherscan.io/address/0x3a9B3A0712e066de4265404Fa5ff4171fE29a3F8#code"
} as const;
