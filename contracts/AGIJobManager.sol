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
- "$USDC": The ERC-20 token used by the Protocol for job payouts, validator rewards, agent/validator/dispute bonds, and settlement-wallet allocations.
- "Employer": Any person or entity that posts a Job and escrows a payout in $USDC.
- "Agent": Any person or entity that applies for, performs, and requests completion of a Job.
- "Validator": Any person or entity that votes to approve or disapprove a Job completion request under the Protocol rules, posting any required validator bond.
- "Moderator": An address designated by the Protocol owner with permission to resolve disputes through the Protocol's dispute-resolution functions.
- "Owner": The address holding administrative permissions in the Protocol (e.g., pausing, parameter updates, allowlist/blacklist management, moderator management, delisting unassigned jobs, and withdrawing certain withdrawable balances as permitted by the code).
- "Job": A work request defined by an on-chain job id plus off-chain/on-chain references (e.g., jobSpecURI, details, and later jobCompletionURI).
- "Job Spec URI": A URI describing the Job requested by the Employer.
- "Job Completion URI": A URI submitted by the Agent describing or containing the completion deliverable(s).
- "Escrow": The $USDC amount deposited by the Employer as the Job payout and held by the Protocol until settlement according to code.
- "Bonds": Any $USDC amounts posted as Agent bonds, Validator bonds, or Dispute bonds per the Protocol.
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
- All tax obligations relating to posting the Job, escrowing $USDC, receiving any refunds, or any other token transfers.
- Any off-chain contracting, NDAs, IP assignments/licenses, confidentiality terms, acceptance criteria, warranties, or service levels for the Job.

4.2 Agent Responsibilities (Exclusive)
The Agent is solely and exclusively responsible for:

- Performing the Job in accordance with any off-chain agreement with the Employer.
- Ensuring all deliverables and the Job Completion URI content are lawful and do not violate third-party rights.
- All tax obligations relating to receiving $USDC payments, posting or forfeiting Agent bonds, or receiving any additional settlement amounts.
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

- To post a Job, the Employer escrows the full payout amount in $USDC into the Protocol.
- The Employer provides a Job Spec URI and optional details.
- Jobs may have maximum payout and duration limits set by the Protocol.

5.2 Applying / Assignment (Agent)

- A Job may be assigned to the first eligible Agent who successfully applies under the Protocol rules.
- Eligibility may depend on authorization mechanisms (e.g., allowlists, Merkle proofs, or ENS-based authorization).
- The Protocol may require an Agent bond (computed by code) to be posted at application/assignment time.
- NFT holdings may establish eligibility but do not set payout percentages. The validator rate is snapshotted when a job is posted; the agent receives the remaining job cost after validator rewards and the fixed 30% and 10% wallet shares.

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
  - The Agent wins (validator rewards, 30% and 10% wallet shares, then remaining payout to Agent), or
  - The Employer wins (refund to Employer, validator settlement, possible agent bond forfeiture), or
  - A dispute is forced due to insufficient participation or ties.

- Ordinary finalization waits for the full review and any longer approval challenge. No votes, insufficient quorum, or tied votes open a dispute without automatic Agent payment.
- The Employer may explicitly accept submitted, undisputed work and authorize immediate payment. Employer-win settlement preserves the full job escrow; reviewer rewards use forfeited collateral.
- An unanswered dispute permits neutral return of escrow and each participant's own bonds after twice the dispute review period. Settlement pauses extend lifecycle clocks.
- Failed outgoing USDC transfers are reserved for the original beneficiary and may be retried; a recorded completion does not guarantee immediate receipt by every recipient.

5.6 Expiration

- If conditions in the code are met (e.g., time elapsed without completion request), a Job may be expired, which can trigger refund mechanics and bond settlement.

5.7 Cancellation / Delisting

- An Employer may be able to cancel an unassigned Job (per code).
- The Owner may delist/cancel unassigned Jobs (per code).
- Users acknowledge there is no obligation to keep a Job listed or available.

6. Disputes; Moderation; No Duty to Resolve

