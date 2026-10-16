# Existing Ledger wallet configuration / Configuration avec le portefeuille Ledger existant

Contract creation and configuration are separate phases. The primary configuration path uses the owner's existing Ledger-compatible wallet on the Mac Studio and the exact verified Etherscan **Write Contract** page. The owner reviews and manually approves each transaction. The custom companion signer, browser bridge, actor locks, external-signing packets and native signing-session completion are not prerequisites for this wallet path.

This optional CLI prepares exact source packages and independently checks the deployment and owner-submitted configuration receipts. It cannot sign or broadcast a chain transaction. Its automatic explorer service publishes source only when the independently reviewed input explicitly authorizes that service. It never activates a contract or alters economic policy.

| Exact Alpha #4827 source `38064bec3423218f87c6b81760ac6768b3e7d4e5` | Sender | Target | Argument | ETH | Expected result |
|---|---|---|---|---|---|
| `bindMarketplace(address)` | Governor `0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99` | New AscensionRiskOracle | New AscensionJobMarket | 0 | `marketplace()` equals the new marketplace |
| `bindMark(address)` | Same governor | New AscensionJobMarket | New AscensionMark | 0 | `mark()` equals the new MARK |

Both calls use Ethereum Mainnet chain 1, are one-time bindings, and must follow the reviewed graph. The report contains their exact checksummed addresses, arguments and calldata. It exposes only the next eligible Etherscan link after **all five** new contract source records match exactly. The source has no `setExecutionCoordinator` or `setGovernanceCouncil` method. No generic governor call is offered. Manager's selected nine-CREATE architecture has no configuration call in this wallet utility; its owner powers are inventoried separately and do not imply activation.

## Inputs and one-command phases

Keep the review, local build policy, native plan, output and explorer journal in private owner-controlled directories. Their hashes are independent review inputs; computing a hash does not approve its contents. The native checkout and Node executable must match the source and dependency pins. The production utility requires macOS. Ubuntu remains an experimental preparation environment, not the trusted signer.

The review is an exact `manual-ledger-wallet-configuration-review-v1` object:

```js
{
  schema: 'manual-ledger-wallet-configuration-review-v1',
  chainId: 1,
  source: {
    repository: 'MontrealAI/AGI-Alpha-Agent-v0',
    commit: '38064bec3423218f87c6b81760ac6768b3e7d4e5',
    tree: '4fe59cb9b8c7e65ea087fd27b0e2abed6bf34c68'
  },
  governor: '0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99',
  planSha256,
  creationHashes: [accessCreation, seedCreation, oracleCreation, marketplaceCreation, markCreation],
  governanceHashes: [],
  licenseType,
  native: { checkout, nodePath, nodeVersion, nodeSha256, planPath, readRpcUrl }
}
```

The five creation hashes are the exact ordered new graph; no historical address or old deployment is selected. `governanceHashes` is the exact ordered owner-submitted prefix: empty, the marketplace binding hash, or both binding hashes. It never contains an assumed or replacement transaction. The read provider must use HTTPS; provider credentials and explorer keys stay local and are never requested in chat.

The separately reviewed `manual-ledger-local-build-policy-v1` uses the existing pinned local-build format. Its legacy-named `campaignSha256` field must equal `walletDeploymentBinding(review)`, exported by `wallet-config.mjs`: the SHA256 canonical digest of the review excluding only `governanceHashes` and optional `serviceAuthorization`. This keeps the independently checked source/build/plan binding stable as receipt observations are appended. The **complete** review digest is still checked every invocation. Its `planSha256` must match the native plan, and the policy must reproduce all five exact native contract outputs, source paths, metadata/settings, ABI, bytecode and immutable locations locally. No remote compiler or SDK fallback is selected.

Create the local build-policy **proposal** directly from the reviewed five-creation wallet review, with no seven-operation companion campaign or signing session:

```sh
node trust/prepare-wallet-review.mjs --review /private/wallet-review.json --reviewed-sha256 REVIEW_SHA --compiler /absolute/pinned/soljson.js --compiler-sha256 COMPILER_SHA --node /absolute/pinned/node --node-sha256 NODE_SHA --out /private/NEW_LOCAL_BUILD_POLICY.json
```

This offline Mac command rechecks the exact native plan and recompiles all five contracts. It returns `UNAPPROVED_OWNER_REVIEW_REQUIRED`. Review the complete proposal independently before using its digest as `BUILD_POLICY_SHA`; the generated integrity hash is not approval. The command makes no provider, explorer, wallet or chain request.

First export the five exact source packages, before either binding:

```sh
node verification/wallet-config.mjs export --review /private/wallet-review.json --reviewed-sha256 REVIEW_SHA --build-policy /private/local-build-policy.json --reviewed-build-policy-sha256 BUILD_POLICY_SHA --out /private/NEW_EXPORT
```

The fixed native collector runs the genuine exact-source five-CREATE preflight and pure planned-package export independently of any seven-operation signing session. It verifies all five canonical creation receipts, recovered transaction senders, exact envelopes/constructors, code, immutable values, selected dependency and participant state, ordering and the fresh-graph event interval. The native predicted package is retained unchanged; a separate companion record supplies the receipt-proven runtime/source evidence. No binding signature is invented or imported to obtain this export.

