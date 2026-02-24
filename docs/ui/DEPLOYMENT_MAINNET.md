# Mainnet Deployment Registry

- Generated at: 2026-02-23T22:52:37.680Z
- Source artifacts:
  - hardhat/deployments/mainnet/deployment.1.24522684.json
  - hardhat/deployments/mainnet/verify-targets.json
  - hardhat/deployments/mainnet/solc-input.json

## Official release

- Release tag: v0.1.0-mainnet-beta
- Chain ID: 1
- Deployer: 0x6c8B8897Fb6b08B4070387233B89b3E9A94eD00E
- Final owner: 0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201
- AGIJobManager: 0xB3AAeb69b630f0299791679c063d68d6687481d1
- Deployment block: 24522684

## Linked libraries

| Library | Address |
| --- | --- |
| UriUtils | 0x2c6359D42173aaC73Ea053b37c411f7Da44d4706 |
| TransferUtils | 0x1e26d8F8E2E4957a06d38Ab046CF64E5d308970f |
| BondMath | 0x0c2a50a9C1db998707662db2A13B93175c3E7394 |
| ReputationMath | 0x4F64e44a3693489289B1F20D55CF56130fE66C0b |
| ENSOwnership | 0x6852a13650F5c90342663c9fF7555f97F62515c8 |

## Constructor arguments

```json
{
  "agiTokenAddress": "0xa61a3b3a130a9c20768eebf97e21515a6046a1fa",
  "baseIpfsUrl": "https://ipfs.io/ipfs/",
  "ensConfig": [
    "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
    "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401"
  ],
  "rootNodes": [
    "0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16",
    "0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d",
    "0x6487f659ec6f3fbd424b18b685728450d2559e4d68768393f9c689b2b6e5405e",
    "0xc74b6c5e8a0d97ed1fe28755da7d06a84593b4de92f6582327bc40f41d6c2d5e"
  ],
  "merkleRoots": [
    "0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b",
    "0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b"
  ]
}
```

## Verification

- solc: 0.8.23
- optimizer: enabled=true, runs=40
- evmVersion: shanghai
- viaIR: false
- metadata.bytecodeHash: none
- debug.revertStrings: strip

## Verify targets

| Name | FQN | Address |
| --- | --- | --- |
| UriUtils | contracts/utils/UriUtils.sol:UriUtils | 0x2c6359D42173aaC73Ea053b37c411f7Da44d4706 |
| TransferUtils | contracts/utils/TransferUtils.sol:TransferUtils | 0x1e26d8F8E2E4957a06d38Ab046CF64E5d308970f |
| BondMath | contracts/utils/BondMath.sol:BondMath | 0x0c2a50a9C1db998707662db2A13B93175c3E7394 |
| ReputationMath | contracts/utils/ReputationMath.sol:ReputationMath | 0x4F64e44a3693489289B1F20D55CF56130fE66C0b |
| ENSOwnership | contracts/utils/ENSOwnership.sol:ENSOwnership | 0x6852a13650F5c90342663c9fF7555f97F62515c8 |
| AGIJobManager | contracts/AGIJobManager.sol:AGIJobManager | 0xB3AAeb69b630f0299791679c063d68d6687481d1 |
