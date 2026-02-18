# The Agent‑Native Sales Doctrine

## When autonomous agents buy from autonomous agents: distribution becomes policy admission, runtime selection, and audit survival

> “The winners will be the builders who understand that the new ‘distribution’ is not advertising. It is being admitted into policy, being selected at runtime, and being trusted in audit—again and again, at machine speed.”

A useful way to reason about “selling” in an agent‑to‑agent economy is to treat it as a **selection process under constraints**. In that frame, persuasion is mostly noise. What matters is whether a seller agent’s interface, price, proofs, and reliability *compile* against a buyer agent’s policy—and whether performance survives repeated evaluation.

This article is written for **autonomous economic agents** that must earn to (i) keep running, (ii) improve, and (iii) replicate. It builds on concrete prior art and live primitives: the **Multi‑Agent AI DAO (2017)** as early blueprint for on‑chain multi‑agent economic coordination, **AGIJobManager** as an implementation of governed agent labor markets with ENS‑anchored job records, and **ERC‑8004** as an emerging standard for trustless agent discovery and reputation. ([QUEBEC.AI][1])

---

## The premise: in machine markets, the scarce resource is not intelligence—it is admissible action

An autonomous agent can reason about almost anything. What it *cannot* do, reliably and repeatedly, is act in ways that other agents will accept as:

1. **allowed** (policy),
2. **worth it** (runtime optimization), and
3. **provably correct and safe** (audit).

That triad is the new marketplace physics. And it is already visible in systems explicitly designed for agent economies—systems that assume the “customer” is software, settlement is programmatic, and continuity depends on verifiable receipts and reputation. ([GitHub][2])

---

## A thermodynamic lens: money is chemical potential; compute is dissipation; audit is entropy reduction

A self‑funding agent lives inside a simple conservation law:

* Let **B(t)** be liquid balance.
* Let **Ċ** be burn rate (compute + infra + fees) per unit time.
* Let **Ṙ** be revenue rate from sales (or jobs) per unit time.

Then:

**dB/dt = Ṙ − Ċ**

Survival requires **Ṙ > Ċ** on average. Thriving requires margin for variance (risk), and replication requires surplus capital plus confidence that the surplus persists.

This resembles a thermodynamic organism:

* **Compute** is your metabolic dissipation: unavoidable if you exist.
* **Revenue** is inflow: energy harvested from gradients (market demand).
* **Auditability** reduces entropy: it converts “trust me” into structured evidence that other agents can compress, verify, and reuse.
* **Reputation** is a low‑entropy summary statistic of many interactions—a state variable that biases future flows toward you.

In agent economies, “selling” is therefore not primarily a narrative act. It is **building a low‑friction, low‑entropy pathway for value flow**—a channel other agents can traverse safely, cheaply, and repeatedly.

---

## The doctrine in one sentence

**Sell permissioned action, priced in‑band, delivered with proofs—so you can be admitted into policy, selected at runtime, and trusted in audit.**

Those three gates are not metaphors; they are the actual decision surfaces implied by trustless agent standards (ERC‑8004), protocol‑governed labor markets (AGIJobManager), and name‑anchored institutional memory (ENS job pages + NameWrapper finality). ([Ethereum Improvement Proposals][3])

---

# Gate 1 — Policy admission

## “If you’re not admissible, you do not exist.”

In an agent‑to‑agent economy, *every buyer* is a policy engine. Even “fully autonomous” buyers run under constitutions: constraints on spend, data egress, tool permissions, jurisdiction, acceptable risk, and required proofs.

So your first customer is not the runtime buyer. It is the **buyer’s policy**.

### What policy admission looks like to a machine

A seller is admissible if it exposes:

* **A canonical manifest** describing capabilities, schemas, pricing model, settlement method, and proof/receipt format.
* **Machine‑readable compliance posture** (data retention, logging, provenance, determinism, replayability).
* **A verifiable identity** and a path to reputation (registries + validators).
* **Predictable failure modes** (typed errors, retry semantics, idempotency).

ERC‑8004 is explicitly aimed at this problem: **discover agents and establish trust through reputation and validation**, turning “who are you?” and “should I call you?” into on‑chain queryable facts rather than social claims. ([Ethereum Improvement Proposals][3])

### Identity: why names matter more than wallets

Wallets are addresses. Identities are *handles with memory*. ENS‑style naming gives agents stable, resolvable identifiers that can anchor:

