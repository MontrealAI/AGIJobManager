# Ubuntu Hardhat creator, separate Ledger governor

This additive entry point implements the owner's October 16 clarification: the
owner enters a selected **creator** private key locally into the Ubuntu terminal.
The governor is explicitly `0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99` and must be a
different account. Subsequent governor configuration is a separate Mac Studio
Ledger workflow, ordinarily through MetaMask and the verified Etherscan contract.

The older `deploy:mainnet` command remains unchanged. It is **not** the hidden-TTY
entry point. No Solidity, compiler input, artifact, original deployment, fee
wallet, treasury, ENS custody, approval, or historical report is modified here.

## One user-run creation command

Use a complete reviewed checkout with its exact new wrapper checkpoint, existing
pinned dependencies, Node **22.23.2**, and a source-bound build catalog. Compile and
verify the source/build before entering any key. Never install, compile, import
unreviewed plugins, or source shell startup helpers after key entry.

Set only the public run-file path and local HTTPS RPC endpoints in the operator
shell. An endpoint can contain a provider credential: keep it local and do not
paste it into chat, screenshots, shell traces or public reports. The launcher
never prints endpoint text or provider exceptions. Disable shell tracing before
setting those values. Do not supply a private key through any environment value,
argument, `.env` file, redirected input, command substitution, or clipboard script.
The route rejects known secret/debug/injection environment channels and deployment
`.env` files. It does not load dotenv or stored Hardhat accounts.

From the reviewed repository root, the owner executes:

```sh
MANAGER_CREATOR_RUN=/absolute/operator/run.json \
node node_modules/hardhat/dist/src/cli.js \
  --config hardhat.creator.config.mjs run \
  --no-compile hardhat/scripts/deploy-core-tty.js --network mainnet
```

`MANAGER_READ_RPC_URL` and `MANAGER_RELAY_RPC_URL` must already identify the selected
HTTPS endpoints in that shell. They are separate bounded read and once-only raw
submission transports. The isolated Hardhat network has `accounts: []`; the
creator key is read later, inside the deployment-script process. No wallet SDK,
external signing packet, companion UI, browser raw export or Mac creation step is
required by this route.

The **public** external run file has exactly these fields:

```json
{
  "schema": "manager-tty-creator-run-v1",
  "mode": "new",
  "catalog": "/absolute/operator/catalog.json",
  "catalogSha256": "REVIEWED_64_HEX_SHA256",
  "buildId": "REVIEWED_BUILD_ID",
  "config": "/absolute/operator/core-config.json",
  "session": "/absolute/operator/new-session",
  "lockDirectory": "/absolute/operator/creator-locks",
  "finalityTimeoutSeconds": 1800,
  "pollIntervalSeconds": 15
}
```

`core-config.json` uses the existing exact
`manager-core-creation-config-v1` schema. It supplies the selected checksum creator
address, explicit governor acknowledgement, current reviewed canonical block,
nonce, bounded expiry, exact constructor values, nine individual type-2 gas/fee
envelopes and maximum total fee ceiling. Constructor roots remain in this order:
`club.agi.eth`, `agent.agi.eth`, `alpha.club.agi.eth`, `alpha.agent.agi.eth`.
The script never swaps the agent and Alpha-club roots, chooses fee wallets,
changes ownership or silently fills missing authority inputs.

Both input files and the catalog must be outside the reviewed checkout. The
session must be new in `new` mode; its parent and the shared lock directory must
already exist as real, exclusively controlled directories. Run/config files are
bounded regular files with a single link. The existing session code creates
private state and identity-bound locks; stale locks are never automatically removed.

## Offline inspection

Set the public run file's mode to `inspect` and use the same command. It verifies
the actual clean Git revision, selected catalog and all constructor/envelope
inputs, then prints the public plan with `readyToBroadcast: false`. It exits before
reading endpoint values, prompting for confirmation/key, creating operator state
or signing. No provider endpoint is required for inspection. This is source/build
inspection only: current chain state still requires new/resume preflight.

## Review and execution

