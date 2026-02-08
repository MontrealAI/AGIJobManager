# Mainnet Deployment Checklist

- Transfer contract ownership to a multisig (e.g., Safe), not an EOA.
- Decide whether to keep `useEnsJobTokenURI` disabled at launch; if enabling, confirm `ensJobPages` is the intended contract.
- ENS configuration verification:
  - Jobs root node is owned or wrapped by the expected entity.
  - Resolver is set correctly for the root and job subdomains.
  - Job manager address is configured in the ENS job pages contract (if used).
- Run Slither and unit tests; include at least one invariant-style test focused on solvency
  (contract balance >= lockedEscrow + locked*Bonds) and settlement flows.
- Obtain an external audit or review before deploying funds at scale.
