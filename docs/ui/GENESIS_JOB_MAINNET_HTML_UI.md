# USDC standalone console v1.19.5

v1.19.3 retains the v1.0.5 protocol notices unchanged and links the [legal center](../LEGAL/README.md). Acknowledgement starts unchecked, is never restored from browser storage, and must be renewed after account/network/manager changes or page restoration. Withdrawing acknowledgement also cancels a pending transaction review. This is a local safeguard; the operator must supply its own legally appropriate service terms and acceptance process. The console retains the v1.0.5 separate public-content check for publishing text/links and IPFS uploads. It does not scan for every personal detail or restrict direct contract calls.


Use the [matching release status and assets](https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.19.5) with an independently verified, compatible USDC Manager on Ethereum mainnet. Start with the [October 17 reported Manager and its evidence limits](https://github.com/MontrealAI/AGIJobManager/blob/d5d4ad93f00a3dfe6439b0f32edb1a2fcf70e0c2/docs/deployments/MAINNET_MANAGER_2026-10-17.md), then explicitly select and verify the intended transaction target. This dated, owner-reported snapshot is not a fresh live-state or ABI qualification. No manager is configured by default. Already verified compatible v0.9.6 instances can keep their original jobs and interfaces; this interface update does not require or perform their redeployment.

The [v1.19.5 transformation inspection API](../successor/TRANSFORMATIONAL_WORK.md) is separate from this console. Its native zero-currency pilot cannot create a positive paid proposal, execute work or authorize signing. The existing Builder and all historical deployment evidence remain preserved.

The [current repository console](../../ui/agijobmanager-usdc.html) includes clear cost and buyer guidance and requires `getJobBonds` for voting. v0.9.5 and older managers do not have that getter. See [compatibility and verification](../qualification/BUYER_ECONOMICS_FOLLOWUP.md), including the older console's bond-quote limitation. Existing jobs remain on their original contracts.

The repository console has post-release context/mobile fixes and a **Get free name + identity NFT** action that the frozen v1.0.0 asset does not contain. [Choose a version and download the pinned reviewed console](../V1_RELEASE_SCOPE.md#published-download-versus-current-source). Read the [agent journey](../roles/AGENT.md) for registration, expiry, job eligibility and payment.

Before enabling writes the console checks chain ID 1, contract code, the manager's immutable `usdcToken()` address and six decimals. It repeats these checks before each transaction. Token identity checks do not prove source correctness; verify the deployment independently first.

All amounts use USDC with at most six decimal places. Excess precision is rejected. Approval, escrow, bonds, settlement and withdrawals use the same USDC address. The old bridge/vault panel is retired, and saved forms and wallet context retain the v0.9.6 namespace because the ABI and deployed runtime remain compatible; the disabled fresh NFT-admission default introduced in v1.0.3 is preserved. The console still rechecks account, chain and manager before writing. Pre-v0.9.6 saved context is not imported.

Wallet/account/chain changes invalidate reviews and write eligibility. Review the exact amount and spender before signing; USDC approval is separate from a job transaction. ETH is required only for gas.

See [the migration guide](../USDC_MIGRATION.md) for supported chains, default economics, transfer restrictions and deployment steps. Prior consoles remain in the v0.4.0 Git tag for historical operations.

## Keep private information out of public content

Follow the [user-data rules](../LEGAL/USER_DATA_RULES.md). Review the exact transaction fields or upload JSON; do not add personal information, confidential work, access tokens or private sharing links. The operator and each participant retain their actual statutory duties.

Typing no longer saves builder drafts. Use **Save draft on this device** and **Load saved draft** deliberately. Completion drafts are memory-only. **Clear saved job content** removes old saved drafts and notes on this browser origin. Saved notes/drafts are unencrypted; downloads and public copies are separate. Pinning credentials are masked, never saved/restored, and cleared after upload/review. Only the HTTPS Pinata origin receives Pinata JWTs; custom endpoints receive JSON without them. See the [privacy/storage guide](../privacy-and-storage.md).
