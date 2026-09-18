# Mainnet deployment and security — v1.0.3

The supported current procedure is the [Hardhat deployment guide](../hardhat/README.md). It covers qualified compilation, strict dry runs, native-USDC checks, paused deployment, linked-library source verification, transaction journals, failure recovery, owner acceptance and the read-only readiness check.

Truffle and Ganache have been removed. Local tests use Hardhat 3, and historical deployment migrations are retired. Do not use an old receipt or the legacy contract address as a v1.0.3 deployment.

For owner operations use the [owner runbook](OWNER_RUNBOOK.md) and [owner controls](OWNER_CONTROLS.md). For a high-stakes launch complete [mainnet readiness](MAINNET_READINESS.md), including independent review and an actual signer/participant rehearsal. No live deployment is supplied by publication.

The previous detailed page is retained in the [v0.8.0 source](https://github.com/MontrealAI/AGIJobManager/blob/v0.8.0/docs/mainnet-deployment-and-security-overview.md) as historical material; its retired deployment instructions are not a current execution path.
