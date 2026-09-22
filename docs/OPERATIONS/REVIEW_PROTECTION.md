# Existing review-escrow recovery

New work uses [operator-budget admission without retainers](NO_RETAINERS.md). The public companion contract remains in the source for historical reproduction and existing-obligation recovery. Current deployment tooling refuses to create a new review escrow. Private services refuse new retainer approval, funding and activation.

## Existing credits and refunds

Preserve the original escrow address, code hash, funded assignments, policy, transaction journal and budget history. Activated earned credits remain owed to their original reviewer. Eligible unactivated retainers can be refunded under the existing contract's timing and job-state rules. A software update does not erase obligations or convert an old paid agreement into a new operator-budget job.

The private Employer and Node retain their existing recovery commands. The Node's new spending budget can coexist with its original recovery policy. Reconcile pending transactions and outstanding paid work before admitting replacement work. See [the private companion guide](PRIVATE_FLEET.md).

## Recover source verification of an existing escrow

Use the original release's deployment journal and compiler evidence. From the repository root, after installing the pinned toolchain:

```bash
DRY_RUN=1 npm --prefix hardhat run recover:review-escrow:mainnet
DRY_RUN=1 npm --prefix hardhat run recover:review-escrow:sepolia
```

Select one network. Set `JOB_MANAGER`, `JOB_MANAGER_CODE_HASH` and the mandatory `REVIEW_ESCROW_ADDRESS` in the reviewed private environment. The address must match the original `hardhat/deployments/<network>/review-escrow.<chainId>.<manager>.json` journal. The plan reads the manager and token and does not request a signer.

With `DRY_RUN=0`, the command requires `VERIFY_RPC_URL`, the original journal and successful receipt, sufficient confirmations, exact immutable manager/token bindings, matching runtime code and explorer verification. It sends no blockchain transaction and has no deployment branch. A missing address or original journal is an error, not permission to create another escrow. [Configuration reference](../DEPLOYMENT_CONFIGURATION.md#existing-review-escrow).

## Historical analysis

The offline `checkAdmission` API and lifecycle model can reproduce historical retainer policies and experiments. Current live callers must use `checkNewWork`; the CLI enforces that boundary. Earlier release archives preserve their original documentation and results. They do not describe the current operating policy.
