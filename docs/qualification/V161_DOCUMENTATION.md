# v1.6.1 documentation and release alignment

This patch corrects current-guide headings, old download links, an incomplete release history and a deployment registry still labeled 1.5.0 in the 1.6.0 package. The version was software metadata; it was not a deployed manager address or a change to on-chain behavior.

The generated [release and deployment command guide](../RELEASE_GUIDE.md) derives its edition from package metadata and checks each documented command against the Hardhat package scripts. Documentation CI checks root/Hardhat/UI package and lock versions, deployment-registry version, active guide headings, download editions, command entrypoints, standalone console title and generated-guide freshness. Historical releases, dated qualification records, security reports and legal notices retain their original identities.

The deploy-day sequence now explicitly completes paused readiness before owner activation and a limited production canary. Launch guidance separates contract deployment/readiness from employer pre-funding admission and real private Fleet commissioning. A public readiness report does not measure private hardware, models, issuer independence, employer value or useful throughput.

Solidity, deployment implementations, admission implementations, dependency resolutions, legal notices and historical releases are preserved. The complete release record supplies the final source, CI jobs, actual execution counts and reproducible asset digests. No production deployment or transaction is part of this patch.
