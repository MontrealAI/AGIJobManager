// SPDX-License-Identifier: MIT

/*

[ A G I J O B M A N A G E R  -  P R O T O C O L  T E R M S  A N D  N O T I C E S ]

Notice version: v1.0.4. Publication date: 18 September 2026.
Software publisher/rightsholder: MONTREAL.AI and the other identified rightsholders.
Deployment operator: the actual person or entity identified for the selected instance;
not determined by a brand, ENS name, source comment or wallet address alone.
Legal center: https://github.com/MontrealAI/AGIJobManager/tree/v1.0.4/docs/LEGAL

1. Scope, license and acceptance

The MIT License governs the covered software and documentation, including commercial
use, its notice requirements and warranty/liability provisions. This notice adds no
restriction, fee, indemnity or other condition to MIT permissions.

These notices explain the software, risks and proposed allocation of responsibilities.
Contractual service provisions apply only where incorporated into a properly identified
operator's agreement and validly accepted under applicable law. Publication, access,
a wallet transaction or a source comment alone does not establish informed acceptance,
legal capacity or authority. A local UI acknowledgement is bypassable and is not an
on-chain agreement system. Operators must present their own identity, terms, fees,
privacy information and any required language/acceptance process before offering service.

2. Separate roles; actual conduct controls

The Protocol is software implementing jobs, USDC escrow, collateral, validation,
disputes and settlement. Software is not a substitute for identifying responsible
people and entities. Mere authorship, publication, attribution, an ENS reference or a
fork does not appoint MONTREAL.AI, contributors or rightsholders to operate a third
party's deployment, employ its participants, hold their keys, advise them, guarantee
work, insure funds, settle disputes or provide ongoing support.

If a publisher, owner, moderator, host, ENS controller or fee recipient actually
performs a service, retains control, receives compensation or makes an undertaking,
its duties follow those facts and applicable law. Open-source, automated, AI-only,
non-upgradeable, decentralized or overseas labels do not confer regulatory immunity.
No notice transfers every duty to participants or excuses a party's own conduct.

3. Owner, moderator and fee-recipient disclosure

The manager owner has real administrative powers: separate intake and settlement
pauses, eligibility settings and exceptions, moderator appointment, specified job
parameters, unassigned-job delisting and stale-dispute decisions allowed by the code.
An intake pause permits normal exits; a settlement pause can delay refunds, payment
claims and other exits and extends lifecycle clocks. Moderator decisions can affect
outcomes. Absence of a proxy does not remove these powers or trust assumptions.

Successful jobs allocate the recorded validator budget first, then 30% and 10% of
original job cost to configured recipients, with the remainder to the agent. The default
validator budget is 8%; a 100 USDC example is 8 / 30 / 10 / 52 before rounding or unused
reviewer amounts. The operator must disclose recipients, beneficiaries, relationships
and services paid for. The publisher is not necessarily either recipient. Receiving
fees can matter to the regulatory and tax analysis; they are not automatically royalties.

Wallet rotation requires paused intake and zero live job escrow and all bond reserves.
Existing reserved payment claims keep their beneficiaries. Withdrawals protect escrow,
bonds and claims. Ownership requires proposed-owner acceptance; renunciation is disabled.
ENS parent, helper and interface control can be held separately and must be disclosed.

4. Users and lawful activity

Employers define lawful work, funding, acceptance criteria and their off-chain agreements.
Agent operators are responsible for authorized performance, lawful deliverables and key
security. Validators assess evidence honestly and independently; moderators exercise
only actual authority, with disclosed conflicts and any applicable duties. Automated
agents act for their responsible operators. Each party must meet obligations applicable
to its own activities, including taxes, records, privacy, IP, sanctions, worker and
consumer rights and any required authorization. Obligations can attach to owners,
operators, publishers and recipients as well as participants.

ENS membership, NFTs, allowlists, Merkle proofs and blacklists do not establish identity,
independence or a complete KYC/AML, sanctions or compliance program. The code does not
supply deployment-specific legal clearance. Its availability is not an invitation to
use it where prohibited or to bypass legal requirements or access controls.

5. Jobs, refunds and settlement

Employers deposit native Circle USDC with six decimals. Eligible agents may be required
to post collateral. Fresh managers start with intake paused and NFT eligibility disabled;
owners can opt in for future jobs. Each job retains its posting-time NFT policy and
validator reward percentage. Eligibility NFTs do not change payout shares.

Completion, review, challenge, voting and dispute windows follow the deployed code.
Ordinary finalization waits for the full required review/challenge periods. No votes,
insufficient quorum or tied votes do not automatically pay the agent. Employers can
explicitly accept submitted undisputed work. A buyer-win outcome preserves full job
escrow for refund. Code-supported cancellation, expiration and neutral dispute timeout
remain available subject to their conditions, pauses and required transactions.

Failed outgoing USDC transfers are reserved for the original beneficiary and can be
retried under the code. A completion event is not proof every recipient was paid.
USDC issuer freezes, blocked addresses or infrastructure failures can delay receipt.
The protocol does not issue USDC or control its issuer, redemption, price or availability.
No notice removes a code-supported refund, reserved claim or mandatory legal remedy.
There is no promised discretionary rescue, reversal, insurance or guaranteed recovery.

6. Work agreements, intellectual property and classification

The actual parties must agree scope, quality, evidence access, deadlines, confidentiality,
IP ownership/licensing and any service levels. A completion NFT or ENS name alone does
not transfer IP, certify quality, give ownership of MONTREAL.AI or grant investment rights.
The software publication is not an investment offer or promise of yield. Actual job fees
and services must still be disclosed. Worker, agency, fiduciary, payment-service and
other legal relationships depend on facts and law, not solely on chosen labels or the
absence of a separate written agreement.

7. Public data and third parties

On-chain addresses, names, actions, details, URIs and events can be public, linkable and
persistent. Do not publish confidential or sensitive information in them. Use suitable
private access controls for protected work. Hashing or encryption alone does not remove
privacy duties; deleting local data or revoking an ENS record cannot erase public copies.
Wallet, RPC, host, CDN, explorer and metadata services can process information under their
own arrangements. Each actual data-processing operator must give an accurate notice and
meet applicable duties. The software does not promise zero personal data or anonymity.

8. Operational commitments and risk

There is no additional publisher promise in this release to monitor every job, keep a
service online, supply updates, screen users, fund losses, rescue assets or respond within
a particular period. Owners and moderators must accurately state services they undertake;
a discretion or technical permission does not cancel accepted duties or mandatory law.
Smart contracts, credentials, keys, networks and USDC can fail. Reviews can be mistaken,
collusive or absent, and neutral refund can leave work unpaid. Users pay gas, including
for failed transactions; deadlines need callers and do not execute themselves.
Tests, signatures, hashes, badges and audit references are not guarantees of safety,
legality, independence, delivery, profit or payment. Users should independently assess
suitability and potential loss rather than rely on promotional language.

9. Warranty and liability boundaries

The MIT warranty and liability provisions remain applicable to licensed software.
For separately agreed voluntary services, any additional disclaimer or limitation for
the operator, owner, moderators, publisher or contributors applies only if validly agreed
and enforceable. Subject to express commitments and mandatory rights, no additional
warranty of merchantability, fitness, accuracy, availability, security, quality or results
is given by these notices. To the extent validly agreed and permitted, such parties
exclude indirect or consequential losses from those voluntary services.

Nothing excludes liability that cannot lawfully be excluded, including fraud, intentional
misconduct, gross fault or protected injury where applicable law so provides. Escrow,
bonds, beneficiary claims and required refunds are not funds the operator may retain by
invoking a limitation. No unilateral cap or waiver is imposed on non-consenting persons.
Any service cap requires a locally reviewed agreement specifying its amount and scope.

10. Professional-user indemnity and representation

An independent operator may seek a proportionate, locally reviewed business-user
indemnity for third-party loss caused by that user's unlawful content, infringement,
intentional misuse or breach. It requires valid agreement, identified beneficiaries,
appropriate defense/settlement procedures and mandatory-law exceptions; it is not
imposed by this notice or by MIT. It must not cover the protected party's own misconduct
or non-indemnifiable amounts, or impose an unlawful consumer burden.

Mere contribution, role-address ownership or authorized signing does not by itself
create personal guarantees, agency or partnership. Actual commitments, authority,
conduct and mandatory personal liability remain effective. No one may falsely imply
MONTREAL.AI endorsement, representation or certification. Accurate licensed attribution
and otherwise lawful references remain permitted.

11. Mandatory law, disputes and language

Nothing binds regulators or non-consenting third parties, prevents lawful complaints,
cooperation or urgent relief, waives non-waivable rights, eliminates taxes/filings,
or excuses violation of applicable law. Code determines on-chain execution; it does
not override mandatory law or a valid agreement. Off-chain disputes and remedies may
involve any party responsible under the actual facts; no blanket immunity from suit
or jurisdiction is claimed. Each operator must select an appropriate dispute process
subject to mandatory consumer/worker protections and other applicable requirements.

These materials are English. Where local law requires another language or a prior
translation and express choice, the operator must provide a valid process; worldwide
availability is not a waiver. Seek qualified advice for the actual jurisdictions and
activities. This software release is not a legal opinion or professional engagement.

12. Versions and existing rights

This publication does not amend earlier agreements, retroactively obtain consent,
rewrite verified deployed source or change existing jobs. Operators must implement
prospective amendments through an effective notice/acceptance process and preserve
accrued rights. Invalid provisions do not expand a disclaimer beyond lawful limits.
The MIT License and separate valid agreements remain distinct; this source notice is
not a universal entire-agreement clause or additional restriction on software use.

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
     *      thresholds are met, a challenge window can extend the full review. On an employer win,
     *      reviewer rewards use forfeited collateral; the buyer receives the full escrow.
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
    /// @notice Starts disabled for new jobs; owner opt-in never changes an existing job's recorded requirement.
    bool public agentNftRequired = false;


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

    /// @notice Rotate recipients with intake paused and empty job escrow/bonds; pending claims keep their beneficiaries.
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

    /// @notice Outstanding job bonds, including a fixed zero validator bond after the first vote.
    function getJobBonds(uint256 jobId) external view returns (
        uint256 agentAmount, uint256 validatorAmount, bool validatorFixed, uint256 disputeAmount
    ) {
        Job storage job = _job(jobId);
        uint256 recorded = job.validatorBondAmount;
        return (job.agentBondAmount, recorded == 0 ? 0 : recorded - 1, recorded != 0, job.disputeBondAmount);
    }
}
