# AGI.Eth Namespace (alpha) — Quickstart

Use this checklist if you already know your role and just need the **correct inputs**.

## 1) Know your role

| Role | ENS name pattern | Example | `subdomain` input |
| --- | --- | --- | --- |
| Validator | `<entity>.alpha.club.agi.eth` | `alice.alpha.club.agi.eth` | `"alice"` |
| Agent | `<entity>.alpha.agent.agi.eth` | `helper.alpha.agent.agi.eth` | `"helper"` |
| Node (convention) | `<entity>.alpha.node.agi.eth` | `gpu01.alpha.node.agi.eth` | `"gpu01"` |

**Important:** `subdomain` is the left‑most label only. Do **not** pass the full ENS name.

---

## 2) Identity method (pick one)

- **ENS / NameWrapper ownership**, or
- **ENS resolver address** points to your wallet, or
- **Merkle allowlist** proof, or
- **Owner allowlist** via `additionalAgents` / `additionalValidators`.

If you are not using a Merkle allowlist, pass `[]` for `proof`.

---

## 3) Common calls (Etherscan “Write Contract”)

### Employer
1. `approve(AGIJobManager, amount)` on the ERC‑20 token.
2. `createJob(jobSpecURI, payout, duration, details)`.

### Agent
1. `applyForJob(jobId, "helper", proof)`.
2. `requestJobCompletion(jobId, jobCompletionURI)`.

### Validator
1. `validateJob(jobId, "alice", proof)`.
2. Or `disapproveJob(jobId, "alice", proof)`.

### Moderator
- `resolveDisputeWithCode(jobId, code, reason)` with `code = 0 (NO_ACTION)`, `1 (AGENT_WIN)`, or `2 (EMPLOYER_WIN)`.

---

## 4) Safety checklist

- ✅ Verify contract and token addresses.
- ✅ Use small amounts first.
- ✅ Avoid unlimited approvals; revoke afterward.
- ✅ Confirm you are on the right network.

---

## 5) Need more detail?

- Full guide: [`AGI_ETH_NAMESPACE_ALPHA.md`](AGI_ETH_NAMESPACE_ALPHA.md)
- Technical appendix: [`ENS_IDENTITY_GATING.md`](ENS_IDENTITY_GATING.md)
- FAQ / troubleshooting: [`FAQ.md`](FAQ.md)
