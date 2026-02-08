# Mainnet Deployment Checklist (AGIJobManager)

- Ensure contract ownership is a multisig (e.g., Safe) **before** funding on mainnet.
- Decide whether to enable `useEnsJobTokenURI` at launch:
  - If disabled, job completion NFTs will use `jobCompletionURI`.
  - If enabled, verify `ensJobPages` is correct and resilient; misconfiguration should not halt core flows.
- ENS configuration verification:
  - `jobsRoot` is configured as expected in ENS.
  - Resolver is set and returns the expected records.
  - `jobManager` is set to this deployed contract.
- Run Slither and unit tests; include at least one solvency invariant:
  - `balance >= lockedEscrow + lockedAgentBonds + lockedValidatorBonds`.
- Obtain an external review/audit before scaling TVL materially.
