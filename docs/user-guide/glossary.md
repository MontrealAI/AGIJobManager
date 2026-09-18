# Glossary — v1.0.2

- **USDC:** Native Circle token used for every job escrow, reward, and bond. It uses six decimals; 1 USDC is 1000000 base units.
- **ETH gas:** Ethereum's transaction fee, separate from USDC job economics.
- **Job cost / payout:** The full amount escrowed by the employer, before validator rewards and the two wallet shares.
- **Settlement wallets:** `wallet30` and `wallet10` receive fixed 30% and 10% shares of the original cost on successful jobs.
- **Allowance:** The USDC spending permission a wallet grants the manager. Approval is separate from posting a job or bond.
- **Bond:** A participant's separate USDC deposit; returned, awarded, or slashed according to the outcome.
- **Employer:** Posts and funds a job; receives a completion NFT when work settles successfully.
- **Agent:** The first eligible applicant assigned to a job; performs work and submits evidence.
- **NFT credential:** An eligible AGI-type NFT needed for assignment when the job’s posting-time policy requires it, in addition to identity authorization. It does not increase the payout percentage.
- **Validator:** Reviews submitted work and casts one bonded approval or disapproval vote.
- **Moderator:** An explicitly listed account that decides active disputes with a numeric resolution code.
- **Owner:** Account authorized to maintain bounded configuration, pause operations, and resolve stale disputes. Ownership changes require acceptance.
- **Finalization:** An explicit transaction that settles a job or opens a dispute when the relevant time/vote conditions allow. It is not automatic.
- **Merkle root / proof:** An on-chain allowlist commitment and a proof of wallet membership.
- **NameWrapper:** ENS contract used to check wrapped-name ownership or qualifying approvals.
- **Resolver address:** An ENS name's resolved wallet address, used as an identity fallback.
- **Label:** The part entered under the configured ENS root: use `helper`, not `helper.agent.agi.eth`.
- **Reserve:** USDC held for outstanding job escrow and bonds, unavailable for owner withdrawal.
