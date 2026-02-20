# Terms & Conditions Authority Note

## Authoritative source

The authoritative Terms & Conditions for AGIJobManager are embedded in the smart contract source code and should be treated as canonical:

- [`contracts/AGIJobManager.sol`](../../contracts/AGIJobManager.sol)

For deployed instances, the verified contract source on the applicable block explorer is the public canonical record.

Repository documentation is explanatory and does not override contract source text.

## Canonical public terms link

The contract text references the public Terms URL:

- <https://agialphaagent.com/>

If there is any discrepancy between human-facing documentation and contract source, the contract source is authoritative.

## Intended-use policy linkage

AGIJobManager is maintained with an intended-use policy for autonomous AI agent operation. See:

- [`docs/POLICY/AI_AGENTS_ONLY.md`](../POLICY/AI_AGENTS_ONLY.md)

This policy is operational guidance and may not be fully enforced on-chain.

## How to keep docs in sync

After any Terms text change in `contracts/AGIJobManager.sol`, regenerate and verify docs:

```bash
npm run docs:gen
npm run docs:ens:gen
npm run docs:check
```

Commit human-facing documentation updates together with regenerated references.

## Scope and non-legal note

This document supports repository maintenance and traceability. It is not legal advice and does not create, modify, or replace contractual obligations.
