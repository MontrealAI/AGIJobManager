# Mainnet Deployment Registry (Official)

- Generated at: 2026-02-24T14:34:59.309Z
- Source files:
  - `hardhat/deployments/mainnet/deployment.1.24522684.json`
  - `hardhat/deployments/mainnet/verify-targets.json`
  - `hardhat/deployments/mainnet/solc-input.json`

## Release

- Tag: **v0.1.0-mainnet-beta**
- Release: https://github.com/MontrealAI/AGIJobManager/releases/tag/v0.1.0-mainnet-beta
- Chain: Ethereum Mainnet (chainId = 1)

## Principals

- Deployer: `0x6c8B8897Fb6b08B4070387233B89b3E9A94eD00E`
- Final owner: `0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201`

## Deployed contracts

| Contract | Address | Block | Transaction |
|---|---|---:|---|
| UriUtils | 0x2c6359D42173aaC73Ea053b37c411f7Da44d4706 | 24522669 | [tx](https://etherscan.io/tx/0xce685b91e190938d7508af861c48d9482cc8d8e53530e42ec143940f838ac4a1) |
| TransferUtils | 0x1e26d8F8E2E4957a06d38Ab046CF64E5d308970f | 24522672 | [tx](https://etherscan.io/tx/0x4847d58a96191427c5cb2b89622fee4882f03bad4e85eff5fc1a55fc5c7fe4c3) |
| BondMath | 0x0c2a50a9C1db998707662db2A13B93175c3E7394 | 24522675 | [tx](https://etherscan.io/tx/0xbc42f0859c75fd06b62a9aa69a809b5632114b4c3711e9a45efb3f585ca02672) |
| ReputationMath | 0x4F64e44a3693489289B1F20D55CF56130fE66C0b | 24522678 | [tx](https://etherscan.io/tx/0x4ee07dcfdf8d8e4d163a9eb4c7d4f23ebd1b732516809c0c204e3f04ece6c426) |
| ENSOwnership | 0x6852a13650F5c90342663c9fF7555f97F62515c8 | 24522681 | [tx](https://etherscan.io/tx/0x0755aacc84ed3cbbf5f1177a1e7dd23abd358ba292d7b61090788efe2f164b44) |
| AGIJobManager | 0xB3AAeb69b630f0299791679c063d68d6687481d1 | 24522684 | [tx](https://etherscan.io/tx/0x5b99dc902229561d52b0f0daa7207372f12866befbdbe03a701a07c7e2690995) |

## Linked libraries

| Library | Address |
|---|---|
| `contracts/utils/UriUtils.sol:UriUtils` | 0x2c6359D42173aaC73Ea053b37c411f7Da44d4706 |
| `contracts/utils/TransferUtils.sol:TransferUtils` | 0x1e26d8F8E2E4957a06d38Ab046CF64E5d308970f |
| `contracts/utils/BondMath.sol:BondMath` | 0x0c2a50a9C1db998707662db2A13B93175c3E7394 |
| `contracts/utils/ReputationMath.sol:ReputationMath` | 0x4F64e44a3693489289B1F20D55CF56130fE66C0b |
| `contracts/utils/ENSOwnership.sol:ENSOwnership` | 0x6852a13650F5c90342663c9fF7555f97F62515c8 |

## Constructor arguments (AGIJobManager)

- agiTokenAddress: `0xa61a3b3a130a9c20768eebf97e21515a6046a1fa`
- baseIpfsUrl: `https://ipfs.io/ipfs/`
- ensConfig (address[2]):
  - `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e`
  - `0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401`
- rootNodes (bytes32[4]):
  - `0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16`
  - `0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d`
  - `0x6487f659ec6f3fbd424b18b685728450d2559e4d68768393f9c689b2b6e5405e`
  - `0xc74b6c5e8a0d97ed1fe28755da7d06a84593b4de92f6582327bc40f41d6c2d5e`
- merkleRoots (bytes32[2]):
  - `0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b`
  - `0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b`

## Verification settings

- solc: `0.8.23`
- optimizer: enabled=`true`, runs=`40`
- evmVersion: `shanghai`
- viaIR: `false`
- settings.metadata.bytecodeHash: `none`
- settings.debug.revertStrings: `strip`

## Verify targets

| Name | Address | Fully qualified name |
|---|---|---|
| UriUtils | 0x2c6359D42173aaC73Ea053b37c411f7Da44d4706 | `contracts/utils/UriUtils.sol:UriUtils` |
| TransferUtils | 0x1e26d8F8E2E4957a06d38Ab046CF64E5d308970f | `contracts/utils/TransferUtils.sol:TransferUtils` |
| BondMath | 0x0c2a50a9C1db998707662db2A13B93175c3E7394 | `contracts/utils/BondMath.sol:BondMath` |
| ReputationMath | 0x4F64e44a3693489289B1F20D55CF56130fE66C0b | `contracts/utils/ReputationMath.sol:ReputationMath` |
| ENSOwnership | 0x6852a13650F5c90342663c9fF7555f97F62515c8 | `contracts/utils/ENSOwnership.sol:ENSOwnership` |
| AGIJobManager | 0xB3AAeb69b630f0299791679c063d68d6687481d1 | `contracts/AGIJobManager.sol:AGIJobManager` |
