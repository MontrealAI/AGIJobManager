# Second mainnet deployment: release review and operator checklist

This is a checklist for a **new** manager, not an instruction to redeploy or alter
an existing instance. Deployment, ownership acceptance and opening paid intake
are separate decisions. A successful test run does not establish a flawless
contract, an independent audit or authority to sign transactions.

## 1. Preserve the first instance

Start with the [recorded mainnet instance](../deployments/MAINNET_USDC_2026-10-10.md)
and [commissioning guide](../OPERATIONS/COMMISSIONING.md). That record is dated
operator evidence, not a live RPC observation. Keep the original deployment
checkout, compiler inputs, artifacts, journals, transaction receipts, namespace
and recovery instructions. Never compile or reinstall over the only saved copy.

Existing jobs, bonds and payment claims stay on their original manager. A new
manager does not migrate them or upgrade their bytecode. Do not reuse or revoke
old ENS permissions as a side effect of preparing the new deployment.

## 2. Freeze and qualify a separate candidate

Use a separate clean checkout of the exact reviewed commit. Record its full SHA
with `git rev-parse HEAD`; a release label or an earlier green CI run is not enough.
Use the committed lockfiles and Node version specified by CI. From the root:

```bash
npm ci
npm --prefix hardhat ci
npm run lint
npm run build
npm run size
npm test
npm --prefix hardhat run test:preflight
npm --prefix hardhat run test:deployment
npm run docs:check
```

Then complete every applicable gate in [testing](../TESTING.md) and
[mainnet qualification](../MAINNET_READINESS.md), including Foundry invariants,
static analysis, dependency checks, browser coverage and the pinned native-USDC
fork/cutover checks. Record command, exact source SHA, tool versions, exit status
and evidence location. Label blocked or unexecuted checks explicitly. Do not
substitute a focused test pass for the complete suite.

Review the final source and all eight fixed library links independently before
material exposure. If any Solidity, compiler, dependency patch or linking setting
changes, reproduce bytecode, size, gas and security qualification. Source inspection
or automated tooling alone is not an independent security audit.

The script checks the compiled profile and artifact/build consistency. It does
not prove that a source commit has passed all CI or that an auditor approved it.
Those are release-review responsibilities.

## 3. Confirm the intended policy, without silently changing defaults

The current model permits any employer to post while intake is open. Agent and
validator membership uses the configured ENS roots or explicit exceptions. There
is no employer invitation gate, aggregate escrow cap or global one-job limit.
A private interface cannot add these restrictions to permissionless contract calls.

Keep the existing economics and authority model unless a separate change is
reviewed. In particular:

- Fresh intake starts paused; settlement starts enabled; NFT admission starts off.
- Default successful-job validator allocation is 8%, followed by 30% and 10% of
  original cost to the two configured wallets, with the remainder to the agent.
  Unused reviewer allocations and rounding are described in the payout guide.
- `maxJobPayout` is a per-job limit, not total exposure. The source default is
  88,888,888 USDC; do not confuse it with the unapplied 100-USDC pilot proposal.
- Assignment is first eligible transaction, not reservation for a named worker.
- Intake must remain open through assignment. Closing intake does not block
  ordinary settlement; settlement pause also delays exits and lifecycle clocks.

If a strict private or aggregate-limited pilot is required, stop and qualify that
contract design separately. Do not describe manual monitoring as an atomic cap.
See the five [activation closeout groups](../OPERATIONS/PRODUCTION_ACTIVATION.md).

## 4. Prepare and check the new deployment profile

Follow the [Hardhat guide](../../hardhat/README.md). From the repository root:

```bash
npm --prefix hardhat run setup
npm --prefix hardhat run check:config:mainnet
```

Between these commands, review the generated private configuration. Independently
reconcile the intended owner and both fee recipients with the operator's approved
record; never copy historical addresses merely because they appear in a document.
The offline check needs no RPC, signing key or explorer key and sends nothing.
It does not establish address control or source qualification.

Use the intended signer arrangement for a complete Sepolia rehearsal, including
ownership acceptance, payout, refund, dispute and failed-payment recovery. Record
which paths were actually executed; a read-only plan is not that rehearsal.

For a keyless mainnet plan, configure the RPC and intended `DEPLOYER_ADDRESS`, then:

```bash
DRY_RUN=1 npm --prefix hardhat run deploy:mainnet
```

The preflight binds token and ENS dependency reads to one canonical block hash
using EIP-1898, and checks the block again before starting deployment. An endpoint
without canonical hash reads fails closed; there is no number-only fallback.
The resulting plan records that scope. State may change after the plan: it is a
snapshot, not a reservation, a total gas quote or permission to broadcast.

Keep the mainnet confirmation phrase unset while preparing and rehearsing. Only
the authorized operator proceeds to the separately documented broadcast step,
after reviewing total intended spend, signer, chain, source, recipients and plan.
No command in this checklist broadcasts to a public chain. Tests may transact on
a disposable local chain.

## 5. Recover safely and close activation gates

After an authorized deployment, preserve its unique journal and exact compiler
input immediately. If any command fails, it may already have broadcast. Inspect
the journal and canonical receipts before taking further action; running deploy
again does not resume it. Follow the keyless verification recovery instructions
in the Hardhat guide. Never edit success fields to bypass an incomplete check.

After the intended owner accepts ownership and reviews configuration, use the
saved receipt and reviewed complete NFT policy with the read-only readiness command.
It checks all five reserves, including deferred claims, against the USDC balance.
No missing reserve or malformed pause flag should qualify as an empty manager.
Readiness is still a technical snapshot, not an automatic intake-opening decision.

Close the remaining actual-participant, signer/incident-response, financial/policy
and operator-disclosure gates. Obtain independent final-source review and retain
its scope and unresolved findings. Only then can the owner make a separate
activation decision with deliberately limited, accurately described exposure.
