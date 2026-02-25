# ENSJobPages — Mainnet Deployment Artifacts

This folder stores the official Ethereum Mainnet deployment record and verification inputs for **ENSJobPages** — the on-chain helper contract that creates and updates per-job ENS subnames (e.g., `job-<id>.alpha.jobs.agi.eth`) for the **AGIJobManager** mainnet beta deployment.

## Deployed contracts

- **ENSJobPages (mainnet)**: `0xc19A84D10ed28c2642EfDA532eC7f3dD88E5ed94`
  - Etherscan (verified): https://etherscan.io/address/0xc19A84D10ed28c2642EfDA532eC7f3dD88E5ed94#code
  - Deployment tx: https://etherscan.io/tx/0xd3d9c246473d91499fc9130c786f4ff7fa9c15408f0bc0e54b1fafe2918df3b0

- **AGIJobManager (mainnet beta)**: `0xB3AAeb69b630f0299791679c063d68d6687481d1`
  - Etherscan (verified): https://etherscan.io/address/0xB3AAeb69b630f0299791679c063d68d6687481d1#code

## ENS configuration (constructor args)

ENSJobPages was deployed configured for:

- ENS Registry: `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e`
- ENS NameWrapper: `0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401`
- ENS Public Resolver: `0xF29100983E058B709F3D539b0c765937B804AC15`
- Jobs root name: `alpha.jobs.agi.eth`
- Jobs root node: `0xc164c9558a3c429519a9b2eba9f650025731fccc46b3a5664283bcab84f7e690`

## Files

- `deployment.1.24531331.json`
  - Deployment receipt record (addresses, tx hashes, block numbers, constructor args, ownership transfer, and wiring transactions).
- `solc-input.json`
  - Solidity Standard JSON Input used for compilation/verification (for Etherscan “Standard JSON Input” verification flow).
- `verify-targets.json`
  - Verification target index (contract name + fully-qualified name + deployed address), useful with Hardhat verification scripts.

## Post-deploy wiring transactions (mainnet)

To enable ENS automation end-to-end, the following on-chain steps were executed:

1) Set the JobManager inside ENSJobPages  
   - `ENSJobPages.setJobManager(0xB3AA...7481d1)`  
   - Tx: https://etherscan.io/tx/0xac2fd0dae7a1bc312eeb44b86734f73f61422d602b1194f862fb1d84a89f631b

2) Approve ENSJobPages in the ENS NameWrapper (only required when the root is **wrapped**)  
   - `NameWrapper.setApprovalForAll(0xc19A...5ed94, true)`  
   - Tx: https://etherscan.io/tx/0x2079a282e0cba9505f5e51e1495f2113e4ca2bfa5cb52324a89247174ecf41b4

3) Wire ENSJobPages into AGIJobManager  
   - `AGIJobManager.setEnsJobPages(0xc19A...5ed94)`  
   - Tx: https://etherscan.io/tx/0x1df147a640999d4c4406f6d1007571ebf1cc1379a5ae53250394d86608d65e6b

## Verification

### Hardhat (recommended)
If you have the repository dependencies installed and `ETHERSCAN_API_KEY` set, you can verify from the repo root:

- See `verify-targets.json` for the contract FQN and address.
- ENSJobPages constructor args (in order) are:
  1. ENS Registry address
  2. NameWrapper address
  3. Public Resolver address
  4. Jobs root node (`bytes32`)
  5. Jobs root name (`string`)

### Manual Etherscan “Standard JSON Input”
Use `solc-input.json` and select the contract:
- `contracts/ens/ENSJobPages.sol:ENSJobPages`
