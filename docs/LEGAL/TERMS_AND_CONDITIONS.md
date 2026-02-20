# Terms & Conditions Authority Note

## Authoritative source

The authoritative Terms & Conditions for AGIJobManager are embedded in the smart contract source code at:

- [`contracts/AGIJobManager.sol`](../../contracts/AGIJobManager.sol)

Repository documentation summarizes how to locate and maintain references to these terms, but does not override the contract source text.

## Canonical public terms link

The contract text also references the canonical public Terms URL:

- <https://agialphaagent.com/>

If there is any discrepancy between human-facing documentation and the current contract source, treat the contract source as authoritative for this repository.

## How updates work

When Terms text changes in `contracts/AGIJobManager.sol`, update generated documentation and verify consistency:

```bash
npm run docs:gen
npm run docs:ens:gen
npm run docs:check
```

Commit both the human-facing documentation updates and the regenerated reference files in the same change set.

## Scope and non-legal note

This document is a repository maintenance and traceability guide for contributors. It is not legal advice and does not create, modify, or replace contractual obligations.
