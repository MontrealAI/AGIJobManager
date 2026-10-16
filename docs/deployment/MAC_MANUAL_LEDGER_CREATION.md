# Mac Studio Ledger: governor review and handover

Updated 16 October 2026. This path is retained for existing links. The owner's newer instruction replaces the former Mac creation proposal: **initial creation uses Hardhat in Terminal on Ubuntu, from the chosen deployer, with a local hidden ephemeral key prompt**. Follow the [Ubuntu creation runbook](UBUNTU_HARDHAT_CREATION.md). Remix, MetaMask and Ledger are not prerequisites for creation. No signature export or optional companion is required.

The secure governor remains **`0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99`** on the Mac Studio Ledger. Its normal configuration path remains **Etherscan → MetaMask → Ledger**. Ubuntu creation does not require importing the governor key anywhere. **No real Mainnet transaction is authorized by preparation; the owner initiates deployment and manually approves later governor calls.**

Before any governor call, the Mac must independently establish the exact contract revision/build, production plan, full transaction/receipt identity, exact runtime and source-verification acceptance for every deployed component. Ubuntu evidence is review input; do not accept an address/status flag alone. Preserve Standard JSON, compiler settings, constructor bytes, library links, immutable values, canonical finalized receipts and explorer acceptance bound to those exact inputs.

| Project | Expected initial handover | Subsequent Mac action |
| --- | --- | --- |
| Manager d371 | d76 is constructor-set owner; pendingOwner=0; creator has no moderator, admission/configuration or indirect system privileges | Review live configuration and readiness with intake paused. Configure only separately approved calls; no ownership acceptance is needed for this constructor governor |
| Alpha380 | d76 is constructor-set owner of AscensionAccess, AscensionRiskOracle and AscensionJobMarket; pending owners=0. NovaSeed and AscensionMark have no protocol owner | After all five exact creations are verified, review `AscensionRiskOracle.bindMarketplace(new AscensionJobMarket)` then `AscensionJobMarket.bindMark(new AscensionMark)` as two separate calls |
| Jobs9a79 | Coordinator and ten implementations have native immediate handovers to d76. Eight managed modules are owned by SystemPause; SystemPause is owned by d76 | Preserve this ownership topology. Resolve only actual pending ownership shown by the native report, then independently verify treasury/governance/operator permissions and the complete setup interval |

For Jobs, the original 39-operation closeout can intentionally leave IdentityRegistry/TaxPolicy acceptance and FeePool governance/treasury setup pending. The [Ubuntu runbook's Mac governor section](UBUNTU_HARDHAT_CREATION.md#jobs-later-governor-steps-on-the-mac) gives the simple conditional five-call route, including source-ABI-checked inner calldata and SystemPause forwarding. A creation closeout is not complete authority acceptance.

The deployer must retain **no residual system privileges**. Owner/pendingOwner reads are necessary but insufficient: include governance/default-admin/upgrade powers, pause/moderator/operator/registrar/rewarder/acknowledger permissions, allowlists, token/NFT approvals, treasury/beneficiary roles, ENS parents/wrapped owners/fuses/operators and indirect aliases. Review every setup transaction and permission-changing event. Do not activate when this inventory is incomplete.

The original Jobs/companion bounded certificates retain `authorityComplete:false`; the Ubuntu transport does not promote them to complete authority acceptance. Verify all actual components, including Jobs' coordinator and implementation contracts and Manager's libraries. Exact source acceptance, full authority acceptance, custody/provider acceptance and production approval remain distinct decisions.

For each later governor transaction:

1. Open the verified **new** target contract on Ethereum Mainnet Etherscan; independently match its address and source package to the accepted graph.
2. Connect MetaMask's existing Ledger account and confirm d76. Independently compare the full request's sender, chain, target, method, ABI-encoded parameters, value, nonce, gas and both fees with the reviewed operation.
3. Manually review/approve the exact wallet/device request. No batching, blanket allowance, delegation or hidden extra operation is implied.
4. Reconcile the canonical finalized receipt, exact calldata and resulting state from independent read-only evidence. Stop and recover an uncertain result before another submission.

Manager uses USDC6; Alpha/Jobs use $AGIALPHA18. Manager starts intake paused. Alpha has no global pause and starts uncommissioned; its two graph bindings do not authorize admission, stake, jobs, treasury funding or activation. Jobs' managed modules remain paused until a separate approved commissioning/activation decision.

The complete accepted hosted evidence remains in [Manager run 38958922414 readback](../qualification/manager-d371-hosted-38958922414.json) and [Jobs run 38954500102 readback](../qualification/jobs-9a79-hosted-38954500102.json). Those functional campaigns do not establish real production signing, actual provider/finality acceptance, explorer acceptance or zero indirect deployer authority.
