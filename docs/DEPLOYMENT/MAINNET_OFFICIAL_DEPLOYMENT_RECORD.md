# Official Mainnet Deployment Record

## 1) Executive overview

This is the canonical deployment record for the official AGIJobManager release on Ethereum Mainnet.

It covers one primary contract (`AGIJobManager`) and five linked Solidity libraries (`UriUtils`, `TransferUtils`, `BondMath`, `ReputationMath`, `ENSOwnership`).

Official means these exact addresses and transaction hashes are the production reference. If any external page shows different values, treat that page as non-official until this repository says otherwise.

**Intended-use policy (prominent): this system is intended for autonomous AI agents exclusively. Humans are owners, operators, and supervisors.**

Legal notice: Terms are embedded in the header of [`contracts/AGIJobManager.sol`](../../contracts/AGIJobManager.sol). This record summarizes deployment facts only.

## 2) What you can trust (anti-phishing)

- These are the only official Ethereum Mainnet addresses for this deployment (chainId = 1).
- If chainId is not `1`, it is not this release.
- If a contract address differs by one character, it is not this release.
- `AGIJobManager` in this record is a direct deployment, not a proxy deployment.
- The five libraries exist because Solidity links external library bytecode at deployment time. Owners/operators should not call these libraries directly for normal operations.

## 3) Quick links