For automatic source publication, add this exact optional authorization to the independently reviewed review object, then approve its new complete digest:

```js
serviceAuthorization: {
  service: 'etherscan-v2',
  submitSource: true,
  planSha256,
  sourceCommit: '38064bec3423218f87c6b81760ac6768b3e7d4e5',
  creationHashesSha256: digest(creationHashes)
}
```

`walletServiceAuthorization(review)` generates this exact object; `digest` is the canonical SHA256 function in `trust/local-build.mjs`. An API key alone cannot authorize publication. Configure `ETHERSCAN_API_KEY` securely on the Mac, then run:

```sh
node verification/wallet-config.mjs submit-source --review /private/wallet-review.json --reviewed-sha256 REVIEW_SHA --build-policy /private/local-build-policy.json --reviewed-build-policy-sha256 BUILD_POLICY_SHA --verification-state /private/explorer-state --out /private/NEW_SUBMISSION_REPORT
```

This fixed service uses the existing exact verifier: one durable attempted marker per task is fsynced and read back before its source POST, status reads/polls/retries are bounded, and success requires exact compiler/source/settings/constructor/library identity plus fresh canonical runtime proof. A GUID or “Pass - Verified” banner alone is not success. Unknown POST outcomes are never automatically submitted again. The private journal is bound to source, plan, local build policy, all five tasks and service authorization. Do not delete or replace it to retry a submission.

`verify` uses that same command shape with a fresh output directory and performs **GET-only** recovery/status checking. Explicit `--recover-dead-verification-owner` is only for a conclusively dead local journal owner; that invocation is forced to GET-only, even when `submit-source` was selected. Live or ambiguous locks remain blocked. No chain resend, fee bump or transaction replacement is offered.

Once exact source verification succeeds, open the next report link in Etherscan, select the correct governor account in the existing Ledger wallet, compare the target/method/argument/calldata/zero ETH/chain 1, and manually approve that exact transaction. Wait for its result. Append its exact hash to `governanceHashes`, approve the new complete review digest and run:

```sh
node verification/wallet-config.mjs reconcile --review /private/wallet-review.json --reviewed-sha256 UPDATED_REVIEW_SHA --build-policy /private/local-build-policy.json --reviewed-build-policy-sha256 BUILD_POLICY_SHA --verification-state /private/explorer-state --out /private/NEW_RECONCILIATION_REPORT
```

Repeat for the second binding only after the first is canonically reconciled. Reconciliation validates the actual signed sender, destination, chain, zero value, exact calldata/argument, direct type-2 envelope, receipt success/event, block identity and order, deployed runtime and expected getter at the receipt block and latest checked state. A changed source/account, pending nonce, missing receipt, wrong binding or unknown outcome blocks the next eligible link. Reports are new private JSON files with mode 0600; an interrupted report retains `INCOMPLETE` and the durable explorer state.

No complete authority or activation clearance is inferred. Alpha has **no global pause switch**: its fresh state is uncommissioned, not globally paused. USDC remains a separate six-decimal route; this five-contract Alpha graph uses $AGIALPHA with eighteen decimals. External token/proxy/ENS/controller, wallet/provider and physical-device acceptance remain separate evidence. Audit and Sepolia are owner-accepted omissions, not passed checks. All previous deployments, jobs, balances and permissions remain untouched.

## Français — parcours court

La création des contrats est distincte de leur configuration. Le parcours principal conserve le portefeuille Ledger déjà utilisé sur le Mac Studio et les pages Etherscan **Write Contract** des nouveaux contrats vérifiés. Le signataire personnalisé, le pont navigateur, les paquets de signature et la finalisation d'une session native de sept opérations ne sont pas nécessaires.

Avant toute liaison, `export` vérifie les cinq créations canoniques et produit leurs paquets exacts de sources. `submit-source` publie ces sources uniquement avec l'autorisation explicite liée au plan, au code et aux cinq créations, plus une clé configurée localement. `verify` ne fait que des lectures. Une soumission incertaine n'est jamais répétée automatiquement; le journal privé durable doit être conservé.

Après vérification exacte des cinq contrats, le propriétaire signe manuellement `bindMarketplace(nouveau marché)` sur le nouvel oracle, puis fournit son hash à `reconcile`. Après confirmation canonique, il signe `bindMark(nouveau MARK)` sur le nouveau marché et réconcilie ce second hash. Gouverneur : `0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99`; réseau 1; valeur ETH zéro; adresses, arguments et calldata exacts dans le rapport.

Une réponse perdue, un nonce en attente ou une liaison inconnue bloque la suite. Aucun renvoi, remplacement, financement, admission, retrait ou activation n'est proposé. Alpha n'a pas de pause globale; son état initial est non commissionné. L'autorité complète, les dépendances, le fournisseur et l'acceptation physique restent à démontrer. Aucun ancien contrat, solde, emploi ou droit n'est modifié.
