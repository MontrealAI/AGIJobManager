// SPDX-License-Identifier: MIT

/*

[ A G I J O B M A N A G E R  ( A G I J O B S  N F T )  T E R M S  A N D  C O N D I T I O N S ]

Published by: ALPHA.AGI.ETH
Approval Authority: ALPHA.AGI.ETH
Office of Primary Responsibility: ALPHA.AGI.ETH
Effective Date: The earlier of (i) your first interaction with the AGIJobManager smart contract on any chain, or (ii) the date you access or use any interface that facilitates such interaction.
OVERRIDING AUTHORITY: AGI.ETH

These Terms and Conditions (the "Terms") govern your access to and use of the AGIJobManager smart contract system (the "Protocol"), including any associated ERC-721 tokens minted by the Protocol (the "AGIJobs NFTs"). By calling, signing, submitting, or otherwise authorizing any transaction that interacts with the Protocol (directly or via any front-end), you agree to be bound by these Terms.

If you do not agree, do not use the Protocol.

IMPORTANT: The Protocol is experimental software. Smart contracts can fail, behave unexpectedly, or be exploited. Interacting with the Protocol can result in the total loss of digital assets. You assume all risks.

1. Definitions

- "Protocol" / "AGIJobManager": The AGIJobManager smart contract(s) implementing job posting, assignment, escrow, bonds, validation, disputes, and settlement.
- "$AGIALPHA": The ERC-20 token used by the Protocol for job payouts, validator rewards, agent/validator/dispute bonds, and any protocol-retained amounts.
- "Employer": Any person or entity that posts a Job and escrows a payout in $AGIALPHA.
- "Agent": Any person or entity that applies for, performs, and requests completion of a Job.
- "Validator": Any person or entity that votes to approve or disapprove a Job completion request under the Protocol rules, posting any required validator bond.
- "Moderator": An address designated by the Protocol owner with permission to resolve disputes through the Protocol's dispute-resolution functions.
- "Owner": The address holding administrative permissions in the Protocol (e.g., pausing, parameter updates, allowlist/blacklist management, moderator management, delisting unassigned jobs, and withdrawing certain withdrawable balances as permitted by the code).
- "Job": A work request defined by an on-chain job id plus off-chain/on-chain references (e.g., jobSpecURI, details, and later jobCompletionURI).
- "Job Spec URI": A URI describing the Job requested by the Employer.
- "Job Completion URI": A URI submitted by the Agent describing or containing the completion deliverable(s).
- "Escrow": The $AGIALPHA amount deposited by the Employer as the Job payout and held by the Protocol until settlement according to code.
- "Bonds": Any $AGIALPHA amounts posted as Agent bonds, Validator bonds, or Dispute bonds per the Protocol.
- "Settlement": The Protocol's distribution of escrowed payout and bonds according to the on-chain rules.
- "User Content": Any Job Spec URI, Job Completion URI, details, or any referenced content (including IPFS/HTTP content) supplied by users.

2. Nature of the Protocol; No Intermediary; Code Controls

1) Self-executing software. The Protocol is a set of smart contracts that execute transactions according to on-chain code. Outcomes (assignment, settlement, dispute states, reward allocation, slashing, etc.) are determined by the code and blockchain conditions.
2) No employment agency / marketplace operator role. The Protocol is not an employer, employment agency, staffing firm, contractor, broker, payment processor, escrow agent, fiduciary, or financial institution.
3) No party to user agreements. Any agreement regarding work scope, quality standards, deliverables, deadlines, confidentiality, IP ownership, compliance obligations, and payment terms exists only between the Employer and the Agent (and, if applicable, between either of them and any Validator). The Protocol is not a party to those agreements and has no obligations under them.
4) Code prevails. If these Terms conflict with the deployed code, the code prevails for on-chain behavior. These Terms allocate risk and responsibilities and govern off-chain expectations to the maximum extent permitted.

3. Eligibility; Sanctions; Legal Compliance (User Responsibility)

You represent, warrant, and covenant that:

- You have the legal capacity and authority to enter into these Terms.
- Your use of the Protocol is compliant with all applicable laws and regulations (present and future), including (without limitation) labor and employment laws, tax laws, consumer protection laws, IP laws, data protection laws, anti-bribery laws, export controls, and sanctions.
- You are not located in, organized under, or ordinarily resident in any jurisdiction where use of the Protocol would be unlawful.
- You are not subject to sanctions or on any restricted party lists, and you will not use the Protocol to transact with sanctioned parties or prohibited jurisdictions.

All compliance obligations are solely yours (Employer/Agent/Validator, as applicable). The Protocol does not perform KYC/AML checks and does not provide compliance advice or compliance services.

4. Roles and Exclusive Responsibilities

4.1 Employer Responsibilities (Exclusive)
The Employer is solely and exclusively responsible for:

- The legality, accuracy, and completeness of the Job description, Job Spec URI, details, and any referenced content.
- Ensuring the Job does not solicit or require unlawful acts, regulated acts without permits, infringement, malware, fraud, or rights violations.
- Determining whether a Job creates (or could be interpreted as creating) an employment relationship, and satisfying all obligations associated with such classification, including payroll, withholding, insurance, benefits, reporting, and worker protections.
- All tax obligations relating to posting the Job, escrowing $AGIALPHA, receiving any refunds, or any other token transfers.
- Any off-chain contracting, NDAs, IP assignments/licenses, confidentiality terms, acceptance criteria, warranties, or service levels for the Job.

4.2 Agent Responsibilities (Exclusive)
The Agent is solely and exclusively responsible for:

- Performing the Job in accordance with any off-chain agreement with the Employer.
- Ensuring all deliverables and the Job Completion URI content are lawful and do not violate third-party rights.
- All tax obligations relating to receiving $AGIALPHA payments, posting or forfeiting Agent bonds, or receiving any additional settlement amounts.
- Maintaining operational security of wallets, private keys, endpoints, and any systems used to perform Jobs.
- Understanding that Agent bonds may be forfeited under certain settlement paths per the code.

4.3 Validator Responsibilities (Exclusive)
Each Validator is solely and exclusively responsible for:

- Performing independent diligence before approving/disapproving completion, and voting honestly according to their own judgment and any standards they adopt or communicate.
- All consequences of their votes, including the possibility of slashing or reduced returns per the Protocol rules.
- All tax obligations relating to validator rewards, bond returns, slashing outcomes, and any other transfers.
- Compliance with all applicable laws (including any professional, licensing, or regulatory obligations that might apply to their validation activity).
- Avoiding bribery, collusion, or manipulation; recognizing that the Protocol's incentives may not prevent manipulation and that participation is at their own risk.

4.4 No Reliance on Validators, Moderators, or Owner

- Employers and Agents acknowledge that Validator participation may be insufficient, adversarial, mistaken, or absent.
- Moderators (where enabled) may act at their discretion, may be unavailable, and owe no duty to any user.
- The Owner may pause or restrict functions per the code and owes no duty to keep the Protocol available or to resolve disputes.

5. Job Lifecycle and Core Mechanics (Disclosure)

This section summarizes expected mechanics; the deployed code controls.

5.1 Posting a Job (Employer)

- To post a Job, the Employer escrows the full payout amount in $AGIALPHA into the Protocol.
- The Employer provides a Job Spec URI and optional details.
- Jobs may have maximum payout and duration limits set by the Protocol.

5.2 Applying / Assignment (Agent)

- A Job may be assigned to the first eligible Agent who successfully applies under the Protocol rules.
- Eligibility may depend on authorization mechanisms (e.g., allowlists, Merkle proofs, or ENS-based authorization).
- The Protocol may require an Agent bond (computed by code) to be posted at application/assignment time.
- The Agent's payout percentage may be determined by the Agent's holdings of specific NFT types configured in the Protocol and snapshotted at assignment time.

5.3 Completion Request (Agent)

- The Agent requests completion by submitting a Job Completion URI within the permitted time windows enforced by the Protocol.
- The Protocol may enforce review periods and timeouts.

5.4 Validation Voting (Validators)

- Authorized Validators may approve or disapprove during the completion review window.
- Validator voting may require posting a Validator bond per vote (computed by code).
- Validator votes can trigger:
  - Approval threshold reached (with a subsequent challenge window before settlement), or
  - Disapproval threshold reached, which may put the Job into dispute.

5.5 Finalization / Settlement (Anyone may be able to call)

- After the applicable review/challenge windows, settlement can occur according to the Protocol logic, including outcomes where:
  - The Agent wins (payout to Agent, validator rewards distributed, remainder retained by protocol), or
  - The Employer wins (refund to Employer, validator settlement, possible agent bond forfeiture), or
  - A dispute is forced due to insufficient participation or ties.

5.6 Expiration

- If conditions in the code are met (e.g., time elapsed without completion request), a Job may be expired, which can trigger refund mechanics and bond settlement.

5.7 Cancellation / Delisting

- An Employer may be able to cancel an unassigned Job (per code).
- The Owner may delist/cancel unassigned Jobs (per code).
- Users acknowledge there is no obligation to keep a Job listed or available.

6. Disputes; Moderation; No Duty to Resolve

1) Dispute initiation. A dispute may be initiated by an Employer or Agent (and/or may be triggered by validator disapproval thresholds) as permitted by the code. Disputes may require a Dispute bond in $AGIALPHA.
2) Moderator resolution. Where enabled, Moderators may resolve disputes using the Protocol's dispute code mechanism (e.g., settle in favor of Agent or Employer).
3) No obligation; no SLA. The Protocol, Owner, and Moderators have no obligation to resolve disputes within any timeframe (or at all), except as the code permits. Any reliance on moderator action is at user risk.
4) Off-chain disputes remain off-chain. The Protocol cannot adjudicate legal questions (fraud, IP infringement, breach of contract, misrepresentation, employment classification, etc.). Those issues are solely between users and must be handled off-chain.

7. Protocol Economics; Fees; Retained Remainder Disclosure

1) Validator reward budget. The Protocol may allocate a portion of the Job payout as a validator reward budget (as snapshotted per job) for distribution to participating Validators, subject to code rules.
2) Bond returns and slashing. Validator bonds may be returned in full, partially slashed, or redistributed depending on whether a Validator ends up on the correct side of the final outcome, as defined by the code.
3) Protocol-retained remainder (platform revenue). On certain settlement paths (including Agent-win), the Protocol may retain the remainder of the Job payout after Agent and Validator allocations. This remainder may become withdrawable by the Owner under conditions specified in the code (e.g., when paused and when not backing active escrows/bonds).
4) No refunds from the Protocol. Token movements are governed by the smart contract; there is no guarantee of reversal, refunds, or discretionary recovery.
5) Gas fees. Users pay their own gas/transaction fees and accept the risk of network congestion, failed transactions, MEV, reorgs, and other chain-level issues.

8. Taxes, Withholding, Reporting (Exclusive User Responsibility)

The Employer, Agent, and each Validator are exclusively responsible for:

- Determining and paying any and all taxes (income, payroll, self-employment, VAT/GST/sales tax, withholding, capital gains, information reporting, etc.) arising from:
  - Job payouts, validator rewards, protocol distributions, refunds;
  - Posting, returning, or forfeiting bonds;
  - Token price volatility and taxable events in their jurisdiction.
- Maintaining records and issuing any required invoices, receipts, and tax forms.
- Handling any withholding obligations, if applicable.

The Protocol does not provide tax advice, does not withhold taxes, and does not issue tax forms.

9. No Employment Relationship; Independent Contractors Only

1) No employment relationship created by the Protocol. Nothing in the Protocol or these Terms creates an employment, partnership, joint venture, agency, fiduciary, or franchise relationship between:
   - The Protocol (or its publishers/maintainers/Owner/Moderators) and any user; or
   - Any Employer and any Agent, unless they separately create such a relationship off-chain.
2) Employer classification duty. The Employer is solely responsible for worker classification and compliance with all related obligations.
3) No benefits. The Protocol does not provide benefits, insurance, or protections to any user.

10. User Content; Intellectual Property; Confidentiality

1) User Content is user responsibility. Employers and Agents (and any Validators who publish content) are solely responsible for any User Content they submit or reference, including legality, accuracy, and IP permissions.
2) No IP transfer by default. The Protocol and AGIJobs NFTs do not automatically transfer or license intellectual property rights. Any IP transfer/license must be agreed off-chain between the relevant parties.
3) Public nature of blockchains. On-chain actions are public. URIs and referenced content may be publicly accessible. Do not submit sensitive personal data or confidential information unless you accept that risk and have the rights to do so.

11. Prohibited Uses

You may not use the Protocol to:

- Violate any law or regulation (including sanctions, export controls, labor laws, tax laws, or consumer protection laws).
- Post or perform Jobs involving fraud, theft, violence, doxxing, harassment, malware, exploitation, or rights infringement.
- Circumvent authorization/eligibility mechanisms or use compromised wallets/keys.
- Engage in bribery, collusion, or manipulation of Validator voting or dispute outcomes.

The Owner may maintain blacklists or otherwise restrict participation as permitted by the code. Such actions are discretionary and create no duty.

12. Assumption of Risk (Smart Contract and Crypto Risks)

You acknowledge and accept, without limitation, the risks of:

- Smart contract bugs, exploits, reentrancy, logic errors, and unforeseen interactions.
- Chain congestion, MEV/front-running, reorgs, downtime, and client bugs.
- Token volatility, illiquidity, and loss of value of $AGIALPHA.
- Validator non-participation, collusion, bribery, or incorrect outcomes.
- Irreversible transactions and the impossibility of guaranteed recovery.
- Loss of private keys or compromised wallets.

13. Disclaimers; No Warranties

To the maximum extent permitted by law:

- The Protocol and any related materials are provided "AS IS" and "AS AVAILABLE".
- No warranties are provided, including warranties of merchantability, fitness for a particular purpose, non-infringement, accuracy, security, uptime, or that any particular outcome will be achieved.
- No statement in documentation, interfaces, community channels, or elsewhere creates any warranty or duty.

14. Limitation of Liability

To the maximum extent permitted by law:

- In no event shall the Protocol, its publishers, maintainers, contributors, Owner, Moderators, or any related persons be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or any loss of profits, revenue, data, goodwill, or digital assets, arising out of or related to your use of the Protocol.
- Any liability that cannot be excluded is limited to the minimum amount permitted by law.

All liability for Jobs, deliverables, validation activities, disputes, taxes, and compliance rests exclusively with Employers, Agents, and Validators.

15. Indemnification

To the maximum extent permitted by law, you agree to defend, indemnify, and hold harmless the Protocol, its publishers, maintainers, contributors, Owner, Moderators, and related persons from and against any and all claims, demands, actions, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising out of or related to:

- Your use of the Protocol;
- Any Job you post, perform, validate, approve/disapprove, dispute, or otherwise participate in;
- Any User Content you submit or reference;
- Your breach of these Terms; or
- Your violation of any law or third-party rights.

16. Governing Law; Forum; User-to-User Disputes

1) User-to-user disputes. Any dispute between an Employer, Agent, and/or Validator is strictly between those parties. The Protocol (and its publishers/maintainers/Owner/Moderators) is not a party and shall not be named as such to the extent permitted.
2) Governing law for user-to-user disputes. User-to-user disputes shall be governed by the laws applicable to those users and their off-chain agreement(s), if any.
3) Protocol not subject to jurisdiction. You agree that you will not seek to impose jurisdiction over the Protocol as a party to any user-to-user dispute, to the maximum extent permitted by law.

17. Changes to Terms; Continued Use

- The publisher may publish updated Terms from time to time (including at a canonical URL or IPFS link).
- Continued use of the Protocol after publication of updated Terms constitutes acceptance of those updated Terms to the extent permitted by law.
- Historic on-chain behavior remains governed by the deployed code and the blockchain state.

18. Severability; Entire Agreement; No Waiver

- Severability: If any provision is held invalid or unenforceable, the remaining provisions remain in full force.
- Entire Agreement: These Terms constitute the entire agreement between you and the publisher regarding your use of the Protocol (without affecting any separate agreements between users).
- No Waiver: Failure to enforce any provision is not a waiver.

Regulatory Compliance & Legal Disclosures (Token and Program)

1) Utility Token Only: $AGIALPHA is intended as a utility token used within an experimental system (including paying for protocol-defined interactions, payouts, and bonds). It is not intended to represent equity, ownership, profit-sharing, or voting rights in any entity.
2) No Expectation of Profit: Any expectation of profit, yield, or return is unjustified.
3) No Guarantee of Value: No party guarantees any value, price stability, or liquidity of $AGIALPHA.
4) Non-Refundable Token Purchases: Where applicable, token acquisitions are final and non-refundable, subject to mandatory consumer laws that cannot be waived.
5) User Compliance Responsibility: Users are solely responsible for ensuring acquisition, holding, and use of $AGIALPHA complies with all laws in their jurisdiction, including securities, commodities, consumer, tax, and AML-related obligations that may apply to them.

Research Program Notice; No Warranty

THIS IS PART OF AN ASPIRATIONAL RESEARCH PROGRAM WITH AN AMBITIOUS RESEARCH AGENDA. ANY EXPECTATION OF PROFIT OR RETURN IS UNJUSTIFIED. POSSESSION OF $AGIALPHA DOES NOT SIGNIFY OR ESTABLISH ANY ENTITLEMENT OR INTEREST, SHARE OR EQUITY, BOND OR ANALOGOUS ENTITLEMENT, OR ANY RIGHT TO OBTAIN ANY FUTURE INCOME. MATERIALS PROVIDED IN THIS SYSTEM ARE WITHOUT WARRANTY OF ANY KIND AND DO NOT CONSTITUTE ENDORSEMENT AND CAN BE MODIFIED AT ANY TIME. BY USING THE PRESENT SYSTEM, YOU AGREE TO THE $AGIALPHA TERMS AND CONDITIONS. ANY USE OF THIS SYSTEM, OR ANY OF THE INFORMATION CONTAINED HEREIN, FOR OTHER THAN THE PURPOSE FOR WHICH IT WAS DEVELOPED, IS EXPRESSLY PROHIBITED, EXCEPT AS AGI.ETH MAY OTHERWISE AGREE TO IN WRITING OFFICIALLY.

OVERRIDING AUTHORITY: AGI.ETH

By interacting with the AGIJobManager smart contract, you acknowledge that you have read, understood, and agree to be bound by these Terms.

--------------------------------------------------------------------------------

[ R E G U L A T O R Y  C O M P L I A N C E  &  L E G A L  D I S C L O S U R E S ]

Published by: ALPHA.AGI.ETH

Approval Authority: ALPHA.AGI.ETH

Office of Primary Responsibility: ALPHA.AGI.ETH

Initial Terms & Conditions

The Emergence of an AGI-Powered Alpha Agent.

Ticker ($): AGIALPHA

Rooted in the publicly disclosed 2017 "Multi-Agent AI DAO" prior art, the AGI ALPHA AGENT utilizes $AGIALPHA tokens purely as utility tokens—no equity, no profit-sharing—to grant users prepaid access to the AGI ALPHA AGENT’s capabilities. By structuring $AGIALPHA as an advance payment mechanism for leveraging ALPHA.AGENT.AGI.Eth’s AI-driven services, holders likely avoid securities classification complexities. By purchasing these tokens, you gain usage credits for future AI services from the AGI ALPHA AGENT. Instead of representing ownership or investment rights, these tokens simply secure the right to interact with and benefit from the AGI ALPHA AGENT’s intelligence and outputs. This model delivers a straightforward, compliance-friendly approach to accessing cutting-edge AI functionalities, ensuring a seamless, equity-free experience for all participants.

1. Token Usage: $AGIALPHA tokens are strictly utility tokens—no equity, no profit-sharing—intended for the purchase of products/services by the AGI ALPHA AGENT (ALPHA.AGENT.AGI.Eth). They are not intended for investment or speculative purposes.

2. Non-Refundable: Purchases of $AGIALPHA tokens are final and non-refundable.

3. No Guarantee of Value: The issuer does not guarantee any specific value of the $AGIALPHA token in relation to fiat currencies or other cryptocurrencies.

4. Regulatory Compliance: It is the user’s responsibility to ensure that the purchase and use of $AGIALPHA tokens comply with all applicable laws and regulations.

5. User Responsibility: Users are responsible for complying with the laws in their own jurisdiction regarding the purchase and use of $AGIALPHA tokens.

OVERRIDING AUTHORITY: AGI.Eth

$AGIALPHA is experimental and part of an ambitious research agenda. Any expectation of profit is unjustified.

Materials provided (including $AGIALPHA) are without warranty. By using $AGIALPHA, you agree to the $AGIALPHA Terms and Conditions.

Changes to Terms: The issuer may revise these terms at any time, subject to regulatory compliance. Current Terms & Conditions: https://agialphaagent.com/.

THIS IS PART OF AN ASPIRATIONAL RESEARCH PROGRAM WITH AN AMBITIOUS RESEARCH AGENDA. ANY EXPECTATION OF PROFIT OR RETURN IS UNJUSTIFIED. POSSESSION OF $AGIALPHA DOES NOT SIGNIFY OR ESTABLISH ANY ENTITLEMENT OR INTEREST, SHARE OR EQUITY, BOND OR ANALOGOUS ENTITLEMENT, OR ANY RIGHT TO OBTAIN ANY FUTURE INCOME. MATERIALS PROVIDED IN THIS SYSTEM ARE WITHOUT WARRANTY OF ANY KIND AND DO NOT CONSTITUTE ENDORSEMENT AND CAN BE MODIFIED AT ANY TIME. BY USING THE PRESENT SYSTEM, YOU AGREE TO THE $AGIALPHA TERMS AND CONDITIONS. ANY USE OF THIS SYSTEM, OR ANY OF THE INFORMATION CONTAINED HEREIN, FOR OTHER THAN THE PURPOSE FOR WHICH IT WAS DEVELOPED, IS EXPRESSLY PROHIBITED, EXCEPT AS AGI.ETH MAY OTHERWISE AGREE TO IN WRITING OFFICIALLY.

OVERRIDING AUTHORITY: AGI.ETH

*/

pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./utils/UriUtils.sol";
import "./utils/TransferUtils.sol";
import "./utils/BondMath.sol";
import "./utils/ReputationMath.sol";
import "./utils/ENSOwnership.sol";

// NOTE: keep utility libraries externally linked to avoid EIP-170 bytecode regressions.

interface ENS {
    function resolver(bytes32 node) external view returns (address);
}

interface NameWrapper {
    function ownerOf(uint256 id) external view returns (address);
}



contract AGIJobManager is Ownable, ReentrancyGuard, Pausable, ERC721 {
    // -----------------------
    // Custom errors (smaller bytecode than revert strings)
    // -----------------------
    error NotModerator();
    error NotAuthorized();
    error Blacklisted();
    error InvalidParameters();
    error InvalidState();
    error JobNotFound();
    error TransferFailed();
    error ValidatorLimitReached();
    error InvalidValidatorThresholds();
    error IneligibleAgentPayout();
    error InsufficientWithdrawableBalance();
    error InsolventEscrowBalance();
    error ConfigLocked();
    error SettlementPaused();

    IERC20 public agiToken;
    string private baseIpfsUrl;
    // Conservative hard cap to bound settlement loops on mainnet.
    uint256 public constant MAX_VALIDATORS_PER_JOB = 50;
    uint256 public constant MAX_AGI_TYPES = 32;
    uint256 public requiredValidatorApprovals = 3;
    uint256 public requiredValidatorDisapprovals = 3;
    uint256 public voteQuorum = 3;
    uint256 public premiumReputationThreshold = 10000;
    uint256 public validationRewardPercentage = 8;
    uint256 public maxJobPayout = 88888888e18;
    uint256 public jobDurationLimit = 10000000;
    uint256 public completionReviewPeriod = 7 days;
    uint256 public disputeReviewPeriod = 14 days;
    uint256 internal constant MAX_REVIEW_PERIOD = 365 days;
    bool public settlementPaused;
    uint256 internal constant DISPUTE_BOND_BPS = 50;
    uint256 internal constant DISPUTE_BOND_MIN = 1e18;
    uint256 internal constant DISPUTE_BOND_MAX = 200e18;
    /**
     * @notice Validator bond/slashing parameters and challenge window.
     * @dev Validators post a bond per vote; correct-side validators split rewards + slashed bonds.
     *      Incorrect-side validators receive only the un-slashed bond portion. After approval
     *      thresholds are met, a short challenge window prevents instant settlement. When validators
     *      participate and the employer wins, the refund is reduced by the validator reward pool.
     */
    uint256 public validatorBondBps = 1500;
    uint256 public validatorBondMin = 10e18;
    uint256 public validatorBondMax = 88888888e18;
    uint256 public validatorSlashBps = 8000;
    uint256 public challengePeriodAfterApproval = 1 days;
    /// @dev Validator incentives are final-outcome aligned; bonds + challenge windows mitigate bribery but do not eliminate it.
    /// @dev Minimum agent bond.
    uint256 public agentBond = 1e18;
    uint256 public agentBondBps = 500;
    uint256 public agentBondMax = 88888888e18;
    /// @notice Total AGI reserved for unsettled job escrows.
    /// @dev Tracks job payout escrows only.
    uint256 public lockedEscrow;
    /// @notice Total AGI locked as agent performance bonds for unsettled jobs.
    uint256 public lockedAgentBonds;
    /// @notice Total AGI locked as validator bonds for unsettled votes.
    uint256 public lockedValidatorBonds;
    /// @notice Total AGI locked as dispute bonds for unsettled disputes.
    uint256 public lockedDisputeBonds;
    uint256 public maxActiveJobsPerAgent = 3;

    bytes32 public clubRootNode;
    bytes32 public alphaClubRootNode;
    bytes32 public agentRootNode;
    bytes32 public alphaAgentRootNode;
    bytes32 public validatorMerkleRoot;
    bytes32 public agentMerkleRoot;
    ENS public ens;
    NameWrapper public nameWrapper;
    address public ensJobPages;
    bool private useEnsJobTokenURI;
    /// @notice Freezes token/ENS/namewrapper/root nodes. Not a governance lock; ops remain owner-controlled.
    bool public lockIdentityConfig;

    struct Job {
        address employer;
        string jobSpecURI;
        string jobCompletionURI;
        uint256 payout;
        uint256 duration;
        address assignedAgent;
        uint256 assignedAt;
        bool completed;
        bool completionRequested;
        uint256 validatorApprovals;
        uint256 validatorDisapprovals;
        bool disputed;
        address disputeInitiator;
        uint256 disputeBondAmount;
        mapping(address => bool) approvals;
        mapping(address => bool) disapprovals;
        address[] validators;
        uint256 completionRequestedAt;
        uint256 disputedAt;
        bool expired;
        uint8 agentPayoutPct;
        uint8 validatorRewardPctSnapshot;
        bool escrowReleased;
        bool validatorApproved;
        uint256 validatorApprovedAt;
        uint256 validatorBondAmount;
        uint256 agentBondAmount;
    }

    struct AGIType {
        address nftAddress;
        uint256 payoutPercentage;
    }

    uint256 public nextJobId;
    uint256 public nextTokenId;
    mapping(uint256 => Job) internal jobs;
    mapping(address => uint256) public reputation;
    mapping(address => bool) public moderators;
    mapping(address => bool) public additionalValidators;
    mapping(address => bool) public additionalAgents;
    mapping(address => bool) public blacklistedAgents;
    mapping(address => bool) public blacklistedValidators;
    mapping(address => uint256) internal activeJobsByAgent;
    AGIType[] public agiTypes;
    mapping(uint256 => string) private _tokenURIs;

    event JobCreated(
        uint256 indexed jobId,
        string jobSpecURI,
        uint256 indexed payout,
        uint256 indexed duration,
        string details
    );
    event JobApplied(uint256 indexed jobId, address indexed agent);
    event JobCompletionRequested(uint256 indexed jobId, address indexed agent, string jobCompletionURI);
    event JobValidated(uint256 indexed jobId, address indexed validator);
    event JobDisapproved(uint256 indexed jobId, address indexed validator);
    event JobCompleted(uint256 indexed jobId, address indexed agent, uint256 indexed reputationPoints);
    event ReputationUpdated(address user, uint256 newReputation);
    event JobCancelled(uint256 indexed jobId);
    event DisputeResolvedWithCode(
        uint256 indexed jobId,
        address indexed resolver,
        uint8 indexed resolutionCode,
        string reason
    );
    event JobDisputed(uint256 indexed jobId, address indexed disputant);
    event JobExpired(uint256 indexed jobId, address indexed employer, address agent, uint256 indexed payout);
    event EnsRegistryUpdated(address newEnsRegistry);
    event NameWrapperUpdated(address newNameWrapper);
    event RootNodesUpdated(
        bytes32 indexed clubRootNode,
        bytes32 indexed agentRootNode,
        bytes32 indexed alphaClubRootNode,
        bytes32 alphaAgentRootNode
    );
    event MerkleRootsUpdated(bytes32 validatorMerkleRoot, bytes32 agentMerkleRoot);
    event AGITypeUpdated(address indexed nftAddress, uint256 indexed payoutPercentage);
    event MaxActiveJobsPerAgentUpdated(uint256 oldValue, uint256 newValue);
    event NFTIssued(uint256 indexed tokenId, address indexed employer, string tokenURI);
    event CompletionReviewPeriodUpdated(uint256 indexed oldPeriod, uint256 indexed newPeriod);
    event DisputeReviewPeriodUpdated(uint256 indexed oldPeriod, uint256 indexed newPeriod);
    event AGIWithdrawn(address indexed to, uint256 indexed amount, uint256 remainingWithdrawable);
    event PlatformRevenueAccrued(uint256 indexed jobId, uint256 indexed amount);
    event IdentityConfigurationLocked(address indexed locker, uint256 indexed atTimestamp);
    event AgentBlacklisted(address indexed agent, bool indexed status);
    event ValidatorBlacklisted(address indexed validator, bool indexed status);
    event ValidatorBondParamsUpdated(uint256 indexed bps, uint256 indexed min, uint256 indexed max);
    event ChallengePeriodAfterApprovalUpdated(uint256 indexed oldPeriod, uint256 indexed newPeriod);
    event SettlementPauseSet(address indexed setter, bool indexed paused);
    event AGITokenAddressUpdated(address indexed oldToken, address indexed newToken);
    event EnsJobPagesUpdated(address indexed oldEnsJobPages, address indexed newEnsJobPages);
    event VoteQuorumUpdated(uint256 indexed oldQuorum, uint256 indexed newQuorum);
    event RequiredValidatorApprovalsUpdated(uint256 indexed oldApprovals, uint256 indexed newApprovals);
    event RequiredValidatorDisapprovalsUpdated(uint256 indexed oldDisapprovals, uint256 indexed newDisapprovals);
    event ValidationRewardPercentageUpdated(uint256 indexed oldPercentage, uint256 indexed newPercentage);
    event AgentBondParamsUpdated(
        uint256 indexed oldBps,
        uint256 indexed oldMin,
        uint256 indexed oldMax,
        uint256 newBps,
        uint256 newMin,
        uint256 newMax
    );
    event AgentBondMinUpdated(uint256 indexed oldMin, uint256 indexed newMin);
    event ValidatorSlashBpsUpdated(uint256 indexed oldBps, uint256 indexed newBps);
    event EnsHookAttempted(uint8 indexed hook, uint256 indexed jobId, address indexed target, bool success);

    uint8 private constant ENS_HOOK_CREATE = 1;
    uint8 private constant ENS_HOOK_ASSIGN = 2;
    uint8 private constant ENS_HOOK_COMPLETION = 3;
    uint8 private constant ENS_HOOK_REVOKE = 4;
    uint8 private constant ENS_HOOK_LOCK = 5;
    uint8 private constant ENS_HOOK_LOCK_BURN = 6;
    uint256 internal constant ENS_HOOK_GAS_LIMIT = 500_000;
    uint256 internal constant ENS_URI_GAS_LIMIT = 200_000;
    uint256 internal constant ENS_URI_MAX_RETURN_BYTES = 2048;
    uint256 internal constant ENS_URI_MAX_STRING_BYTES = 1024;
    uint256 internal constant NFT_BALANCE_OF_GAS_LIMIT = 100_000;
    uint256 internal constant ERC165_GAS_LIMIT = 50_000;
    uint256 internal constant SAFE_MINT_GAS_LIMIT = 250_000;
    uint256 internal constant MAX_JOB_SPEC_URI_BYTES = 2048;
    uint256 internal constant MAX_JOB_COMPLETION_URI_BYTES = 1024;
    uint256 internal constant MAX_BASE_IPFS_URL_BYTES = 512;
    uint256 internal constant MAX_JOB_DETAILS_BYTES = 2048;

    constructor(
        address agiTokenAddress,
        string memory baseIpfs,
        address[2] memory ensConfig,
        bytes32[4] memory rootNodes,
        bytes32[2] memory merkleRoots
    ) ERC721("AGIJobs", "Job") {
        if (agiTokenAddress.code.length == 0) revert InvalidParameters();
        if (bytes(baseIpfs).length > MAX_BASE_IPFS_URL_BYTES) revert InvalidParameters();
        if ((rootNodes[0] | rootNodes[1] | rootNodes[2] | rootNodes[3]) != bytes32(0)) {
            if (ensConfig[0] == address(0) || ensConfig[0].code.length == 0) revert InvalidParameters();
        }
        if (ensConfig[1] != address(0) && ensConfig[1].code.length == 0) revert InvalidParameters();
        _initAddressConfig(agiTokenAddress, baseIpfs, ensConfig[0], ensConfig[1]);
        _initRoots(rootNodes, merkleRoots);

        _validateValidatorThresholds(requiredValidatorApprovals, requiredValidatorDisapprovals);
    }

    modifier onlyModerator() {
        if (!moderators[msg.sender]) revert NotModerator();
        _;
    }

    modifier whenIdentityConfigurable() {
        if (lockIdentityConfig) revert ConfigLocked();
        _;
    }

    modifier whenSettlementNotPaused() {
        if (settlementPaused) revert SettlementPaused();
        _;
    }

    function _initAddressConfig(
        address agiTokenAddress,
        string memory baseIpfs,
        address ensAddress,
        address nameWrapperAddress
    ) internal {
        agiToken = IERC20(agiTokenAddress);
        baseIpfsUrl = baseIpfs;
        ens = ENS(ensAddress);
        nameWrapper = NameWrapper(nameWrapperAddress);
    }

    function _initRoots(bytes32[4] memory rootNodes, bytes32[2] memory merkleRoots) internal {
        clubRootNode = rootNodes[0];
        agentRootNode = rootNodes[1];
        alphaClubRootNode = rootNodes[2];
        alphaAgentRootNode = rootNodes[3];
        validatorMerkleRoot = merkleRoots[0];
        agentMerkleRoot = merkleRoots[1];
    }

    // -----------------------
    // Internal helpers
    // -----------------------
    function _job(uint256 jobId) internal view returns (Job storage job) {
        job = jobs[jobId];
        if (job.employer == address(0)) revert JobNotFound();
    }

    function _t(address to, uint256 amount) internal {
        if (amount == 0) return;
        TransferUtils.safeTransfer(address(agiToken), to, amount);
    }

    function _tf(address from, uint256 amount) internal {
        if (amount == 0) return;
        TransferUtils.safeTransferFromExact(address(agiToken), from, address(this), amount);
    }


    function _releaseEscrow(Job storage job) internal {
        if (job.escrowReleased) return;
        job.escrowReleased = true;
        unchecked {
            lockedEscrow -= job.payout;
        }
    }

    function _settleAgentBond(Job storage job, bool agentWon, bool toPool) internal returns (uint256 poolAmount) {
        uint256 bond = job.agentBondAmount;
        job.agentBondAmount = 0;
        unchecked {
            lockedAgentBonds -= bond;
        }
        if (agentWon) {
            _t(job.assignedAgent, bond);
            return 0;
        }
        if (toPool) {
            return bond;
        }
        _t(job.employer, bond);
        return 0;
    }

    function _settleDisputeBond(Job storage job, bool agentWon) internal {
        uint256 bond = job.disputeBondAmount;
        job.disputeBondAmount = 0;
        if (bond != 0) {
            job.disputeInitiator = address(0);
        }
        unchecked {
            lockedDisputeBonds -= bond;
        }
        _t(agentWon ? job.assignedAgent : job.employer, bond);
    }

    function _decrementActiveJob(Job storage job) internal {
        unchecked {
            activeJobsByAgent[job.assignedAgent]--;
        }
    }

    function _cancelJobAndRefund(uint256 jobId, Job storage job) internal {
        _releaseEscrow(job);
        _t(job.employer, job.payout);
        emit JobCancelled(jobId);
        _callEnsJobPagesHook(ENS_HOOK_REVOKE, jobId);
        delete jobs[jobId];
    }

    function _requireEmptyEscrow() internal view {
        if ((lockedEscrow | lockedAgentBonds | lockedValidatorBonds | lockedDisputeBonds) != 0) revert InvalidState();
    }

    function _requireValidReviewPeriod(uint256 period) internal pure {
        if (!(period > 0 && period <= MAX_REVIEW_PERIOD)) revert InvalidParameters();
    }

    function _requireJobUnsettled(Job storage job) internal view {
        if (job.completed || job.expired || job.disputed) revert InvalidState();
    }

    function _requireAssignedAgent(Job storage job) internal view {
        if (job.assignedAgent == address(0)) revert InvalidState();
    }

    function _requireActiveDispute(Job storage job) internal view {
        if (!job.disputed || job.expired) revert InvalidState();
    }

    function _clearDispute(Job storage job) internal {
        job.disputed = false;
        job.disputedAt = 0;
    }

    function _setAddressFlag(mapping(address => bool) storage registry, address account, bool status) internal {
        registry[account] = status;
    }

    function _validateValidatorThresholds(uint256 approvals, uint256 disapprovals) internal pure {
        if (
            approvals > MAX_VALIDATORS_PER_JOB ||
            disapprovals > MAX_VALIDATORS_PER_JOB ||
            approvals + disapprovals > MAX_VALIDATORS_PER_JOB
        ) {
            revert InvalidValidatorThresholds();
        }
    }

    function _enforceValidatorCapacity(uint256 currentCount) internal pure {
        if (currentCount >= MAX_VALIDATORS_PER_JOB) revert ValidatorLimitReached();
    }

    function _maxAGITypePayoutPercentage() internal view returns (uint256) {
        uint256 maxPercentage = 0;
        for (uint256 i = 0; i < agiTypes.length; ) {
            uint256 pct = agiTypes[i].payoutPercentage;
            if (pct > maxPercentage) {
                maxPercentage = pct;
            }
            unchecked {
                ++i;
            }
        }
        return maxPercentage;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    function pauseIntake() external onlyOwner { _pause(); }
    function unpauseIntake() external onlyOwner { _unpause(); }
    function pauseAll() external onlyOwner {
        if (!paused()) {
            _pause();
        }
        settlementPaused = true;
        emit SettlementPauseSet(msg.sender, true);
    }
    function unpauseAll() external onlyOwner {
        if (paused()) {
            _unpause();
        }
        settlementPaused = false;
        emit SettlementPauseSet(msg.sender, false);
    }
    function setSettlementPaused(bool paused) external onlyOwner {
        settlementPaused = paused;
        emit SettlementPauseSet(msg.sender, paused);
    }
    function lockIdentityConfiguration() external onlyOwner whenIdentityConfigurable {
        lockIdentityConfig = true;
        emit IdentityConfigurationLocked(msg.sender, block.timestamp);
    }

    function createJob(string memory _jobSpecURI, uint256 _payout, uint256 _duration, string memory _details)
        external
        whenNotPaused
        whenSettlementNotPaused
        nonReentrant
    {
        if (!(_payout > 0 && _duration > 0 && _payout <= maxJobPayout && _duration <= jobDurationLimit)) revert InvalidParameters();
        if (bytes(_jobSpecURI).length > MAX_JOB_SPEC_URI_BYTES) revert InvalidParameters();
        if (bytes(_details).length > MAX_JOB_DETAILS_BYTES) revert InvalidParameters();
        UriUtils.requireValidUri(_jobSpecURI);
        uint256 jobId = nextJobId;
        unchecked {
            ++nextJobId;
        }
        Job storage job = jobs[jobId];
        job.employer = msg.sender;
        job.jobSpecURI = _jobSpecURI;
        job.payout = _payout;
        job.duration = _duration;
        TransferUtils.safeTransferFromExact(address(agiToken), msg.sender, address(this), _payout);
        unchecked {
            lockedEscrow += _payout;
        }
        emit JobCreated(jobId, _jobSpecURI, _payout, _duration, _details);
        _callEnsJobPagesHook(ENS_HOOK_CREATE, jobId);
    }

    function applyForJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)
        external
        whenNotPaused
        whenSettlementNotPaused
        nonReentrant
    {
        Job storage job = _job(_jobId);
        if (job.assignedAgent != address(0)) revert InvalidState();
        if (blacklistedAgents[msg.sender]) revert Blacklisted();
        if (!_isAuthorized(msg.sender, subdomain, proof, additionalAgents, agentMerkleRoot, agentRootNode, alphaAgentRootNode)) {
            revert NotAuthorized();
        }
        if (activeJobsByAgent[msg.sender] >= maxActiveJobsPerAgent) revert InvalidState();
        uint256 snapshotPct = getHighestPayoutPercentage(msg.sender);
        if (snapshotPct == 0) revert IneligibleAgentPayout();
        job.agentPayoutPct = uint8(snapshotPct);
        job.validatorRewardPctSnapshot = uint8(validationRewardPercentage);
        if (job.agentPayoutPct + job.validatorRewardPctSnapshot > 100) revert InvalidParameters();
        uint256 bond = BondMath.computeAgentBond(
            job.payout,
            job.duration,
            agentBondBps,
            agentBond,
            agentBondMax,
            jobDurationLimit
        );
        if (bond > 0) {
            _tf(msg.sender, bond);
            unchecked {
                lockedAgentBonds += bond;
            }
        }
        job.agentBondAmount = bond;
        job.assignedAgent = msg.sender;
        job.assignedAt = block.timestamp;
        unchecked {
            activeJobsByAgent[msg.sender]++;
        }
        emit JobApplied(_jobId, msg.sender);
        _callEnsJobPagesHook(ENS_HOOK_ASSIGN, _jobId);
    }

    function requestJobCompletion(uint256 _jobId, string calldata _jobCompletionURI)
        external
        whenSettlementNotPaused
        nonReentrant
    {
        Job storage job = _job(_jobId);
        uint256 uriLength = bytes(_jobCompletionURI).length;
        if (!(uriLength > 0 && uriLength <= MAX_JOB_COMPLETION_URI_BYTES)) revert InvalidParameters();
        if (msg.sender != job.assignedAgent) revert NotAuthorized();
        if (job.completed || job.expired) revert InvalidState();
        if (!job.disputed && block.timestamp > job.assignedAt + job.duration) revert InvalidState();
        if (job.completionRequested) revert InvalidState();
        UriUtils.requireValidUri(_jobCompletionURI);
        job.jobCompletionURI = _jobCompletionURI;
        job.completionRequested = true;
        job.completionRequestedAt = block.timestamp;
        emit JobCompletionRequested(_jobId, msg.sender, _jobCompletionURI);
        _callEnsJobPagesHook(ENS_HOOK_COMPLETION, _jobId);
    }

    function validateJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)
        external
        whenSettlementNotPaused
        nonReentrant
    {
        _recordValidatorVote(_jobId, subdomain, proof, true);
    }

    function disapproveJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)
        external
        whenSettlementNotPaused
        nonReentrant
    {
        _recordValidatorVote(_jobId, subdomain, proof, false);
    }

    function _recordValidatorVote(
        uint256 _jobId,
        string memory subdomain,
        bytes32[] calldata proof,
        bool approve
    ) internal {
        Job storage job = _job(_jobId);
        _requireJobUnsettled(job);
        _requireAssignedAgent(job);
        if (blacklistedValidators[msg.sender]) revert Blacklisted();
        if (!_isAuthorized(msg.sender, subdomain, proof, additionalValidators, validatorMerkleRoot, clubRootNode, alphaClubRootNode)) {
            revert NotAuthorized();
        }
        if (!job.completionRequested) revert InvalidState();
        if (block.timestamp > job.completionRequestedAt + completionReviewPeriod) revert InvalidState();
        if (job.approvals[msg.sender] || job.disapprovals[msg.sender]) revert InvalidState();

        uint256 bond = job.validatorBondAmount;
        if (bond == 0) {
            bond = BondMath.computeValidatorBond(job.payout, validatorBondBps, validatorBondMin, validatorBondMax);
            unchecked {
                job.validatorBondAmount = bond + 1;
            }
        } else {
            unchecked {
                bond -= 1;
            }
        }
        if (bond > 0) {
            _tf(msg.sender, bond);
            unchecked {
                lockedValidatorBonds += bond;
            }
        }
        _enforceValidatorCapacity(job.validators.length);
        if (approve) {
            unchecked {
                job.validatorApprovals++;
            }
            job.approvals[msg.sender] = true;
        } else {
            unchecked {
                job.validatorDisapprovals++;
            }
            job.disapprovals[msg.sender] = true;
        }
        job.validators.push(msg.sender);
        if (approve) {
            emit JobValidated(_jobId, msg.sender);
            if (
                !job.validatorApproved &&
                requiredValidatorApprovals > 0 &&
                job.validatorApprovals >= requiredValidatorApprovals
            ) {
                job.validatorApproved = true;
                job.validatorApprovedAt = block.timestamp;
            }
            return;
        }
        emit JobDisapproved(_jobId, msg.sender);
        if (requiredValidatorDisapprovals > 0 && job.validatorDisapprovals >= requiredValidatorDisapprovals) {
            job.disputed = true;
            job.disputedAt = block.timestamp;
            emit JobDisputed(_jobId, msg.sender);
        }
    }

    function _isAuthorized(
        address claimant,
        string memory subdomain,
        bytes32[] calldata proof,
        mapping(address => bool) storage additional,
        bytes32 merkleRoot,
        bytes32 rootNode,
        bytes32 alphaRootNode
    )
        internal
        view
        returns (bool)
    {
        if (additional[claimant]) {
            return true;
        } else if (ENSOwnership.verifyMerkleOwnership(claimant, proof, merkleRoot)) {
            return true;
        }
        return ENSOwnership.verifyENSOwnership(
            address(ens),
            address(nameWrapper),
            claimant,
            subdomain,
            rootNode,
            alphaRootNode
        );
    }

    function disputeJob(uint256 _jobId) external whenSettlementNotPaused nonReentrant {
        Job storage job = _job(_jobId);
        _requireJobUnsettled(job);
        if (msg.sender != job.assignedAgent && msg.sender != job.employer) revert NotAuthorized();
        if (!job.completionRequested) revert InvalidState();
        if (block.timestamp > job.completionRequestedAt + completionReviewPeriod) revert InvalidState();
        uint256 bond;
        unchecked {
            bond = (job.payout * DISPUTE_BOND_BPS) / 10_000;
        }
        if (bond < DISPUTE_BOND_MIN) bond = DISPUTE_BOND_MIN;
        if (bond > DISPUTE_BOND_MAX) bond = DISPUTE_BOND_MAX;
        if (bond > job.payout) bond = job.payout;
        if (bond > 0) {
            _tf(msg.sender, bond);
            unchecked {
                lockedDisputeBonds += bond;
            }
            job.disputeInitiator = msg.sender;
        }
        job.disputeBondAmount = bond;
        job.disputed = true;
        job.disputedAt = block.timestamp;
        emit JobDisputed(_jobId, msg.sender);
    }

    /// @notice Resolve a dispute with a typed action code and freeform reason.
    function resolveDisputeWithCode(
        uint256 _jobId,
        uint8 resolutionCode,
        string calldata reason
    ) external onlyModerator whenSettlementNotPaused nonReentrant {
        _resolveDispute(_jobId, resolutionCode, reason);
    }

    function _resolveDispute(uint256 _jobId, uint8 resolutionCode, string memory reason) internal {
        Job storage job = _job(_jobId);
        _requireActiveDispute(job);

        if (resolutionCode == 0) {
            emit DisputeResolvedWithCode(_jobId, msg.sender, resolutionCode, reason);
            return;
        }

        _clearDispute(job);

        if (resolutionCode == 1) {
            _completeJob(_jobId, true);
        } else if (resolutionCode == 2) {
            _refundEmployer(_jobId, job);
        } else {
            revert InvalidParameters();
        }
        emit DisputeResolvedWithCode(_jobId, msg.sender, resolutionCode, reason);
    }

    function resolveStaleDispute(uint256 _jobId, bool employerWins) external onlyOwner whenSettlementNotPaused nonReentrant {
        Job storage job = _job(_jobId);
        _requireActiveDispute(job);
        if (block.timestamp <= job.disputedAt + disputeReviewPeriod) revert InvalidState();

        _clearDispute(job);
        if (employerWins) {
            _refundEmployer(_jobId, job);
        } else {
            _completeJob(_jobId, true);
        }
    }

    function blacklistAgent(address _agent, bool _status) external onlyOwner {
        blacklistedAgents[_agent] = _status;
        emit AgentBlacklisted(_agent, _status);
    }
    function blacklistValidator(address _validator, bool _status) external onlyOwner {
        blacklistedValidators[_validator] = _status;
        emit ValidatorBlacklisted(_validator, _status);
    }

    function delistJob(uint256 _jobId) external onlyOwner whenSettlementNotPaused nonReentrant {
        Job storage job = _job(_jobId);
        if (job.completed || job.assignedAgent != address(0)) revert InvalidState();
        _cancelJobAndRefund(_jobId, job);
    }

    function addModerator(address _moderator) external onlyOwner {
        _setAddressFlag(moderators, _moderator, true);
    }
    function removeModerator(address _moderator) external onlyOwner {
        _setAddressFlag(moderators, _moderator, false);
    }
    function updateAGITokenAddress(address _newTokenAddress) external onlyOwner whenIdentityConfigurable {
        if (_newTokenAddress.code.length == 0) revert InvalidParameters();
        _requireEmptyEscrow();
        address oldToken = address(agiToken);
        agiToken = IERC20(_newTokenAddress);
        emit AGITokenAddressUpdated(oldToken, _newTokenAddress);
    }
    function updateEnsRegistry(address _newEnsRegistry) external onlyOwner whenIdentityConfigurable {
        if (_newEnsRegistry.code.length == 0) revert InvalidParameters();
        _requireEmptyEscrow();
        ens = ENS(_newEnsRegistry);
        emit EnsRegistryUpdated(_newEnsRegistry);
    }
    function updateNameWrapper(address _newNameWrapper) external onlyOwner whenIdentityConfigurable {
        if (_newNameWrapper != address(0) && _newNameWrapper.code.length == 0) revert InvalidParameters();
        _requireEmptyEscrow();
        nameWrapper = NameWrapper(_newNameWrapper);
        emit NameWrapperUpdated(_newNameWrapper);
    }
    function setEnsJobPages(address _ensJobPages) external onlyOwner whenIdentityConfigurable {
        if (_ensJobPages != address(0) && _ensJobPages.code.length == 0) revert InvalidParameters();
        address oldEnsJobPages = ensJobPages;
        ensJobPages = _ensJobPages;
        emit EnsJobPagesUpdated(oldEnsJobPages, _ensJobPages);
    }
    function setUseEnsJobTokenURI(bool enabled) external onlyOwner {
        useEnsJobTokenURI = enabled;
    }
    function updateRootNodes(
        bytes32 _clubRootNode,
        bytes32 _agentRootNode,
        bytes32 _alphaClubRootNode,
        bytes32 _alphaAgentRootNode
    ) external onlyOwner whenIdentityConfigurable {
        _requireEmptyEscrow();
        clubRootNode = _clubRootNode;
        agentRootNode = _agentRootNode;
        alphaClubRootNode = _alphaClubRootNode;
        alphaAgentRootNode = _alphaAgentRootNode;
        emit RootNodesUpdated(_clubRootNode, _agentRootNode, _alphaClubRootNode, _alphaAgentRootNode);
    }
    function updateMerkleRoots(bytes32 _validatorMerkleRoot, bytes32 _agentMerkleRoot)
        external
        onlyOwner
    {
        validatorMerkleRoot = _validatorMerkleRoot;
        agentMerkleRoot = _agentMerkleRoot;
        emit MerkleRootsUpdated(_validatorMerkleRoot, _agentMerkleRoot);
    }
    function setBaseIpfsUrl(string calldata _url) external onlyOwner {
        if (bytes(_url).length > MAX_BASE_IPFS_URL_BYTES) revert InvalidParameters();
        baseIpfsUrl = _url;
    }
    function setRequiredValidatorApprovals(uint256 _approvals) external onlyOwner {
        _requireEmptyEscrow();
        _validateValidatorThresholds(_approvals, requiredValidatorDisapprovals);
        uint256 oldApprovals = requiredValidatorApprovals;
        requiredValidatorApprovals = _approvals;
        emit RequiredValidatorApprovalsUpdated(oldApprovals, _approvals);
    }
    function setRequiredValidatorDisapprovals(uint256 _disapprovals) external onlyOwner {
        _requireEmptyEscrow();
        _validateValidatorThresholds(requiredValidatorApprovals, _disapprovals);
        uint256 oldDisapprovals = requiredValidatorDisapprovals;
        requiredValidatorDisapprovals = _disapprovals;
        emit RequiredValidatorDisapprovalsUpdated(oldDisapprovals, _disapprovals);
    }
    function setPremiumReputationThreshold(uint256 _threshold) external onlyOwner {
        premiumReputationThreshold = _threshold;
    }
    function setVoteQuorum(uint256 _quorum) external onlyOwner {
        _requireEmptyEscrow();
        if (_quorum == 0 || _quorum > MAX_VALIDATORS_PER_JOB) revert InvalidParameters();
        uint256 oldQuorum = voteQuorum;
        voteQuorum = _quorum;
        emit VoteQuorumUpdated(oldQuorum, _quorum);
    }
    function setMaxJobPayout(uint256 _maxPayout) external onlyOwner {
        maxJobPayout = _maxPayout;
    }
    function setJobDurationLimit(uint256 _limit) external onlyOwner {
        if (_limit == 0) revert InvalidParameters();
        jobDurationLimit = _limit;
    }
    function setMaxActiveJobsPerAgent(uint256 value) external onlyOwner {
        unchecked {
            if (value - 1 >= 10_000) revert InvalidParameters();
        }
        uint256 oldValue = maxActiveJobsPerAgent;
        maxActiveJobsPerAgent = value;
        emit MaxActiveJobsPerAgentUpdated(oldValue, value);
    }
    function setCompletionReviewPeriod(uint256 _period) external onlyOwner {
        _requireEmptyEscrow();
        _requireValidReviewPeriod(_period);
        uint256 oldPeriod = completionReviewPeriod;
        completionReviewPeriod = _period;
        emit CompletionReviewPeriodUpdated(oldPeriod, _period);
    }
    function setDisputeReviewPeriod(uint256 _period) external onlyOwner {
        _requireEmptyEscrow();
        _requireValidReviewPeriod(_period);
        uint256 oldPeriod = disputeReviewPeriod;
        disputeReviewPeriod = _period;
        emit DisputeReviewPeriodUpdated(oldPeriod, _period);
    }
    function setValidatorBondParams(uint256 bps, uint256 min, uint256 max) external onlyOwner {
        if (bps > 10_000) revert InvalidParameters();
        if (min > max) revert InvalidParameters();
        if (bps == 0 && min == 0) {
            if (max != 0) revert InvalidParameters();
        } else if (max == 0 || (bps > 0 && min == 0)) {
            revert InvalidParameters();
        }
        validatorBondBps = bps;
        validatorBondMin = min;
        validatorBondMax = max;
        emit ValidatorBondParamsUpdated(bps, min, max);
    }
    function setAgentBondParams(uint256 bps, uint256 min, uint256 max) external onlyOwner {
        if (bps > 10_000) revert InvalidParameters();
        if (min > max) revert InvalidParameters();
        uint256 oldBps = agentBondBps;
        uint256 oldMin = agentBond;
        uint256 oldMax = agentBondMax;
        if (bps == 0 && min == 0 && max == 0) {
            agentBondBps = 0;
            agentBond = 0;
            agentBondMax = 0;
            emit AgentBondParamsUpdated(oldBps, oldMin, oldMax, 0, 0, 0);
            return;
        }
        if (max == 0) revert InvalidParameters();
        agentBondBps = bps;
        agentBond = min;
        agentBondMax = max;
        emit AgentBondParamsUpdated(oldBps, oldMin, oldMax, bps, min, max);
    }
    function setAgentBond(uint256 bond) external onlyOwner {
        if ((agentBondMax == 0 && bond != 0) || bond > agentBondMax) revert InvalidParameters();
        uint256 oldMin = agentBond;
        agentBond = bond;
        emit AgentBondMinUpdated(oldMin, bond);
    }
    function setValidatorSlashBps(uint256 bps) external onlyOwner {
        _requireEmptyEscrow();
        if (bps > 10_000) revert InvalidParameters();
        uint256 oldBps = validatorSlashBps;
        validatorSlashBps = bps;
        emit ValidatorSlashBpsUpdated(oldBps, bps);
    }
    function setChallengePeriodAfterApproval(uint256 period) external onlyOwner {
        _requireEmptyEscrow();
        _requireValidReviewPeriod(period);
        uint256 oldPeriod = challengePeriodAfterApproval;
        challengePeriodAfterApproval = period;
        emit ChallengePeriodAfterApprovalUpdated(oldPeriod, period);
    }
    function getJobCore(uint256 jobId)
        external
        view
        returns (
            address employer,
            address assignedAgent,
            uint256 payout,
            uint256 duration,
            uint256 assignedAt,
            bool completed,
            bool disputed,
            bool expired,
            uint8 agentPayoutPct
        )
    {
        Job storage job = _job(jobId);
        return (
            job.employer,
            job.assignedAgent,
            job.payout,
            job.duration,
            job.assignedAt,
            job.completed,
            job.disputed,
            job.expired,
            job.agentPayoutPct
        );
    }

    function getJobValidation(uint256 jobId)
        external
        view
        returns (
            bool completionRequested,
            uint256 validatorApprovals,
            uint256 validatorDisapprovals,
            uint256 completionRequestedAt,
            uint256 disputedAt
        )
    {
        Job storage job = _job(jobId);
        return (
            job.completionRequested,
            job.validatorApprovals,
            job.validatorDisapprovals,
            job.completionRequestedAt,
            job.disputedAt
        );
    }

    function getJobSpecURI(uint256 jobId) external view returns (string memory) {
        Job storage job = _job(jobId);
        return job.jobSpecURI;
    }

    function getJobCompletionURI(uint256 jobId) external view returns (string memory) {
        Job storage job = _job(jobId);
        return job.jobCompletionURI;
    }

    function setValidationRewardPercentage(uint256 _percentage) external onlyOwner {
        if (!(_percentage > 0 && _percentage <= 100)) revert InvalidParameters();
        uint256 maxPct = _maxAGITypePayoutPercentage();
        if (maxPct > 100 - _percentage) revert InvalidParameters();
        uint256 oldPercentage = validationRewardPercentage;
        validationRewardPercentage = _percentage;
        emit ValidationRewardPercentageUpdated(oldPercentage, _percentage);
    }

    function enforceReputationGrowth(address _user, uint256 _points) internal {
        uint256 current = reputation[_user];
        uint256 updated;
        unchecked {
            updated = current + _points;
        }
        if (updated < current || updated > 88888) {
            updated = 88888;
        }
        reputation[_user] = updated;
        emit ReputationUpdated(_user, updated);
    }

    function cancelJob(uint256 _jobId) external whenSettlementNotPaused nonReentrant {
        Job storage job = _job(_jobId);
        if (msg.sender != job.employer) revert NotAuthorized();
        if (job.completed || job.assignedAgent != address(0)) revert InvalidState();
        _cancelJobAndRefund(_jobId, job);
    }

    function expireJob(uint256 _jobId) external whenSettlementNotPaused nonReentrant {
        Job storage job = _job(_jobId);
        _requireJobUnsettled(job);
        if (job.completionRequested) revert InvalidState();
        _requireAssignedAgent(job);
        if (block.timestamp <= job.assignedAt + job.duration) revert InvalidState();

        job.expired = true;
        _decrementActiveJob(job);
        _releaseEscrow(job);
        _settleAgentBond(job, false, false);
        _t(job.employer, job.payout);
        emit JobExpired(_jobId, job.employer, job.assignedAgent, job.payout);
        _callEnsJobPagesHook(ENS_HOOK_REVOKE, _jobId);
    }

    /// @notice Anyone may lock ENS records after a job reaches a terminal state; only the owner may burn fuses.
    /// @dev Fuse burning is irreversible and remains owner-only; ENS hook execution is best-effort.
    function lockJobENS(uint256 jobId, bool burnFuses) external {
        Job storage job = jobs[jobId];
        if (!(job.completed || job.expired)) return;
        if (burnFuses && msg.sender != owner()) revert NotAuthorized();
        _callEnsJobPagesHook(burnFuses ? ENS_HOOK_LOCK_BURN : ENS_HOOK_LOCK, jobId);
    }

    function finalizeJob(uint256 _jobId) external whenSettlementNotPaused nonReentrant {
        Job storage job = _job(_jobId);
        uint256 approvals = job.validatorApprovals;
        uint256 disapprovals = job.validatorDisapprovals;
        _requireJobUnsettled(job);
        if (!job.completionRequested) revert InvalidState();
        if (job.validatorApproved) {
            if (block.timestamp <= job.validatorApprovedAt + challengePeriodAfterApproval) revert InvalidState();
            if (approvals > disapprovals) {
                _completeJob(_jobId, true);
                return;
            }
        }

        if (block.timestamp <= job.completionRequestedAt + completionReviewPeriod) revert InvalidState();

        uint256 totalVotes;
        unchecked {
            totalVotes = approvals + disapprovals;
        }
        if (totalVotes == 0) {
            // No-vote liveness: after the review window, settle deterministically in favor of the agent.
            _completeJob(_jobId, false);
        } else if (totalVotes < voteQuorum || approvals == disapprovals) {
            // Under-quorum or tie at/over quorum: force dispute to avoid low-participation outcomes.
            job.disputed = true;
            job.disputedAt = block.timestamp;
            emit JobDisputed(_jobId, msg.sender);
            return;
        } else if (approvals > disapprovals) {
            _completeJob(_jobId, true);
        } else {
            _refundEmployer(_jobId, job);
        }

    }

    /// @dev On agent-win, any remainder after agent/validator allocations is intentional platform revenue.
    /// @dev It stays in-contract and becomes withdrawable via withdrawAGI() when paused,
    /// @dev as long as lockedEscrow/locked*Bonds are fully covered.
    function _completeJob(uint256 _jobId, bool repEligible) internal {
        Job storage job = _job(_jobId);
        _requireJobUnsettled(job);
        _requireAssignedAgent(job);

        uint256 agentPayoutPercentage = job.agentPayoutPct;
        uint256 validatorBudget;
        uint256 agentPayout;
        validatorBudget = (job.payout * job.validatorRewardPctSnapshot) / 100;
        agentPayout = (job.payout * agentPayoutPercentage) / 100;
        uint256 retained;
        unchecked {
            retained = job.payout - agentPayout - validatorBudget;
        }
        if (retained > 0) {
            emit PlatformRevenueAccrued(_jobId, retained);
        }

        job.completed = true;
        _decrementActiveJob(job);
        _releaseEscrow(job);
        _settleAgentBond(job, true, false);

        uint256 reputationPoints = ReputationMath.computeReputationPoints(
            job.payout,
            job.duration,
            job.completionRequestedAt,
            job.assignedAt,
            repEligible
        );
        enforceReputationGrowth(job.assignedAgent, reputationPoints);

        _t(job.assignedAgent, agentPayout);

        if (job.validators.length == 0) {
            // No validators participated: rebate the validator budget to the employer.
            _t(job.employer, validatorBudget);
        } else {
            _settleValidators(job, true, reputationPoints, validatorBudget, 0);
        }
        _mintCompletionNFT(_jobId, job);
        _settleDisputeBond(job, true);

        emit JobCompleted(_jobId, job.assignedAgent, reputationPoints);
        _callEnsJobPagesHook(ENS_HOOK_REVOKE, _jobId);
    }

    function _settleValidators(
        Job storage job,
        bool agentWins,
        uint256 reputationPoints,
        uint256 escrowValidatorReward,
        uint256 extraPoolForCorrect
    ) internal {
        uint256 vCount = job.validators.length;
        if (vCount == 0) {
            return;
        }
        uint256 bond = job.validatorBondAmount;
        unchecked {
            bond -= 1;
            lockedValidatorBonds -= bond * vCount;
        }
        job.validatorBondAmount = 0;
        uint256 correctCount = agentWins ? job.validatorApprovals : job.validatorDisapprovals;
        uint256 slashedPerIncorrect;
        uint256 poolForCorrect;
        uint256 perCorrectReward;
        uint256 validatorReputationGain;
        unchecked {
            slashedPerIncorrect = (bond * validatorSlashBps) / 10_000;
            poolForCorrect = escrowValidatorReward + extraPoolForCorrect + (slashedPerIncorrect * (vCount - correctCount));
            if (correctCount > 0) {
                perCorrectReward = poolForCorrect / correctCount;
            }
            validatorReputationGain = (reputationPoints * job.validatorRewardPctSnapshot) / 100;
        }
        for (uint256 i = 0; i < vCount; ) {
            address validator = job.validators[i];
            bool correct = agentWins ? job.approvals[validator] : job.disapprovals[validator];
            uint256 payout = correct ? bond + perCorrectReward : bond - slashedPerIncorrect;
            _t(validator, payout);
            if (correct && validatorReputationGain > 0) {
                enforceReputationGrowth(validator, validatorReputationGain);
            }
            unchecked {
                ++i;
            }
        }
        unchecked {
            poolForCorrect -= perCorrectReward * correctCount;
        }
        _t(agentWins ? job.assignedAgent : job.employer, poolForCorrect);
    }

    function _mintCompletionNFT(uint256 jobId, Job storage job) internal {
        uint256 tokenId = nextTokenId;
        unchecked {
            ++nextTokenId;
        }
        string memory tokenUriValue = job.jobCompletionURI;
        if (useEnsJobTokenURI) {
            address target = ensJobPages;
            if (target.code.length != 0) {
                bytes memory data;
                assembly {
                    let ptr := mload(0x40)
                    mstore(ptr, shl(224, 0x751809b4))
                    mstore(add(ptr, 4), jobId)

                    if staticcall(ENS_URI_GAS_LIMIT, target, ptr, 0x24, 0, 0) {
                        let rdsize := returndatasize()
                        if gt(rdsize, ENS_URI_MAX_RETURN_BYTES) {
                            rdsize := ENS_URI_MAX_RETURN_BYTES
                        }

                        data := mload(0x40)
                        mstore(data, rdsize)
                        returndatacopy(add(data, 32), 0, rdsize)
                        mstore(0x40, add(add(data, 32), and(add(rdsize, 31), not(31))))
                    }
                }
                if (data.length >= 64) {
                    uint256 offset;
                    uint256 strLen;
                    assembly {
                        offset := mload(add(data, 32))
                        strLen := mload(add(data, 64))
                    }
                    if (offset == 32 && strLen > 0 && strLen <= ENS_URI_MAX_STRING_BYTES) {
                        uint256 paddedLen;
                        unchecked {
                            paddedLen = (strLen + 31) & ~uint256(31);
                        }
                        if (64 + paddedLen <= data.length) {
                            string memory ensUri;
                            assembly {
                                ensUri := add(data, 64)
                            }
                            tokenUriValue = ensUri;
                        }
                    }
                }
            }
        }
        tokenUriValue = UriUtils.applyBaseIpfs(tokenUriValue, baseIpfsUrl);
        _tokenURIs[tokenId] = tokenUriValue;
        if (job.employer.code.length != 0) {
            try this.safeMintCompletionNFT{ gas: SAFE_MINT_GAS_LIMIT }(job.employer, tokenId) {
            } catch {
                _mint(job.employer, tokenId);
            }
        } else {
            _mint(job.employer, tokenId);
        }
        emit NFTIssued(tokenId, job.employer, tokenUriValue);
    }

    function safeMintCompletionNFT(address to, uint256 tokenId) external {
        if (msg.sender != address(this)) revert NotAuthorized();
        _safeMint(to, tokenId);
    }

    function _refundEmployer(uint256 jobId, Job storage job) internal {
        job.completed = true;
        job.disputed = false;
        _decrementActiveJob(job);
        _releaseEscrow(job);
        bool poolToValidators = (requiredValidatorDisapprovals != 0
            && job.validatorDisapprovals >= requiredValidatorDisapprovals);
        uint256 agentBondPool = _settleAgentBond(job, false, poolToValidators);
        uint256 validatorCount = job.validators.length;
        uint256 escrowValidatorReward = validatorCount > 0
            ? (job.payout * job.validatorRewardPctSnapshot) / 100
            : 0;
        uint256 employerRefund = escrowValidatorReward > 0 ? job.payout - escrowValidatorReward : job.payout;
        uint256 reputationPoints = ReputationMath.computeReputationPoints(
            job.payout,
            job.duration,
            job.completionRequestedAt,
            job.assignedAt,
            true
        );
        _settleValidators(job, false, reputationPoints, escrowValidatorReward, agentBondPool);
        _t(job.employer, employerRefund);
        _settleDisputeBond(job, false);
        _callEnsJobPagesHook(ENS_HOOK_REVOKE, jobId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireMinted(tokenId);
        return _tokenURIs[tokenId];
    }

    function _callEnsJobPagesHook(uint8 hook, uint256 jobId) internal {
        address target = ensJobPages;
        if (target.code.length == 0) {
            return;
        }
        uint256 success;
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, shl(224, 0x1f76f7a2))
            mstore(add(ptr, 4), hook)
            mstore(add(ptr, 36), jobId)
            success := call(ENS_HOOK_GAS_LIMIT, target, 0, ptr, 0x44, 0, 0)
        }
        emit EnsHookAttempted(hook, jobId, target, success != 0);
    }

    function addAdditionalValidator(address validator) external onlyOwner {
        _setAddressFlag(additionalValidators, validator, true);
    }
    function removeAdditionalValidator(address validator) external onlyOwner {
        _setAddressFlag(additionalValidators, validator, false);
    }
    function addAdditionalAgent(address agent) external onlyOwner {
        _setAddressFlag(additionalAgents, agent, true);
    }
    function removeAdditionalAgent(address agent) external onlyOwner {
        _setAddressFlag(additionalAgents, agent, false);
    }

    /// @notice Includes retained payout remainders; withdrawable only via withdrawAGI() when paused.
    /// @dev Owner withdrawals are limited to balances not backing lockedEscrow/locked*Bonds.
    function withdrawableAGI() public view returns (uint256) {
        uint256 bal = agiToken.balanceOf(address(this));
        uint256 lockedTotal = lockedEscrow + lockedValidatorBonds + lockedAgentBonds + lockedDisputeBonds;
        if (bal < lockedTotal) revert InsolventEscrowBalance();
        return bal - lockedTotal;
    }

    function _withdrawAGITo(address to, uint256 amount) internal {
        if (amount == 0) revert InvalidParameters();
        uint256 available = withdrawableAGI();
        if (amount > available) revert InsufficientWithdrawableBalance();
        _t(to, amount);
        emit AGIWithdrawn(to, amount, available - amount);
    }

    function withdrawAGI(uint256 amount) external onlyOwner whenSettlementNotPaused whenPaused nonReentrant {
        _withdrawAGITo(msg.sender, amount);
    }

    function rescueETH(uint256 amount) external onlyOwner nonReentrant {
        (bool ok, ) = owner().call{ value: amount }("");
        if (!ok) revert TransferFailed();
    }

    function rescueERC20(address token, address to, uint256 amount) external onlyOwner nonReentrant {
        if (token == address(0) || to == address(0) || amount == 0) revert InvalidParameters();
        if (token == address(agiToken)) {
            if (settlementPaused) revert SettlementPaused();
            if (!paused()) revert InvalidState();
            _withdrawAGITo(to, amount);
        } else {
            TransferUtils.safeTransfer(token, to, amount);
        }
    }

    function rescueToken(address token, bytes calldata data) external onlyOwner nonReentrant {
        if (token == address(agiToken)) revert InvalidParameters();
        if (token.code.length == 0) revert InvalidParameters();
        (bool ok, bytes memory ret) = token.call(data);
        if (!ok) revert TransferFailed();
        if (ret.length > 0) {
            if (ret.length != 32) revert TransferFailed();
            uint256 returned;
            assembly {
                returned := mload(add(ret, 32))
            }
            if (returned != 1) revert TransferFailed();
        }
    }

    function addAGIType(address nftAddress, uint256 payoutPercentage) external onlyOwner {
        if (!(nftAddress != address(0) && payoutPercentage > 0 && payoutPercentage <= 100)) revert InvalidParameters();
        if (!_supportsERC721(nftAddress)) {
            revert InvalidParameters();
        }

        bool exists;
        uint256 maxPct = payoutPercentage;
        uint256 length = agiTypes.length;
        for (uint256 i = 0; i < length; ) {
            AGIType storage agiType = agiTypes[i];
            uint256 pct = agiType.payoutPercentage;
            if (agiType.nftAddress == nftAddress) {
                pct = payoutPercentage;
                exists = true;
            }
            if (pct > maxPct) {
                maxPct = pct;
            }
            unchecked {
                ++i;
            }
        }
        if ((!exists && length >= MAX_AGI_TYPES) || maxPct > 100 - validationRewardPercentage) {
            revert InvalidParameters();
        }
        if (exists) {
            _updateAgiTypePayout(nftAddress, payoutPercentage);
        } else {
            agiTypes.push(AGIType({ nftAddress: nftAddress, payoutPercentage: payoutPercentage }));
        }
        emit AGITypeUpdated(nftAddress, payoutPercentage);
    }

    function disableAGIType(address nftAddress) external onlyOwner {
        if (!_updateAgiTypePayout(nftAddress, 0)) revert InvalidParameters();
        emit AGITypeUpdated(nftAddress, 0);
    }

    function _updateAgiTypePayout(address nftAddress, uint256 payoutPercentage) internal returns (bool) {
        for (uint256 i = 0; i < agiTypes.length; ) {
            AGIType storage agiType = agiTypes[i];
            if (agiType.nftAddress == nftAddress) {
                agiType.payoutPercentage = payoutPercentage;
                return true;
            }
            unchecked {
                ++i;
            }
        }
        return false;
    }

    function _supportsERC721(address nftAddress) internal view returns (bool isSupported) {
        assembly {
            if gt(extcodesize(nftAddress), 0) {
                let ptr := mload(0x40)
                mstore(ptr, 0x01ffc9a700000000000000000000000000000000000000000000000000000000)
                mstore(add(ptr, 0x04), shl(224, 0x01ffc9a7))
                isSupported := staticcall(ERC165_GAS_LIMIT, nftAddress, ptr, 0x24, ptr, 0x20)
                isSupported := and(isSupported, gt(returndatasize(), 0x1f))
                isSupported := and(isSupported, iszero(iszero(mload(ptr))))
                if isSupported {
                    mstore(ptr, 0x01ffc9a700000000000000000000000000000000000000000000000000000000)
                    mstore(add(ptr, 0x04), shl(224, 0x80ac58cd))
                    isSupported := staticcall(ERC165_GAS_LIMIT, nftAddress, ptr, 0x24, ptr, 0x20)
                    isSupported := and(isSupported, gt(returndatasize(), 0x1f))
                    isSupported := and(isSupported, iszero(iszero(mload(ptr))))
                }
            }
        }
    }


    function getHighestPayoutPercentage(address agent) public view returns (uint256) {
        uint256 highestPercentage = 0;
        for (uint256 i = 0; i < agiTypes.length; ) {
            AGIType storage agiType = agiTypes[i];
            uint256 payoutPercentage = agiType.payoutPercentage;
            if (payoutPercentage > highestPercentage) {
                uint256 tokenBalance;
                address nftAddress = agiType.nftAddress;
                assembly {
                    let ptr := mload(0x40)
                    mstore(ptr, 0x70a0823100000000000000000000000000000000000000000000000000000000)
                    mstore(add(ptr, 0x04), agent)
                    let success := staticcall(NFT_BALANCE_OF_GAS_LIMIT, nftAddress, ptr, 0x24, ptr, 0x20)
                    if and(success, gt(returndatasize(), 0x1f)) {
                        tokenBalance := mload(ptr)
                    }
                }
                if (tokenBalance > 0) {
                    highestPercentage = payoutPercentage;
                }
            }
            unchecked {
                ++i;
            }
        }
        return highestPercentage;
    }
}
