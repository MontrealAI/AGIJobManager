# Mainnet deployment and activation checklist

For the already commissioned instance, start with the [supported inspection and recovery workflow](docs/OPERATIONS/COMMISSIONING.md). It reports current observations separately from the completed historical milestone; no deployment is needed when connection checks pass.

Use the complete [launch checklist](docs/LAUNCH_CHECKLIST.md) and [Hardhat guide](hardhat/README.md) for a new instance. For the already-deployed USDC manager, start with the [10 October 2026 deployment-and-connection record](docs/deployments/MAINNET_USDC_2026-10-10.md), not another deployment command.

**Recorded instance: ENS connected; production activation on HOLD.** The [five activation closeout groups](docs/OPERATIONS/PRODUCTION_ACTIVATION.md) are separate from source verification and ENS wiring. A passing read-only script does not enforce an on-chain launch gate.

- Review the actual owner/signing arrangement, funded response access and recovery; consider multisignature control for substantial exposure. Do not transfer ownership merely to update this repository.
- Keep ENS token-URI settings and configuration locks unchanged unless separately reviewed. Identity locking removes helper-replacement options and is not incident containment.
- Verify both manager/helper pointers, exact runtime, namespace, resolver, root custody, operator authority and expiry. A nonzero helper address alone is insufficient; successful settlement does not prove best-effort ENS records were written.
- Review current USDC restrictions, actual fee recipients, complete NFT/identity policy, participants, moderators and mutable limits. For first activation require all five reserves zero; always check balance against escrow, agent bonds, validator bonds, dispute bonds **and pending claims**.
- Record per-job limits separately from total exposure: unpausing permits public creation/application, without an employer invitation gate or aggregate one-job cap. Pausing immediately after posting prevents the intended agent from applying; an attended sequence pauses after assignment and keeps settlement enabled where safe.
- Retain source-bound unit/invariant/static-analysis evidence and obtain independent review before substantial exposure. Adopt the actual operator/fee/data/terms/contact arrangements; do not substitute repository templates for operating sign-off.

Do not recreate either ENS root, repeat completed approvals/attachment, alter the original deployment journal, or activate paid intake as part of a software/documentation update.
