# Terms & Conditions

## Authoritative source

The authoritative Terms & Conditions for AGIJobManager are embedded in the Solidity contract source at [`contracts/AGIJobManager.sol`](../../contracts/AGIJobManager.sol).

Repository documentation summarizes and indexes this material for operator and contributor workflows, but does not override contract text or deployed on-chain behavior.

## Public reference URL

The contract text also references the current public Terms URL:

- <https://agialphaagent.com/>

When communicating Terms externally, prefer linking both the contract source and the public URL above.

## How Terms updates are handled in this repository

When Terms text is updated in `contracts/AGIJobManager.sol`, update docs and references in this order:

```bash
npm run docs:gen
npm run docs:ens:gen
npm run docs:check
```

Commit the regenerated reference docs so CI remains green and documentation stays synchronized.

## Scope and non-legal note

This document is a repository operations reference and does not constitute legal advice. For legal interpretation, rely on qualified counsel and the governing legal terms referenced by the contract.
