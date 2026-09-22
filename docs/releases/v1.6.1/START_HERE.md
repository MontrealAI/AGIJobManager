# AGIJobManager v1.6.1

This patch aligns the release identity, documentation and Hardhat command guide. Compatible existing managers do not need redeployment for these documentation changes.

1. Verify the complete ZIP against the release's `SHA256SUMS.txt`. `RELEASE_MANIFEST.json` records every payload hash and the exact public source commit.
2. Open [the current release and deployment guide](https://github.com/MontrealAI/AGIJobManager/blob/9207667cdb6da72a87577f8e85f06fdedaa0c95b/docs/RELEASE_GUIDE.md) (offline: `source/docs/RELEASE_GUIDE.md`). Its command names are checked against the Hardhat package. Use the pinned public Node 22.23.2 toolchain and lockfiles.
3. Review [release notes](RELEASE_NOTES.md) and [validation](VALIDATION.md). The complete public source is in `source/`.
4. For a new deployment, follow [the Hardhat procedure](https://github.com/MontrealAI/AGIJobManager/blob/9207667cdb6da72a87577f8e85f06fdedaa0c95b/hardhat/README.md) (offline: `source/hardhat/README.md`), inspect the read-only plan, preserve receipts and finish paused readiness before owner activation and the limited canary. A failed command may already have broadcast; inspect its journal before retrying.
5. For economically qualified intake, follow [the pre-funding integration guide](https://github.com/MontrealAI/AGIJobManager/blob/9207667cdb6da72a87577f8e85f06fdedaa0c95b/docs/OPERATIONS/PREFUNDING.md) (offline: `source/docs/OPERATIONS/PREFUNDING.md`). The manual `agijobmanager-usdc.html` console and permissionless contract do not enforce this off-chain gate.

Opening or extracting this package grants no signing authority. It contains no private applications, wallet credentials or live deployment. Real hardware, provider quality/cost, independent participants, observed employer value, native-USDC recovery and sustained useful throughput remain separate commissioning requirements.

Historical legal, deployment and release evidence retain their original versions. Current software metadata is not a claim that an on-chain manager has been upgraded.
