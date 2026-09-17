# Start here — AGIJobManager v0.9.4

This package adds an owner-controlled NFT requirement for future jobs while preserving each posted job's terms, ENS authorization and USDC settlement.

## Choose your task

| Task | Start with |
| --- | --- |
| Use a verified v0.9.4 manager | Open top-level `agijobmanager-usdc.html`; confirm the chain and manager address before connecting |
| Choose required or optional NFTs | `source/docs/NFT_POLICY.md` |
| Run a local example without funds or keys | `source/docs/QUINTESSENTIAL_USE_CASE.md` |
| Deploy a fresh manager | `source/hardhat/README.md`, then `source/docs/DEPLOYMENT_OPERATIONS.md` |
| Operate or monitor a deployment | `source/docs/OWNER_RUNBOOK.md` and `source/docs/MAINNET_READINESS.md` |
| Review tests, assumptions and release integrity | `VALIDATION.md`, `SOURCE_CI.json` and `RELEASE_MANIFEST.json` |

The primary transaction interface is `agijobmanager-usdc.html`. The source tree also contains the broader application and historical interfaces; their roles are described in `source/ui/README.md`. Existing jobs should continue using their original manager and matching interface.

## Owner setup

1. Deploy the qualified v0.9.4 source with the supported Hardhat workflow. Intake starts paused; verify all six libraries and the manager, then complete ownership acceptance.
2. Review the agent NFT policy. The initial default is **required**, with **no collections registered**. Register approved collections or deliberately set `agentNftRequired` to `false` for future jobs. The console's owner controls provide **NFT requirement for new jobs**.
3. Supply the complete expected registry and default in `hardhat/reviewed-nft-policy.json`. Run readiness with `READINESS_NFT_CONFIG` and the saved deployment receipt, as documented in the NFT policy guide.
4. Complete the reviewed recipient, signing, ENS and operational checks before opening intake. Preserve older managers, funds, namespaces and receipts.

The NFT setting does not remove Agent/Club authorization or change payout shares. A default change affects jobs posted afterward; funded jobs retain their recorded requirement. Collection changes require every reserve counter to be zero.

## Verify the download

Keep the four release assets together and run `sha256sum -c SHA256SUMS.txt` before extracting the ZIP or opening the console. The manifest binds the complete payload to source commit `fbe6eb73f8d02c15190fb4c3ca5892eb18004024` and tree `82b63b386f1f6aae6bddf420e9eb66e1742f2569`.

The ZIP includes the complete tracked source, without installed dependencies or private operator configuration. Use Node.js 22.23.2 or a compatible newer version, and the committed lockfiles. Follow the project setup guide for locked installs and compilation.

The top-level `release-tooling/` directory records the publication tools. Rebuilding the release archive requires a full Git checkout at the successful publication workflow's commit, including history and release metadata. See `VALIDATION.md` for that procedure.

This package publishes software. It does not deploy, activate, repoint or migrate any existing on-chain system.
