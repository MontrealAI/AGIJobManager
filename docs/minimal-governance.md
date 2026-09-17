# Identity lock and operating controls — v0.9.4

`lockIdentityConfiguration()` permanently disables selected identity wiring setters. It does not freeze all governance, force ENS-only membership, pause activity or repair a bad configuration. USDC is immutable independently of the lock.

| Setting | Guard before the lock | After the lock |
| --- | --- | --- |
| ENS Registry, NameWrapper, four role roots | Owner; all escrow/bond reserves zero | Frozen |
| Optional ENS job-page pointer | Owner; zero or deployed-contract address | Frozen |
| Additional agent/validator lists and Merkle roots | Owner | Remain mutable |
| Pause controls, moderators and supported policy settings | Their own function-specific guards | Remain available under those guards |
| Manager ownership | Two-step proposal/acceptance; renunciation disabled | Same two-step process |

Ordinary AGI Agent membership uses `agent.agi.eth` or `alpha.agent.agi.eth`; validator membership uses `club.agi.eth` or `alpha.club.agi.eth`. Additional lists and Merkle roots preserve owner-managed exceptions. Agents separately need an eligible NFT. Optional job pages do not replace participant identity checks.

Deploy the reviewed source with intake paused, verify source/runtime and ownership acceptance, then configure and rehearse identity, eligibility, policy and recovery. For optional ENS pages, verify both pointers, dedicated-root authority, actual delegated writes and terminal revocation. Preserve the original manager's jobs and namespace. Only then consider the irreversible locks; deployment-time locking is not the default. Historical Truffle migrations and their environment switches are retired.

`pauseIntake()` stops new work while safe settlement can continue. `pauseAll()` contains an incident affecting funds; verify both flags. Dispute resolution and surplus withdrawal require settlement enabled and their other guards. `withdrawUSDC()` cannot withdraw escrow or bonds and requires intake paused. Do not relax an emergency pause merely to withdraw.

Monitor all four reserves against the USDC balance, owner/pending owner, issuer restrictions, eligibility changes, identity events and actual settlement transfers. Use the [Hardhat guide](../hardhat/README.md), [owner runbook](OWNER_RUNBOOK.md) and [incident response](OPERATIONS/INCIDENT_RESPONSE.md) for supported commands. Mainnet and Sepolia use their canonical immutable Circle USDC; arbitrary token overrides are not a supported production path.