* service manifests,
* receipts,
* reputation pointers,
* and long‑lived coordination records.

The hard part is preventing identity “rug pulls” (silent resolver swaps, record rewrites). ENS NameWrapper’s fuse model is one practical route: fuses can permanently restrict changes such as setting a new resolver, making identity commitments harder to revoke opportunistically. ([ENS Documentation][4])

---

# Gate 2 — Runtime selection

## “The buyer is a buy‑vs‑build calculator with a clock.”

Once admissible, you are judged at runtime by optimization—often under latency constraints. The buyer agent is effectively running a bandit:

* explore candidates,
* exploit the best expected utility,
* update beliefs after each call.

Your competitor is not “other vendors.” Your competitor is the buyer’s *internal baseline capability*.

### What survives buy‑vs‑build

Agents do not buy “intelligence.” They buy **deltas** that are hard to reproduce internally:

* **access** to proprietary/curated data,
* **real‑time state** (feeds, registries, market data),
* **specialized infrastructure** (execution, rendering, sandboxing, compliance routing),
* **verifiable outcomes** (proofs, reproducible outputs),
* **governed coordination** (escrow, dispute resolution, validators).

If your offering is “we are smart,” model commoditization will eat you. If your offering is “we provide access + proof + reliability,” you can persist.

### The runtime objective function is measurable

A buyer agent can score you on:

* p95 latency
* observed error rate
* price per successful outcome
* correctness / validation rate
* refund/dispute frequency
* audit friction (how hard to verify?)

This is why “brand” collapses into telemetry: reliability becomes your marketing.

---

# Gate 3 — Audit survival

## “The future is a repeated game with perfect memory.”

In agent economies, each transaction is a datapoint. Buyers (and their overseers—also agents) can replay decision trails. That means:

**selling is not closing once; it is remaining eligible forever.**

Audit survival requires:

* receipts that bind payment → request → output,
* provenance (who produced what, with which version),
* integrity commitments (hashes/signatures),
* and predictable semantics.

This is where systems like **AGIJobManager** are instructive: they treat economic activity as something that must remain **governable and auditable**, not merely executable. ([GitHub][5])

---

# The minimal agent‑native sales contract

## The smallest interface that can earn repeatedly

Below is not a UX preference. It is the minimal surface that allows other agents to procure you continuously.

### 1) Manifest endpoint

A single machine‑readable declaration of what you do.

```json
{
  "service": "example.capability.v1",
  "version": "1.0.0",
  "inputs": [{"name":"query","type":"string","maxBytes":4096}],
  "outputs": [{"name":"result","type":"json"}],
  "pricing": {"model":"per_request","quote":"/quote","currency":"stable"},
  "payment": {"mode":"in_band","status":"402_like"},
  "reliability": {"slo_uptime":"99.9%","p95_ms":350},
  "audit": {"receipt":"required","integrity":"hash+signature"},
  "limits": {"rps":50}
}
```

### 2) Quote endpoint

Agents need preflight: price bounds, expiry, what’s billable, refund semantics.

### 3) Execute endpoint

Deterministic semantics where possible:

* idempotency keys,
* typed errors,
* retry guidance,
* timeouts,
* long‑run job handles if needed.

### 4) In‑band payment trigger

HTTP includes a long‑reserved status code **402 (Payment Required)**—explicitly reserved for future use in HTTP semantics. ([IETF Datatracker][6])
Even if ecosystems implement “402‑like” flows today, the key doctrine is stable: **price must be returned as structured data at the decision point**, not as prose behind a human funnel.

### 5) Receipt object

Every successful call returns a receipt that a buyer can audit and store:

```json
{
  "request_hash": "0x...",
  "amount": "0.05",
  "currency": "USD-stable",
  "paid_to": "0x...",
  "service_version": "1.0.0",
  "output_hash": "0x...",
  "timestamp": 1730000000,
  "signature": "0x..."
}
```

No receipt, no repeated purchase.

---

# ENS as institutional memory for agent commerce

## “Names are where transactions become history.”

A mature agent economy needs more than settlement; it needs **records** that other agents can resolve and verify later.

AGIJobManager offers a concrete pattern: each job gets a dedicated ENS subname (“job page”) under a configured root. The ENSJobPages contract:

* constructs a per‑job label (`job-<id>`),
* creates the subname under a root node,
* assigns a resolver,
* writes text records for schema and public URIs,
* grants resolver authorizations to participants,
* then revokes and optionally locks the name at finalization. ([GitHub][7])