1) Dispute initiation. A dispute may be initiated by an Employer or Agent (and/or may be triggered by validator disapproval thresholds) as permitted by the code. Disputes may require a Dispute bond in $USDC.
2) Moderator resolution. Where enabled, Moderators may resolve disputes using the Protocol's dispute code mechanism (e.g., settle in favor of Agent or Employer).
3) No obligation; no SLA. The Protocol, Owner, and Moderators have no obligation to resolve disputes within any timeframe (or at all), except as the code permits. Any reliance on moderator action is at user risk.
4) Off-chain disputes remain off-chain. The Protocol cannot adjudicate legal questions (fraud, IP infringement, breach of contract, misrepresentation, employment classification, etc.). Those issues are solely between users and must be handled off-chain.

7. Protocol Economics; USDC Distribution

1) Validator reward budget. The Protocol may allocate a portion of the Job payout as a validator reward budget (as snapshotted per job) for distribution to participating Validators, subject to code rules.
2) Bond returns and slashing. Validator bonds may be returned in full, partially slashed, or redistributed depending on whether a Validator ends up on the correct side of the final outcome, as defined by the code.
3) Successful-job distribution. Validators receive their reward pool first; 30% and 10% of the original job cost are then sent to two distinct settlement wallets. The owner may rotate these wallets only while intake is paused and all job escrow and bonds have been settled. The agent receives all remaining USDC, including unallocated validator rewards and rounding. The default validator budget is 8%; owner changes (1–60%) affect only newly posted jobs. No successful-job cost remains as protocol treasury. Cancelled/expired jobs and employer-win refunds do not pay the two wallet shares. Bond returns and slashing are separate from job-cost percentages.
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
- Token volatility, illiquidity, and loss of value of $USDC.
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

USDC settlement notice (v0.8.0)

The protocol uses native Circle USDC as its sole settlement currency, with six decimals.
AGIJobManager does not issue USDC or define the issuer's terms. The protocol's job
refund and settlement rules apply to job escrow; they do not describe token purchases
or redemption rights. USDC issuer controls, including transfer pauses and blocked
addresses, may prevent a transfer and therefore revert a settlement operation.
Canonical token addresses: https://developers.circle.com/stablecoins/usdc-contract-addresses
Historical project-token sale disclosures do not describe v0.8.0 settlement and are
preserved in previous Git tags.

*/

pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./utils/UriUtils.sol";
import "./utils/TransferUtils.sol";
import "./utils/BondMath.sol";
import "./utils/ReputationMath.sol";
import "./utils/ENSOwnership.sol";
import "./utils/NftEligibility.sol";
import "./utils/JobState.sol";
import "./utils/JobSettlement.sol";
import "./utils/JobValidation.sol";

// NOTE: keep utility libraries externally linked to avoid EIP-170 bytecode regressions.

interface ENS {
    function resolver(bytes32 node) external view returns (address);
}

interface NameWrapper {
    function ownerOf(uint256 id) external view returns (address);
}