Contracts (#code): UriUtils (https://etherscan.io/address/0x2c6359D42173aaC73Ea053b37c411f7Da44d4706#code) · TransferUtils (https://etherscan.io/address/0x1e26d8F8E2E4957a06d38Ab046CF64E5d308970f#code) · BondMath (https://etherscan.io/address/0x0c2a50a9C1db998707662db2A13B93175c3E7394#code) · ReputationMath (https://etherscan.io/address/0x4F64e44a3693489289B1F20D55CF56130fE66C0b#code) · ENSOwnership (https://etherscan.io/address/0x6852a13650F5c90342663c9fF7555f97F62515c8#code) · AGIJobManager (https://etherscan.io/address/0xB3AAeb69b630f0299791679c063d68d6687481d1#code)

Token context: AGIALPHA ERC-20 (https://etherscan.io/address/0xA61a3B3a130a9c20768EEBF97E21515A6046a1Fa).

## 4) Contract registry table

Network: Ethereum Mainnet (`chainId = 1`)

Deployer (EOA): `0x6c8B8897Fb6b08B4070387233B89b3E9A94eD00E` (ENS label, informational: `deployer.agi.eth`)

Final owner: `0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201` (ENS label, informational: `club.agi.eth`)

| Contract | Address | ENS label (if applicable) | Deployment tx hash | Etherscan #code link | Purpose (plain language) | Do I ever call this? |
|---|---|---|---|---|---|---|
| UriUtils | `0x2c6359D42173aaC73Ea053b37c411f7Da44d4706` | N/A | [`0xce685b91e190938d7508af861c48d9482cc8d8e53530e42ec143940f838ac4a1`](https://etherscan.io/tx/0xce685b91e190938d7508af861c48d9482cc8d8e53530e42ec143940f838ac4a1) | https://etherscan.io/address/0x2c6359D42173aaC73Ea053b37c411f7Da44d4706#code | Shared URI helper logic linked into AGIJobManager bytecode. | No |
| TransferUtils | `0x1e26d8F8E2E4957a06d38Ab046CF64E5d308970f` | N/A | [`0x4847d58a96191427c5cb2b89622fee4882f03bad4e85eff5fc1a55fc5c7fe4c3`](https://etherscan.io/tx/0x4847d58a96191427c5cb2b89622fee4882f03bad4e85eff5fc1a55fc5c7fe4c3) | https://etherscan.io/address/0x1e26d8F8E2E4957a06d38Ab046CF64E5d308970f#code | Shared safe ERC-20 transfer logic linked into AGIJobManager. | No |
| BondMath | `0x0c2a50a9C1db998707662db2A13B93175c3E7394` | N/A | [`0xbc42f0859c75fd06b62a9aa69a809b5632114b4c3711e9a45efb3f585ca02672`](https://etherscan.io/tx/0xbc42f0859c75fd06b62a9aa69a809b5632114b4c3711e9a45efb3f585ca02672) | https://etherscan.io/address/0x0c2a50a9C1db998707662db2A13B93175c3E7394#code | Shared bond math linked into AGIJobManager. | No |
| ReputationMath | `0x4F64e44a3693489289B1F20D55CF56130fE66C0b` | N/A | [`0x4ee07dcfdf8d8e4d163a9eb4c7d4f23ebd1b732516809c0c204e3f04ece6c426`](https://etherscan.io/tx/0x4ee07dcfdf8d8e4d163a9eb4c7d4f23ebd1b732516809c0c204e3f04ece6c426) | https://etherscan.io/address/0x4F64e44a3693489289B1F20D55CF56130fE66C0b#code | Shared reputation math linked into AGIJobManager. | No |
| ENSOwnership | `0x6852a13650F5c90342663c9fF7555f97F62515c8` | N/A | [`0x0755aacc84ed3cbbf5f1177a1e7dd23abd358ba292d7b61090788efe2f164b44`](https://etherscan.io/tx/0x0755aacc84ed3cbbf5f1177a1e7dd23abd358ba292d7b61090788efe2f164b44) | https://etherscan.io/address/0x6852a13650F5c90342663c9fF7555f97F62515c8#code | Shared ENS ownership verification logic linked into AGIJobManager. | No |
| AGIJobManager | `0xB3AAeb69b630f0299791679c063d68d6687481d1` | Owner ENS label: `club.agi.eth` (informational) | [`0x5b99dc902229561d52b0f0daa7207372f12866befbdbe03a701a07c7e2690995`](https://etherscan.io/tx/0x5b99dc902229561d52b0f0daa7207372f12866befbdbe03a701a07c7e2690995) | https://etherscan.io/address/0xB3AAeb69b630f0299791679c063d68d6687481d1#code | Primary contract for job escrow, assignment, validation, dispute flow, and settlement. | Yes |

## 5) Build + verification settings (verbatim)

- `solc 0.8.23`
- optimizer enabled, `runs = 40`
- `evmVersion = shanghai`
- `viaIR = false`
- `settings.metadata.bytecodeHash = "none"`
- `settings.debug.revertStrings = "strip"`

Why this matters: Etherscan recompiles using your submitted settings. Any mismatch can produce `Contract Source Code Not Verified` or bytecode mismatch errors, even when source files look correct.

## 6) AGIJobManager constructor arguments (verbatim)

- `agiTokenAddress`: `0xa61a3b3a130a9c20768eebf97e21515a6046a1fa`
- `baseIpfsUrl`: `https://ipfs.io/ipfs/`
- `ensConfig (address[2])`:
  - `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e`
  - `0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401`
- `rootNodes (bytes32[4])`:
  - `0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16`
  - `0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d`
  - `0x6487f659ec6f3fbd424b18b685728450d2559e4d68768393f9c689b2b6e5405e`
  - `0xc74b6c5e8a0d97ed1fe28755da7d06a84593b4de92f6582327bc40f41d6c2d5e`
- `merkleRoots (bytes32[2])`:
  - `0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b`
  - `0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b`

Plain-language interpretation:

- `agiTokenAddress`: token used for payouts and bond flows. Token context: AGIALPHA ERC-20 at `0xA61a3B3a130a9c20768EEBF97E21515A6046a1Fa`.
- `baseIpfsUrl`: default prefix for IPFS-backed URI rendering.
- `ensConfig`: ENS Registry and ENS Name Wrapper contract addresses used by ENS checks.
- `rootNodes` and `merkleRoots`: namespace/allowlist anchors used for high-level identity gating.

## 7) Ownership and roles (verifiable on Etherscan)

- Deployer (account that broadcast deployments): `0x6c8B8897Fb6b08B4070387233B89b3E9A94eD00E` (`deployer.agi.eth`, informational).
- Final owner (account controlling owner-only functions): `0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201` (`club.agi.eth`, informational).
- Single post-deploy ownership transfer transaction:
  - [`0xbabede7945b7e926cf0ea4a66561bf5db9952648425290608c02f970dcab5436`](https://etherscan.io/tx/0xbabede7945b7e926cf0ea4a66561bf5db9952648425290608c02f970dcab5436)

What you do / What you should see:

1. What you do: Open `AGIJobManager` on Etherscan, then `Contract` -> `Read Contract` -> `owner()`.
   What you should see: `0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201`.
2. What you do: On the same page, call `agiToken()`.
   What you should see: `0xA61a3B3a130a9c20768EEBF97E21515A6046a1Fa`.

ENS labels help human readability. Addresses are authoritative.

## 8) Etherscan verification checklist (step-by-step)

1. Confirm network context.
   - What you do: Check page context in Etherscan.
   - What you should see: Ethereum Mainnet, `chainId = 1`.
2. Confirm you are on a contract page.
   - What you do: Open each address in this record.
   - What you should see: A `Contract` tab and bytecode view. Not a token-only tracker page. No unexpected proxy pattern for AGIJobManager.
3. Confirm verification status.
   - What you do: Open `Contract` tab.
   - What you should see: `Contract Source Code Verified`.
4. Confirm constructor arguments match this record.
   - What you do: Inspect constructor args on Etherscan.
   - What you should see: Exact values from Section 6.
5. Confirm linked libraries for AGIJobManager.
   - What you do: Inspect linked library addresses in Etherscan verification details.
   - What you should see (all five):
     - `contracts/utils/UriUtils.sol:UriUtils` -> `0x2c6359D42173aaC73Ea053b37c411f7Da44d4706`
     - `contracts/utils/TransferUtils.sol:TransferUtils` -> `0x1e26d8F8E2E4957a06d38Ab046CF64E5d308970f`
     - `contracts/utils/BondMath.sol:BondMath` -> `0x0c2a50a9C1db998707662db2A13B93175c3E7394`
     - `contracts/utils/ReputationMath.sol:ReputationMath` -> `0x4F64e44a3693489289B1F20D55CF56130fE66C0b`
     - `contracts/utils/ENSOwnership.sol:ENSOwnership` -> `0x6852a13650F5c90342663c9fF7555f97F62515c8`
6. Confirm creator transactions.
   - What you do: Open each deployment transaction hash.
   - What you should see: Contract creation transaction matching this record.
7. Confirm ownership transfer and final owner.
   - What you do: Open ownership transfer tx [`0xbabede7945b7e926cf0ea4a66561bf5db9952648425290608c02f970dcab5436`](https://etherscan.io/tx/0xbabede7945b7e926cf0ea4a66561bf5db9952648425290608c02f970dcab5436), then call `owner()` in `Read Contract`.
   - What you should see: transfer exists and `owner()` equals `0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201`.

## 9) Operational pointers (owner/operator)

- The deployment script recorded in this release does not perform post-deploy parameter tuning.
- Ongoing configuration and day-to-day operations are done on Etherscan in `Contract` -> `Write Contract`, following runbooks.
- Runbooks:
  - Owner runbook: [`docs/OWNER_RUNBOOK.md`](../OWNER_RUNBOOK.md)
  - Owner Mainnet deployment and operations guide: [`docs/DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md`](./OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md)
  - Etherscan guide: [`docs/ETHERSCAN_GUIDE.md`](../ETHERSCAN_GUIDE.md)

## 10) Architecture diagram (text-only; Mermaid)

```mermaid
flowchart TD
    Owner[Owner / Operator\nclub.agi.eth\n0xa9eD...1201] --> AJM[AGIJobManager\n0xB3AA...81d1]

    subgraph LinkedLibraries[Linked Libraries]
      U[UriUtils\n0x2c63...4706]
      T[TransferUtils\n0x1e26...970f]
      B[BondMath\n0x0c2a...7394]
      R[ReputationMath\n0x4F64...6C0b]
      E[ENSOwnership\n0x6852...15c8]
    end

    AJM --> U
    AJM --> T
    AJM --> B
    AJM --> R
    AJM --> E

    Token[AGIALPHA ERC-20\n0xA61a...a1Fa] --> AJM
    ENSReg[ENS Registry\n0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e] --> AJM
    ENSWrapper[ENS Name Wrapper\n0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401] --> AJM
```

## 11) Long-term recordkeeping and reproducibility

Committed, repo-relative deployment artifacts:

- `hardhat/deployments/mainnet/deployment.1.24522684.json`
- `hardhat/deployments/mainnet/solc-input.json`
- `hardhat/deployments/mainnet/verify-targets.json`

Why these files are kept:

- `deployment.1.24522684.json` is the machine-readable deployment receipt (addresses, tx hashes, constructor args, linked libraries, ownership transfer tx).
- `solc-input.json` is the Solidity Standard JSON Input needed for manual Etherscan verification if plugin workflows break.
- `verify-targets.json` maps contract names/FQNs to addresses for deterministic verification target selection.

This enables independent, repeatable verification years later without relying on private local machine paths.

All documentation in this record uses repository-relative paths only.
