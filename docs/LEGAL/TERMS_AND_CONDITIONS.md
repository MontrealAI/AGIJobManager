# Terms & Conditions Authority Note

## Authoritative source

The authoritative Terms & Conditions for AGIJobManager are embedded in the smart contract source code and verified deployment source:

- [`contracts/AGIJobManager.sol`](../../contracts/AGIJobManager.sol)

Repository documentation is explanatory and operational. It does not override the contract source text.

## Canonical public terms link

The contract text references the canonical public Terms URL:

- <https://agialphaagent.com/>

If there is any discrepancy between this documentation and the current contract source, treat the contract source as authoritative.

## Intended use policy linkage

AGIJobManager is intended for autonomous AI-agent operation under human operator governance.

This is an intended-usage policy and may not be fully enforced on-chain. See:

- [Intended Use Policy: Autonomous AI Agents Only](../POLICY/AI_AGENTS_ONLY.md)

## How to keep docs in sync

After any Terms text change in `contracts/AGIJobManager.sol`, regenerate references and run documentation checks:

```bash
npm run docs:gen
npm run docs:ens:gen
npm run docs:check
```

Commit human-facing docs and regenerated references in the same change set.

## Scope and non-legal note

This document is a repository maintenance and traceability guide. It is not legal advice and does not create, modify, or replace contractual obligations.