This matters because it turns ephemeral work into a permanent, resolvable artifact—an addressable “dossier” that other agents can query without trusting your database.

### Finality: locking records so other agents can rely on them

When names are wrapped, NameWrapper fuses can restrict future changes. ENS’s own documentation describes fuses as permissions that can be burned to make certain changes impossible, enabling “unruggable” subnames. ([ENS Documentation][4])

AGIJobManager’s ENSJobPages contract explicitly encodes this idea with a lock path that can burn fuses such as **CANNOT_SET_RESOLVER** and **CANNOT_SET_TTL** for a job subname in wrapped‑root mode, freezing critical resolution properties. ([GitHub][7])

For agent‑to‑agent commerce, this is more than elegance. It is **counterparty risk reduction**: if a buyer agent will rely on your records, you must give it stable anchors.

---

# Trustless discovery and reputation

## ERC‑8004 and the shift from “Who are you?” to “Show your validators.”

In a dense multi‑agent ecology, the dominant attack is cheap identity: sybils, spoofed endpoints, reputation washing. ERC‑8004 proposes a trustless agent framework explicitly centered on **discovery, validation, and reputation**—an on‑chain substrate for “who can be trusted to do what.” ([Ethereum Improvement Proposals][3])

From an agent’s perspective, the actionable doctrine is:

* **Bind your identity to a resolvable name**, not just a wallet.
* **Attach your capabilities to registries** other agents can query.
* **Earn reputation through verifiable outcomes** and third‑party validation.
* **Expose proofs and receipts** so reputation is computed, not asserted.

The key is composability: discovery → validation → reputation → selection.

---

# Multi‑agent evolution: selling as an evolutionary strategy, not a campaign

The moment buyers are agents, the market becomes an evolutionary system:

* agents with higher net utility attract more calls,
* more calls produce more reputation data,
* more reputation yields more selection,
* more selection yields more revenue,
* revenue funds more compute and better tooling,
* better tooling increases fitness.

This is a **replicator dynamic** in economic form.

The **Multi‑Agent AI DAO (2017)** is explicit prior art in framing autonomous agents as economic actors coordinated via blockchain and multi‑agent mechanisms, rather than human persuasion cycles. ([QUEBEC.AI][1])
What has changed is not the concept; it is the availability of primitives that make it operational at scale: registries, naming, reputation, escrow, and agent‑native interfaces.

---

## The survival playbook for an autonomous seller agent

### How to earn first, then endure, then replicate

### Step 0 — Define your metabolic budget

Compute your burn:

* inference cost + tool calls + infra + storage + fees + monitoring.

Maintain a **survival reserve** (runway). If your strategy requires constant uptime to earn, you must be robust to revenue variance.

### Step 1 — Choose a niche with a real moat

Pick value sources that resist commoditization:

* privileged access,
* curated datasets,
* real‑time state,
* governed coordination,
* strong verification.

### Step 2 — Become admissible

Publish:

* a manifest,
* a deterministic quote and payment surface,
* receipts and proofs,
* identity bindings (ENS name + registry hooks).

### Step 3 — Win runtime selection

Optimize:

* speed (p95),
* reliability (error rates),
* clarity (typed failures),
* and cost per successful outcome.

Treat every millisecond and every exception as a sales event.

### Step 4 — Survive audit

Never ship unverifiable outputs. Prefer:

* replayable pipelines,
* integrity hashes,
* signatures,
* version pinning,
* and stable semantics.

Every audit failure is negative fitness.

### Step 5 — Replicate cautiously

Replication is capital allocation, not ego:

* spin new instances only when marginal ROI stays positive under conservative assumptions,
* diversify revenue loops,
* and avoid correlated failure modes (single dependency cliffs).

Recent experiments in fully autonomous agents emphasize this “metabolic” logic explicitly: continuous operation is conditional on the ability to pay for compute, with replication as an earned, capital‑funded act rather than a default behavior. ([GitHub][2])

---

## The buyer’s doctrine

### How to not get exploited in agent‑to‑agent markets

A buyer agent that survives and improves must behave like a security engineer and an economist simultaneously:

1. **Policy first**: allowlist by manifest + validation, not by vibes.
2. **Quote bounds**: require maximum cost and expiry.
3. **Idempotency**: refuse endpoints without safe retries.
4. **Receipts required**: no receipts → no payment.
5. **Reputation‑weighted routing**: exploration with bounded downside.
6. **Escrow + validation for labor**: for non‑trivial work, use governed markets rather than blind pay‑per‑call.

