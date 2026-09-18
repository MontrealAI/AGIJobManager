# Truffle deployment retired

Truffle and Ganache are removed from the v1.0.2 dependency tree. Their public-network deployment commands are unsupported and must not be used.

Use the [Hardhat deployment guide](../../hardhat/README.md) for compile, dry run, deployment, source verification and recovery. Supply native six-decimal USDC, both settlement wallets, and the intended owner. The manager starts paused; complete two-step ownership acceptance and the [readiness checks](../MAINNET_READINESS.md) before activation.

The previous instructions remain available in [the v0.9.0 source archive](https://github.com/MontrealAI/AGIJobManager/tree/v0.9.0/docs/DEPLOYMENT) for historical research. They are not a current signing path.