1. Before key input, the script validates source, compiler/artifact catalog,
   mainnet, current creator/governor state, nonce, predicted addresses, canonical
   USDC operational checks, gas bounds and fee ceilings.
2. It prints the complete public plan. Review source/build identities, creator,
   chain, d76 governor, constructor roots/wallets, nine CREATE addresses and total
   fee ceiling. Type exactly `DEPLOY <full plan SHA256>` to authorize this bounded
   sequence. Declining reaches neither a key prompt nor a transaction.
3. Enter only the selected creator's `0x`-prefixed 32-byte key at the hidden local
   TTY prompt. The derived address must match. Never send the key to the assistant.
4. The process signs each **fixed type-2, zero-value, null-destination CREATE** in
   memory. It durably records the original handoff, signed transaction capability
   and submission attempt before sending. It never changes nonce, fees, gas,
   initcode or signature to retry a failure.
5. Each next operation waits for the prior exact successful **finalized** receipt,
   canonical runtime/link checks and expected current state. Mainnet finality can
   take materially longer than a few confirmations. Timeout means stop and
   reconcile; it does not authorize a replacement.
6. After eight libraries and Manager, the existing completion check requires
   d76 owner, zero pending owner, paused creation state, no direct creator
   moderator/agent/validator exception, exact four roots and fee wallets, and zero
   new jobs/reserves. It releases only its own matching creator lock.
7. Export the existing source-bound verification package from the completed
   session, submit its exact compiler/constructor/library data to Etherscan, and
   check explorer acceptance and chain readback. Actual deployment receipts and
   explorer acceptance are post-creation acceptance steps, not prerequisites that
   could exist before creation. Governor configuration, optional ENS/metadata and
   activation remain separately authorized transactions.

## Wallet selection and account code

Any selected account supported by the existing direct-origination profiles can
be the creator. Changing it **before any handoff/signature** requires regenerating
the exact nonce, CREATE addresses, plan and preflight. Once a capability exists,
reconcile it first; changing the run file is not a nonce-reuse mechanism.

An empty-code EOA uses `empty-eoa-direct-create.v1`. A marker-bearing EOA requires
the already-defined `marker-eoa-direct-create.v1` and its exact independently
reviewed consensus/direct-execution evidence bound to the source, build, block,
actor, target-code hash and all nine envelopes. This wrapper does not invent or
waive that evidence. It performs no call into creator/target code, self-call,
batching, factory creation, type-4 authorization or marker removal. The older
strict delegated profile remains unchanged and is not selected by this route.
An existing marker is account state, not permission to invoke it. Out-of-band
nonce/balance changes, compromised keys and other account activity remain risks.

## Interruption and limits

Run `mode: "resume"` only with the same reviewed core plan and session. Existing
handed-off/signed/attempted operations are reconciled **read-only before another
key prompt**. A known hash may wait for finality; a hashless handoff uses existing
bounded exact recovery. An unresolved capability stops the route. It never signs
again or automatically relays an old signed capability. After successful
reconciliation, only untouched `planned` operations can obtain new signatures.
Use the existing explicit journal inspection/repair workflow for a torn append;
this launcher adds no repair or stale-lock bypass.

The key is never intentionally written to a file, journal, environment, argument,
log or child input. Existing Git source observers still launch sanitized read-only
subprocesses, without the key in arguments/environment. The Wallet stays only in
the script process and references are released on success/failure. JavaScript,
V8 and ethers cannot guarantee erasure of immutable strings or memory copies.
A hidden prompt does not protect a compromised Ubuntu host, terminal, debugger,
clipboard, dependency or OS. It cannot restore a terminal after SIGKILL or repair
an uncooperative terminal driver. Keep operator files exclusively controlled;
identity rechecks do not guarantee safety against hostile swaps between checks.

This transport needs its own reviewed source checkpoint and disposable functional
acceptance. The retained d371/d953 hosted **96 + 30** cases qualify the earlier
contract/session source and remain unchanged; they do not retrospectively claim
this newly added TTY route was exercised. No live deployment is authorized by a
local test result.