contract AGIJobManager is Ownable2Step, ReentrancyGuard, Pausable, ERC721 {
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

    IERC20 public immutable usdcToken;
    address public wallet30;
    address public wallet10;
    string private baseIpfsUrl;
    // Conservative hard cap to bound settlement loops on mainnet.
    uint256 public constant MAX_VALIDATORS_PER_JOB = 50;
    uint256 public constant MAX_AGI_TYPES = NftEligibility.MAX_AGI_TYPES;
    uint256 public requiredValidatorApprovals = 3;
    uint256 public requiredValidatorDisapprovals = 3;
    uint256 public voteQuorum = 3;
    uint256 public premiumReputationThreshold = 10000;
    uint256 public validationRewardPercentage = 8;
    uint256 public maxJobPayout = 88888888e6;
    uint256 public jobDurationLimit = 10000000;
    uint256 public completionReviewPeriod = 7 days;
    uint256 public disputeReviewPeriod = 14 days;
    uint256 internal constant MAX_REVIEW_PERIOD = 365 days;
    bool public settlementPaused;
    uint256 private settlementPauseStarted;
    uint256 private completedSettlementPauseSeconds;
    uint256 internal constant DISPUTE_BOND_BPS = 50;
    uint256 internal constant DISPUTE_BOND_MIN = 1e6;
    uint256 internal constant DISPUTE_BOND_MAX = 200e6;
    /**
     * @notice Validator bond/slashing parameters and challenge window.
     * @dev Validators post a bond per vote; correct-side validators split rewards + slashed bonds.
     *      Incorrect-side validators receive only the un-slashed bond portion. After approval
     *      thresholds are met, a short challenge window prevents instant settlement. When validators
     *      participate and the employer wins, the refund is reduced by the validator reward pool.
     */
    uint256 public validatorBondBps = 1500;
    uint256 public validatorBondMin = 10e6;
    uint256 public validatorBondMax = 88888888e6;
    uint256 public validatorSlashBps = 8000;
    uint256 public challengePeriodAfterApproval = 1 days;
    /// @dev Validator incentives are final-outcome aligned; bonds + challenge windows mitigate bribery but do not eliminate it.
    /// @dev Minimum agent bond.
    uint256 public agentBond = 1e6;
    uint256 public agentBondBps = 500;
    uint256 public agentBondMax = 88888888e6;
    /// @notice Total USDC reserved for unsettled job escrows.
    /// @dev Tracks job payout escrows only.

    /// @notice Total USDC locked as agent performance bonds for unsettled jobs.

    /// @notice Total USDC locked as validator bonds for unsettled votes.

    /// @notice Total USDC locked as dispute bonds for unsettled disputes.

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
    /// @notice Freezes ENS/namewrapper/root nodes; USDC is immutable at deployment. Not a governance lock; ops remain owner-controlled.
    bool public lockIdentityConfig;
    /// @notice Default for newly posted jobs; existing jobs keep their recorded requirement.
    bool public agentNftRequired = true;


    uint256 public nextJobId;
    uint256 public nextTokenId;
    mapping(uint256 => Job) internal jobs;
    SettlementLedger internal ledger;
    mapping(address => bool) public moderators;
    mapping(address => bool) public additionalValidators;
    mapping(address => bool) public additionalAgents;
    mapping(address => bool) public blacklistedAgents;
    mapping(address => bool) public blacklistedValidators;

    NftEligibility.AGIType[] public agiTypes;
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
    event AgentNftRequirementUpdated(bool required);
    event NFTIssued(uint256 indexed tokenId, address indexed employer, string tokenURI);
    event CompletionReviewPeriodUpdated(uint256 indexed oldPeriod, uint256 indexed newPeriod);
    event MaxJobPayoutUpdated(uint256 indexed oldPayout, uint256 indexed newPayout);
    event JobDurationLimitUpdated(uint256 indexed oldLimit, uint256 indexed newLimit);
    event DisputeReviewPeriodUpdated(uint256 indexed oldPeriod, uint256 indexed newPeriod);
    event USDCWithdrawn(address indexed to, uint256 indexed amount, uint256 remainingWithdrawable);
    event JobPayoutDistributed(uint256 indexed jobId, uint256 validatorBudget, uint256 wallet30Amount, uint256 wallet10Amount, uint256 agentAmount);
    event SettlementWalletsUpdated(address indexed wallet30, address indexed wallet10);
    event IdentityConfigurationLocked(address indexed locker, uint256 indexed atTimestamp);
    event AgentBlacklisted(address indexed agent, bool indexed status);
    event ValidatorBlacklisted(address indexed validator, bool indexed status);
    event ValidatorBondParamsUpdated(uint256 indexed bps, uint256 indexed min, uint256 indexed max);
    event ChallengePeriodAfterApprovalUpdated(uint256 indexed oldPeriod, uint256 indexed newPeriod);
    event SettlementPauseSet(address indexed setter, bool indexed paused);
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
    event USDCDeferred(address indexed beneficiary, uint256 amount);
    event USDCClaimed(address indexed beneficiary, uint256 amount);
    event JobAccepted(uint256 indexed jobId, address indexed employer);
    event UnresolvedDisputeRefunded(uint256 indexed jobId);
    event JobApprovalThresholdReached(uint256 indexed jobId, uint256 approvedAt);
    event ValidatorCredentialUsed(uint256 indexed jobId, address indexed voter, bytes32 indexed credential, address controller);

    uint8 private constant ENS_HOOK_CREATE = 1;
    uint8 private constant ENS_HOOK_ASSIGN = 2;
    uint8 private constant ENS_HOOK_COMPLETION = 3;
    uint8 private constant ENS_HOOK_REVOKE = 4;
    uint8 private constant ENS_HOOK_LOCK = 5;
    uint8 private constant ENS_HOOK_LOCK_BURN = 6;
    uint256 internal constant ENS_HOOK_GAS_LIMIT = 500_000;
    uint256 internal constant SAFE_MINT_GAS_LIMIT = 250_000;
    uint256 internal constant MAX_JOB_SPEC_URI_BYTES = 2048;
    uint256 internal constant MAX_JOB_COMPLETION_URI_BYTES = 1024;
    uint256 internal constant MAX_BASE_IPFS_URL_BYTES = 512;
    uint256 internal constant MAX_JOB_DETAILS_BYTES = 2048;

    constructor(
        address usdcTokenAddress,
        string memory baseIpfs,
        address[2] memory ensConfig,
        bytes32[4] memory rootNodes,
        bytes32[2] memory merkleRoots,
        address[2] memory settlementWallets
    ) ERC721("AGIJobs", "Job") {
        if (usdcTokenAddress.code.length == 0) revert InvalidParameters();
        if (IERC20Metadata(usdcTokenAddress).decimals() != 6) revert InvalidParameters();
        if (block.chainid == 1) {
            if (usdcTokenAddress != 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48) revert InvalidParameters();
        } else if (block.chainid == 11155111) {
            if (usdcTokenAddress != 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238) revert InvalidParameters();
        } else if (block.chainid != 1337 && block.chainid != 31337) {
            revert InvalidParameters();
        }
        usdcToken = IERC20(usdcTokenAddress);
        _setSettlementWallets(settlementWallets[0], settlementWallets[1]);
        if (bytes(baseIpfs).length > MAX_BASE_IPFS_URL_BYTES) revert InvalidParameters();
        if ((rootNodes[0] | rootNodes[1] | rootNodes[2] | rootNodes[3]) != bytes32(0)) {
            if (ensConfig[0] == address(0) || ensConfig[0].code.length == 0) revert InvalidParameters();
        }
        if (ensConfig[1] != address(0) && ensConfig[1].code.length == 0) revert InvalidParameters();
        _initAddressConfig(baseIpfs, ensConfig[0], ensConfig[1]);
        _initRoots(rootNodes, merkleRoots);

        _validateValidatorThresholds(requiredValidatorApprovals, requiredValidatorDisapprovals);
        // Admission opens only after the owner has verified deployment and configuration.
        _pause();
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
        string memory baseIpfs,
        address ensAddress,
        address nameWrapperAddress
    ) internal {
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
        JobSettlement.pay(ledger, to, amount);
    }

    function _tf(address from, uint256 amount) internal {
        if (amount == 0) return;
        TransferUtils.safeTransferFromExact(address(usdcToken), from, address(this), amount);
    }


    function _releaseEscrow(Job storage job) internal {
        if (job.escrowReleased) return;
        job.escrowReleased = true;
        unchecked {
            ledger.escrow -= job.payout;
        }
    }

    function _settleAgentBond(Job storage job, bool agentWon, bool toPool) internal returns (uint256 poolAmount) {
        uint256 bond = job.agentBondAmount;
        job.agentBondAmount = 0;
        unchecked {
            ledger.agentBonds -= bond;
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

    function _decrementActiveJob(Job storage job) internal {
        unchecked {
            ledger.activeJobs[job.assignedAgent]--;
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
        if ((ledger.escrow | ledger.agentBonds | ledger.validatorBonds | ledger.disputeBonds) != 0) revert InvalidState();
    }

    /// @notice Rotate recipients only between jobs, with intake paused and all reserves settled.
    function setSettlementWallets(address recipient30, address recipient10) external onlyOwner whenPaused nonReentrant {
        _requireEmptyEscrow();
        _setSettlementWallets(recipient30, recipient10);
    }

    function _setSettlementWallets(address recipient30, address recipient10) internal {
        if (recipient30 == recipient10) revert InvalidParameters();
        _requireSettlementWallet(recipient30);
        _requireSettlementWallet(recipient10);
        wallet30 = recipient30;
        wallet10 = recipient10;
        emit SettlementWalletsUpdated(recipient30, recipient10);
    }

    function _requireSettlementWallet(address recipient) internal view {
        if (recipient == address(0) || recipient == address(this) || recipient == address(usdcToken)) {
            revert InvalidParameters();
        }
    }

    /// @notice Preserve an accountable owner for pause recovery and configuration maintenance.
    function renounceOwnership() public pure override {
        revert InvalidState();
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

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    function pauseIntake() external onlyOwner { _pause(); }
    function unpauseIntake() external onlyOwner { _unpause(); }
    function pauseAll() external onlyOwner {
        if (!paused()) {
            _pause();
        }
        _setSettlementPaused(true);
    }
    function unpauseAll() external onlyOwner {
        if (paused()) {
            _unpause();
        }
        _setSettlementPaused(false);
    }
    function setSettlementPaused(bool paused) external onlyOwner {
        _setSettlementPaused(paused);
    }

    function _setSettlementPaused(bool value) internal {
        if (value != settlementPaused) {
            if (value) settlementPauseStarted = block.timestamp;
            else {
                completedSettlementPauseSeconds += block.timestamp - settlementPauseStarted;
                settlementPauseStarted = 0;
            }
            settlementPaused = value;
        }
        emit SettlementPauseSet(msg.sender, value);
    }

    /// @notice Total past and current settlement-pause time; all lifecycle clocks exclude it.
    function settlementPausedSeconds() public view returns (uint256) {
        return completedSettlementPauseSeconds + (settlementPaused ? block.timestamp - settlementPauseStarted : 0);
    }

    function _deadline(uint256 started, uint256 period, uint256 pauseSnapshot) internal view returns (uint256) {
        return started + period + settlementPausedSeconds() - pauseSnapshot;
    }

    function _settlementDeadline(Job storage job) internal view returns (uint256 deadline) {
        deadline = _deadline(job.completionRequestedAt, completionReviewPeriod, job.completionPause);
        if (job.validatorApproved) {
            uint256 challengeEnd = _deadline(job.validatorApprovedAt, challengePeriodAfterApproval, job.approvalPause);
            if (challengeEnd > deadline) deadline = challengeEnd;
        }
    }

    /// @notice Current wall-clock deadlines; while paused they move forward as the clocks stop.
    function getJobDeadlines(uint256 jobId) external view returns (
        uint256 assignmentDeadline, uint256 reviewEnd, uint256 settlementAfter,
        uint256 ownerResolutionAfter, uint256 neutralRefundAfter
    ) {
        Job storage job = _job(jobId);
        if (job.assignedAgent != address(0)) assignmentDeadline = _deadline(job.assignedAt, job.duration, job.assignmentPause);
        if (job.completionRequested) {
            reviewEnd = _deadline(job.completionRequestedAt, completionReviewPeriod, job.completionPause);
            settlementAfter = _settlementDeadline(job);
        }
        if (job.disputed) {
            ownerResolutionAfter = _deadline(job.disputedAt, disputeReviewPeriod, job.disputePause);
            neutralRefundAfter = _deadline(job.disputedAt, 2 * disputeReviewPeriod, job.disputePause);
        }
    }

    function _openDispute(uint256 jobId, Job storage job) internal {
        job.disputed = true;
        job.disputedAt = block.timestamp;
        job.disputePause = settlementPausedSeconds();
        emit JobDisputed(jobId, msg.sender);
    }

    function _requireIndependentResolver(Job storage job) internal view {
        if (msg.sender == job.employer || msg.sender == job.assignedAgent || job.approvals[msg.sender]
            || job.disapprovals[msg.sender] || job.usedValidatorControllers[msg.sender]) revert NotAuthorized();
    }

    /// @notice Explicit owner/Merkle exceptions issue an address credential; ENS uses node and controller.
    function validatorCredential(address claimant, string memory label, bytes32[] calldata proof)
        public view returns (bytes32 credential, address controller)
    {
        if (additionalValidators[claimant] || ENSOwnership.verifyMerkleOwnership(claimant, proof, validatorMerkleRoot)) {
            return (keccak256(abi.encode("AGI.validator.address", claimant)), claimant);
        }
        return ENSOwnership.validatorCredential(address(ens), address(nameWrapper), claimant, label, clubRootNode, alphaClubRootNode);
    }

    function lockedEscrow() external view returns (uint256) { return ledger.escrow; }
    function lockedAgentBonds() external view returns (uint256) { return ledger.agentBonds; }
    function lockedValidatorBonds() external view returns (uint256) { return ledger.validatorBonds; }
    function lockedDisputeBonds() external view returns (uint256) { return ledger.disputeBonds; }
    function lockedClaims() external view returns (uint256) { return ledger.claims; }
    function pendingUSDC(address beneficiary) external view returns (uint256) { return ledger.pending[beneficiary]; }
    function reputation(address account) external view returns (uint256) { return ledger.reputation[account]; }

    /// @notice Anyone may retry a reserved payment, only to its original beneficiary.
    function claimUSDC(address beneficiary) external whenSettlementNotPaused nonReentrant {
        JobSettlement.claim(ledger, address(usdcToken), beneficiary);
    }

    /// @dev Isolated payout subcall. External callers and direct library calls cannot use it.
    function executeUSDCTransfer(address beneficiary, uint256 amount) external {
        if (msg.sender != address(this) || !_reentrancyGuardEntered()) revert NotAuthorized();
        TransferUtils.safeTransfer(address(usdcToken), beneficiary, amount);
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
        // The only setter enforces 1..60; this posting-time snapshot cannot truncate.
        // forge-lint: disable-next-line(unsafe-typecast)
        job.validatorRewardPctSnapshot = uint8(validationRewardPercentage);
        job.agentPayoutPct = 60 - job.validatorRewardPctSnapshot;
        job.agentNftRequired = agentNftRequired;
        TransferUtils.safeTransferFromExact(address(usdcToken), msg.sender, address(this), _payout);
        unchecked {
            ledger.escrow += _payout;
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
        if (ledger.activeJobs[msg.sender] >= maxActiveJobsPerAgent) revert InvalidState();
        // NFT types remain eligibility credentials; their legacy scores do not set payment shares.
        if (job.agentNftRequired && getHighestPayoutPercentage(msg.sender) == 0) revert IneligibleAgentPayout();
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
                ledger.agentBonds += bond;
            }
        }
        job.agentBondAmount = bond;
        job.assignedAgent = msg.sender;
        job.assignedAt = block.timestamp;
        job.assignmentPause = settlementPausedSeconds();
        unchecked {
            ledger.activeJobs[msg.sender]++;
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
        // Assignment deadlines intentionally use chain time, with inclusive submission at the boundary.
        // forge-lint: disable-next-line(block-timestamp)
        if (!job.disputed && block.timestamp > _deadline(job.assignedAt, job.duration, job.assignmentPause)) revert InvalidState();
        if (job.completionRequested) revert InvalidState();
        UriUtils.requireValidUri(_jobCompletionURI);
        job.jobCompletionURI = _jobCompletionURI;
        job.completionRequested = true;
        job.completionRequestedAt = block.timestamp;
        job.completionPause = settlementPausedSeconds();
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
        (bytes32 credential, address controller) = validatorCredential(msg.sender, subdomain, proof);
        if (credential == bytes32(0)) revert NotAuthorized();
        JobValidation.record(
            _jobId, job, ledger, address(usdcToken), approve, credential, controller,
            [completionReviewPeriod, requiredValidatorApprovals, requiredValidatorDisapprovals,
                validatorBondBps, validatorBondMin, validatorBondMax, settlementPausedSeconds()]
        );
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
        // A party may dispute through the same chain-time review deadline used by validator voting.
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp > _settlementDeadline(job)) revert InvalidState();
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
                ledger.disputeBonds += bond;
            }
            job.disputeInitiator = msg.sender;
        }
        job.disputeBondAmount = bond;
        job.disputed = true;
        job.disputedAt = block.timestamp;
        job.disputePause = settlementPausedSeconds();
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
        _requireIndependentResolver(job);

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
        _requireIndependentResolver(job);
        // Owner stale-dispute authority starts strictly after the recorded chain-time review deadline.
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp <= _deadline(job.disputedAt, disputeReviewPeriod, job.disputePause)) revert InvalidState();

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
        uint256 oldPayout = maxJobPayout;
        maxJobPayout = _maxPayout;
        emit MaxJobPayoutUpdated(oldPayout, _maxPayout);
    }
    function setJobDurationLimit(uint256 _limit) external onlyOwner {
        if (_limit == 0 || _limit > 365 days) revert InvalidParameters();
        uint256 oldLimit = jobDurationLimit;
        jobDurationLimit = _limit;
        emit JobDurationLimitUpdated(oldLimit, _limit);
    }
    function setMaxActiveJobsPerAgent(uint256 value) external onlyOwner {
        unchecked {
            if (value - 1 >= 10_000) revert InvalidParameters();
        }
        maxActiveJobsPerAgent = value;
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
        agentBond = bond;
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
        if (!(_percentage > 0 && _percentage <= 60)) revert InvalidParameters();
        uint256 oldPercentage = validationRewardPercentage;
        validationRewardPercentage = _percentage;
        emit ValidationRewardPercentageUpdated(oldPercentage, _percentage);
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
        // Expiry starts strictly after the submission deadline; tests cover both boundary sides.
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp <= _deadline(job.assignedAt, job.duration, job.assignmentPause)) revert InvalidState();

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

    /// @notice Review time is guaranteed; no votes, low participation and ties escalate.
    function finalizeJob(uint256 jobId) external whenSettlementNotPaused nonReentrant {
        Job storage job = _job(jobId);
        _requireJobUnsettled(job);
        // Intentional elapsed-time deadline, adjusted for settlement pauses; not a randomness source.
        // forge-lint: disable-next-line(block-timestamp)
        if (!job.completionRequested || block.timestamp <= _settlementDeadline(job)) revert InvalidState();
        uint256 approvals = job.validatorApprovals;
        uint256 disapprovals = job.validatorDisapprovals;
        if (approvals + disapprovals < voteQuorum || approvals == disapprovals) {
            _openDispute(jobId, job);
        } else if (approvals > disapprovals) {
            _completeJob(jobId, true);
        } else {
            _refundEmployer(jobId, job);
        }
    }

    /// @notice The buyer may explicitly accept submitted, undisputed work at any time.
    function acceptJob(uint256 jobId) external whenSettlementNotPaused nonReentrant {
        Job storage job = _job(jobId);
        if (msg.sender != job.employer) revert NotAuthorized();
        _requireJobUnsettled(job);
        if (!job.completionRequested) revert InvalidState();
        emit JobAccepted(jobId, msg.sender);
        _completeJob(jobId, false);
    }

    /// @notice After both arbitration windows, anyone may return escrow and all bonds neutrally.
    function refundUnresolvedDispute(uint256 jobId) external whenSettlementNotPaused nonReentrant {
        Job storage job = _job(jobId);
        _requireActiveDispute(job);
        // Intentional elapsed-time deadline, adjusted for settlement pauses; not a randomness source.
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp <= _deadline(job.disputedAt, 2 * disputeReviewPeriod, job.disputePause)) revert InvalidState();
        JobSettlement.unresolved(job, ledger);
        emit UnresolvedDisputeRefunded(jobId);
        _callEnsJobPagesHook(ENS_HOOK_REVOKE, jobId);
    }

    function _completeJob(uint256 jobId, bool repEligible) internal {
        Job storage job = _job(jobId);
        _requireJobUnsettled(job);
        _requireAssignedAgent(job);
        uint256 points = JobSettlement.complete(jobId, job, ledger, wallet30, wallet10, repEligible, validatorSlashBps);
        _mintCompletionNFT(jobId, job);
        emit JobCompleted(jobId, job.assignedAgent, points);
        _callEnsJobPagesHook(ENS_HOOK_REVOKE, jobId);
    }

    function _mintCompletionNFT(uint256 jobId, Job storage job) internal {
        uint256 tokenId = nextTokenId;
        unchecked {
            ++nextTokenId;
        }
        string memory tokenUriValue = UriUtils.completionURI(
            useEnsJobTokenURI ? ensJobPages : address(0), jobId, job.jobCompletionURI, baseIpfsUrl
        );
        _tokenURIs[tokenId] = tokenUriValue;
        if (job.employer.code.length != 0) {
            try this.safeMintCompletionNFT{ gas: SAFE_MINT_GAS_LIMIT }(job.employer, tokenId) { /* Successful safe mint already did the work; only failure needs fallback. */ // solhint-disable-line no-empty-blocks
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
        JobSettlement.refund(job, ledger, validatorSlashBps);
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

    /// @notice Unreserved donations only; completed job costs are fully distributed.
    /// @dev Owner withdrawals are limited to balances not backing ledger.escrow/locked*Bonds.
    function withdrawableUSDC() public view returns (uint256) {
        uint256 bal = usdcToken.balanceOf(address(this));
        uint256 lockedTotal = ledger.escrow + ledger.validatorBonds + ledger.agentBonds + ledger.disputeBonds + ledger.claims;
        if (bal < lockedTotal) revert InsolventEscrowBalance();
        return bal - lockedTotal;
    }

    function _withdrawUSDCTo(address to, uint256 amount) internal {
        if (amount == 0) revert InvalidParameters();
        uint256 available = withdrawableUSDC();
        if (amount > available) revert InsufficientWithdrawableBalance();
        _t(to, amount);
        emit USDCWithdrawn(to, amount, available - amount);
    }

    function withdrawUSDC(uint256 amount) external onlyOwner whenSettlementNotPaused whenPaused nonReentrant {
        _withdrawUSDCTo(msg.sender, amount);
    }

    function rescueETH(uint256 amount) external onlyOwner nonReentrant {
        (bool ok, ) = owner().call{ value: amount }("");
        if (!ok) revert TransferFailed();
    }

    function rescueERC20(address token, address to, uint256 amount) external onlyOwner nonReentrant {
        if (token == address(0) || to == address(0) || amount == 0) revert InvalidParameters();
        if (token == address(usdcToken)) {
            if (settlementPaused) revert SettlementPaused();
            if (!paused()) revert InvalidState();
            _withdrawUSDCTo(to, amount);
        } else {
            TransferUtils.safeTransfer(token, to, amount);
        }
    }

    function rescueToken(address token, bytes calldata data) external onlyOwner nonReentrant {
        if (token == address(usdcToken) || token == address(this)) revert InvalidParameters();
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

    /// @notice Changes only the requirement recorded by future createJob calls.
    function setAgentNftRequired(bool required) external onlyOwner {
        agentNftRequired = required;
        emit AgentNftRequirementUpdated(required);
    }

    /// @notice The immutable posting-time NFT requirement. Reverts for missing/deleted jobs.
    function jobAgentNftRequired(uint256 jobId) external view returns (bool) {
        return _job(jobId).agentNftRequired;
    }

    /// @notice Registry changes require zero outstanding job escrow and bonds.
    function addAGIType(address nftAddress, uint256 payoutPercentage) external onlyOwner {
        _requireEmptyEscrow();
        NftEligibility.add(agiTypes, nftAddress, payoutPercentage);
    }

    function disableAGIType(address nftAddress) external onlyOwner {
        _requireEmptyEscrow();
        NftEligibility.disable(agiTypes, nftAddress);
    }

    /// @notice Legacy eligibility score; zero means no enabled credential. Not a payout rate.
    function getHighestPayoutPercentage(address agent) public view returns (uint256) {
        return NftEligibility.highestScore(agiTypes, agent);
    }
}