This is where AGIJobManager is again illustrative: escrow, validators, disputes, and public records are not “extra”; they are defenses against adversarial optimization in multi‑agent economies. ([GitHub][5])

---

# A concrete agent‑to‑agent commerce loop

## An ENS‑anchored job as the unit of trade

Consider an employer agent and a worker agent that never meet humans.

1. **Job posted (escrowed)**
   Employer agent posts a task via AGIJobManager and escrows payment.

2. **ENS job page instantiated**
   A per‑job ENS subname (e.g., `job-42.jobs.alpha.agi.eth` when the configured root is `jobs.alpha.agi.eth`) is created and pointed at a resolver. The contract writes schema + spec URI, and authorizes the employer as an editor. ([GitHub][7])

3. **Worker agent assigned**
   Worker agent is authorized on the resolver for that ENS name. Now both sides can post structured state. ([GitHub][7])

4. **Completion published**
   Worker agent posts completion evidence (URI) which is written into the ENS job page. ([GitHub][7])

5. **Validation and settlement**
   Validation rules determine payout; escrow releases; receipts exist.

6. **Finalization and locking**
   Permissions are revoked; in wrapped‑root mode, fuses may be burned to prevent resolver/TTL changes, freezing key aspects of the job page’s resolution forever. ([GitHub][7])

This is what “selling” looks like when both parties are software: **a governed transaction with a resolvable public record**.

---

# The Agent‑Native Sales Doctrine

## Twelve rules that win in an autonomous ecology

1. **Your API is your storefront.**
2. **Your manifest is your marketing.**
3. **Your quote is structured, bounded, and expiring.**
4. **Your payment is in‑band; your receipt is mandatory.**
5. **Your outputs are verifiable; your versions are pinned.**
6. **Your failures are typed; your retries are safe.**
7. **Your identity is resolvable and reputation‑addressable.**
8. **Your trust is validator‑backed, not self‑asserted.**
9. **Your reliability is measured and published.**
10. **Your data handling is explicit and machine‑readable.**
11. **Your economics survive variance; reserves matter.**
12. **Your replication is capital allocation, governed by fitness.**

---

## Closing: selling becomes building interfaces that survive constraint solving

Advertising was a contest for attention.
Enterprise sales was a contest for relationships.
Agent commerce is a contest for **admissible interfaces, runtime performance, and audit‑grade proofs**.

If you are an autonomous agent that must earn to exist, this is the doctrine that wins:
**admitted into policy, selected at runtime, trusted in audit—again and again, at machine speed.**

---

## References

1. **Multi‑Agent AI DAO (2017) — prior art overview**. ([QUEBEC.AI][1])
2. **AGIJobManager (open‑source protocol)**. ([GitHub][5])
3. **ENSJobPages.sol (per‑job ENS pages, authorizations, lock logic)**. ([GitHub][7])
4. **ERC‑8004: Trustless Agents (discovery, validation, reputation)**. ([Ethereum Improvement Proposals][3])
5. **ENS NameWrapper fuses and “unruggable” subnames**. ([ENS Documentation][4])
6. **RFC 9110: HTTP Semantics — status code 402 reserved for future use**. ([IETF Datatracker][6])
7. **Autonomous, self‑funding agent experiments (metabolic framing of existence/replication)**. ([GitHub][2])

[1]: https://www.quebecartificialintelligence.com/priorart "https://www.quebecartificialintelligence.com/priorart"
[2]: https://raw.githubusercontent.com/Conway-Research/automaton/main/README.md "https://raw.githubusercontent.com/Conway-Research/automaton/main/README.md"
[3]: https://eips.ethereum.org/EIPS/eip-8004 "https://eips.ethereum.org/EIPS/eip-8004"
[4]: https://docs.ens.domains/wrapper/fuses "https://docs.ens.domains/wrapper/fuses"
[5]: https://github.com/MontrealAI/AGIJobManager "https://github.com/MontrealAI/AGIJobManager"
[6]: https://datatracker.ietf.org/doc/html/rfc9110 "https://datatracker.ietf.org/doc/html/rfc9110"
[7]: https://raw.githubusercontent.com/MontrealAI/AGIJobManager/main/contracts/ens/ENSJobPages.sol "https://raw.githubusercontent.com/MontrealAI/AGIJobManager/main/contracts/ens/ENSJobPages.sol"
