// SPDX-License-Identifier: MIT

/*

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
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./utils/UriUtils.sol";
import "./utils/TransferUtils.sol";
import "./utils/BondMath.sol";
import "./utils/ReputationMath.sol";
import "./utils/ENSOwnership.sol";

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

    /// @notice Canonical dispute resolution codes (numeric ordering is stable; do not reorder).
    /// @dev 0 = NO_ACTION (log only; dispute remains active)
    /// @dev 1 = AGENT_WIN (settle in favor of agent)
    /// @dev 2 = EMPLOYER_WIN (settle in favor of employer)
    enum DisputeResolutionCode {
        NO_ACTION,
        AGENT_WIN,
        EMPLOYER_WIN
    }

    // Pre-hashed resolution strings (smaller + cheaper than hashing literals each call)
    bytes32 private constant RES_AGENT_WIN = 0x6594a8dd3f558fd2dd11fa44c7925f5b9e19868e6d0b4b97d2132fe5e25b5071;
    bytes32 private constant RES_EMPLOYER_WIN = 0xee31e9f396a85b8517c6d07b02f904858ad9f3456521bedcff02cc14e75ca8ce;

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
    /// @notice Deprecated and unused payout knob.
    uint256 public additionalAgentPayoutPercentage = 50;
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
    uint256 internal constant maxActiveJobsPerAgent = 3;

    string public termsAndConditionsIpfsHash;
    string public contactEmail;
    string public additionalText1;
    string public additionalText2;
    string public additionalText3;

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

    event JobCreated(uint256 jobId, string jobSpecURI, uint256 payout, uint256 duration, string details);
    event JobApplied(uint256 jobId, address agent);
    event JobCompletionRequested(uint256 jobId, address agent, string jobCompletionURI);
    event JobValidated(uint256 jobId, address validator);
    event JobDisapproved(uint256 jobId, address validator);
    event JobCompleted(uint256 jobId, address agent, uint256 reputationPoints);
    event ReputationUpdated(address user, uint256 newReputation);
    event JobCancelled(uint256 jobId);
    event DisputeResolved(uint256 jobId, address resolver, string resolution);
    event DisputeResolvedWithCode(uint256 jobId, address resolver, uint8 resolutionCode, string reason);
    event JobDisputed(uint256 jobId, address disputant);
    event JobExpired(uint256 jobId, address employer, address agent, uint256 payout);
    event EnsRegistryUpdated(address indexed newEnsRegistry);
    event NameWrapperUpdated(address indexed newNameWrapper);
    event RootNodesUpdated(
        bytes32 clubRootNode,
        bytes32 agentRootNode,
        bytes32 alphaClubRootNode,
        bytes32 alphaAgentRootNode
    );
    event MerkleRootsUpdated(bytes32 validatorMerkleRoot, bytes32 agentMerkleRoot);
    event AGITypeUpdated(address indexed nftAddress, uint256 payoutPercentage);
    event NFTIssued(uint256 indexed tokenId, address indexed employer, string tokenURI);
    event RewardPoolContribution(address indexed contributor, uint256 amount);
    event CompletionReviewPeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
    event DisputeReviewPeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
    event AdditionalAgentPayoutPercentageUpdated(uint256 newPercentage);
    event AGIWithdrawn(address indexed to, uint256 amount, uint256 remainingWithdrawable);
    event PlatformRevenueAccrued(uint256 indexed jobId, uint256 amount);
    event IdentityConfigurationLocked(address indexed locker, uint256 atTimestamp);
    event AgentBlacklisted(address indexed agent, bool status);
    event ValidatorBlacklisted(address indexed validator, bool status);
    event ValidatorBondParamsUpdated(uint256 bps, uint256 min, uint256 max);
    event ChallengePeriodAfterApprovalUpdated(uint256 oldPeriod, uint256 newPeriod);
    event SettlementPauseSet(address indexed setter, bool paused);

    uint8 private constant ENS_HOOK_CREATE = 1;
    uint8 private constant ENS_HOOK_ASSIGN = 2;
    uint8 private constant ENS_HOOK_COMPLETION = 3;
    uint8 private constant ENS_HOOK_REVOKE = 4;
    uint8 private constant ENS_HOOK_LOCK = 5;
    uint8 private constant ENS_HOOK_LOCK_BURN = 6;
    uint256 internal constant ENS_HOOK_GAS_LIMIT = 500_000;
    uint256 internal constant ENS_URI_GAS_LIMIT = 200_000;

    constructor(
        address agiTokenAddress,
        string memory baseIpfs,
        address[2] memory ensConfig,
        bytes32[4] memory rootNodes,
        bytes32[2] memory merkleRoots
    ) ERC721("AGIJobs", "Job") {
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
        TransferUtils.safeTransfer(address(agiToken), to, amount);
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
        if (bond == 0) return 0;
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
        if (bond == 0) return;
        job.disputeBondAmount = 0;
        job.disputeInitiator = address(0);
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
        if (nextJobId != 0 || lockedEscrow != 0) revert InvalidState();
    }

    function _requireValidReviewPeriod(uint256 period) internal pure {
        if (!(period > 0 && period <= MAX_REVIEW_PERIOD)) revert InvalidParameters();
    }

    function _requireActiveDispute(Job storage job) internal view {
        if (!job.disputed || job.expired) revert InvalidState();
    }

    function _requireJobUnsettled(Job storage job) internal view {
        if (job.completed || job.expired || job.disputed) revert InvalidState();
    }

    function _requireAssignedAgent(Job storage job) internal view {
        if (job.assignedAgent == address(0)) revert InvalidState();
    }

    function _requireNotCompletedOrExpired(Job storage job) internal view {
        if (job.completed || job.expired) revert InvalidState();
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
    function setSettlementPaused(bool paused) external onlyOwner {
        settlementPaused = paused;
        emit SettlementPauseSet(msg.sender, paused);
    }
    function lockIdentityConfiguration() external onlyOwner whenIdentityConfigurable {
        lockIdentityConfig = true;
        emit IdentityConfigurationLocked(msg.sender, block.timestamp);
    }

    function createJob(string memory _jobSpecURI, uint256 _payout, uint256 _duration, string memory _details) external whenNotPaused nonReentrant {
        if (!(_payout > 0 && _duration > 0 && _payout <= maxJobPayout && _duration <= jobDurationLimit)) revert InvalidParameters();
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

    function applyForJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof) external whenNotPaused nonReentrant {
        Job storage job = _job(_jobId);
        if (job.assignedAgent != address(0)) revert InvalidState();
        if (blacklistedAgents[msg.sender]) revert Blacklisted();
        if (!(additionalAgents[msg.sender]
            || _verifyOwnership(msg.sender, subdomain, proof, agentMerkleRoot, agentRootNode, alphaAgentRootNode)
        )) revert NotAuthorized();
        if (activeJobsByAgent[msg.sender] >= maxActiveJobsPerAgent) revert InvalidState();
        uint256 snapshotPct = getHighestPayoutPercentage(msg.sender);
        if (snapshotPct == 0) revert IneligibleAgentPayout();
        job.agentPayoutPct = uint8(snapshotPct);
        uint256 bond = BondMath.computeAgentBond(
            job.payout,
            job.duration,
            agentBondBps,
            agentBond,
            agentBondMax,
            jobDurationLimit
        );
        TransferUtils.safeTransferFromExact(address(agiToken), msg.sender, address(this), bond);
        unchecked {
            lockedAgentBonds += bond;
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

    function requestJobCompletion(uint256 _jobId, string calldata _jobCompletionURI) external nonReentrant {
        Job storage job = _job(_jobId);
        if (bytes(_jobCompletionURI).length == 0) revert InvalidParameters();
        if (msg.sender != job.assignedAgent) revert NotAuthorized();
        _requireNotCompletedOrExpired(job);
        if (!job.disputed && block.timestamp > job.assignedAt + job.duration) revert InvalidState();
        if (job.completionRequested) revert InvalidState();
        UriUtils.requireValidUri(_jobCompletionURI);
        job.jobCompletionURI = _jobCompletionURI;
        job.completionRequested = true;
        job.completionRequestedAt = block.timestamp;
        emit JobCompletionRequested(_jobId, msg.sender, _jobCompletionURI);
        _callEnsJobPagesHook(ENS_HOOK_COMPLETION, _jobId);
    }

    function validateJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof) external whenNotPaused nonReentrant {
        _recordValidatorVote(_jobId, subdomain, proof, true);
    }

    function disapproveJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof) external whenNotPaused nonReentrant {
        _recordValidatorVote(_jobId, subdomain, proof, false);
    }

    function _recordValidatorVote(
        uint256 _jobId,
        string memory subdomain,
        bytes32[] calldata proof,
        bool approve
    ) internal {
        Job storage job = _job(_jobId);
        if (job.disputed) revert InvalidState();
        _requireAssignedAgent(job);
        _requireNotCompletedOrExpired(job);
        if (blacklistedValidators[msg.sender]) revert Blacklisted();
        if (!(additionalValidators[msg.sender]
            || _verifyOwnership(msg.sender, subdomain, proof, validatorMerkleRoot, clubRootNode, alphaClubRootNode)
        )) revert NotAuthorized();
        if (!job.completionRequested) revert InvalidState();
        if (block.timestamp > job.completionRequestedAt + completionReviewPeriod) revert InvalidState();
        if (job.approvals[msg.sender] || job.disapprovals[msg.sender]) revert InvalidState();

        uint256 bond = job.validatorBondAmount;
        if (bond == 0) {
            bond = BondMath.computeValidatorBond(job.payout, validatorBondBps, validatorBondMin, validatorBondMax);
            job.validatorBondAmount = bond + 1;
        } else {
            unchecked {
                bond -= 1;
            }
        }
        if (bond > 0) {
            TransferUtils.safeTransferFromExact(address(agiToken), msg.sender, address(this), bond);
            unchecked {
                lockedValidatorBonds += bond;
            }
        }
        _enforceValidatorCapacity(job.validators.length);
        if (approve) {
            job.validatorApprovals++;
            job.approvals[msg.sender] = true;
            job.validators.push(msg.sender);
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
        job.validatorDisapprovals++;
        job.disapprovals[msg.sender] = true;
        job.validators.push(msg.sender);
        emit JobDisapproved(_jobId, msg.sender);
        if (job.validatorDisapprovals >= requiredValidatorDisapprovals) {
            job.disputed = true;
            job.disputedAt = block.timestamp;
            emit JobDisputed(_jobId, msg.sender);
        }
    }

    function disputeJob(uint256 _jobId) external whenNotPaused nonReentrant {
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
        TransferUtils.safeTransferFromExact(address(agiToken), msg.sender, address(this), bond);
        unchecked {
            lockedDisputeBonds += bond;
        }
        job.disputeInitiator = msg.sender;
        job.disputeBondAmount = bond;
        job.disputed = true;
        job.disputedAt = block.timestamp;
        emit JobDisputed(_jobId, msg.sender);
    }

    /// @notice Deprecated: use resolveDisputeWithCode for typed settlement.
    /// @dev Non-canonical strings map to NO_ACTION (dispute remains active).
    function resolveDispute(uint256 _jobId, string calldata resolution) external onlyModerator whenSettlementNotPaused nonReentrant {
        uint8 resolutionCode = uint8(DisputeResolutionCode.NO_ACTION);
        bytes32 r = keccak256(bytes(resolution));
        if (r == RES_AGENT_WIN) {
            resolutionCode = uint8(DisputeResolutionCode.AGENT_WIN);
        } else if (r == RES_EMPLOYER_WIN) {
            resolutionCode = uint8(DisputeResolutionCode.EMPLOYER_WIN);
        }
        _resolveDispute(_jobId, resolutionCode, resolution);
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

        if (resolutionCode == uint8(DisputeResolutionCode.NO_ACTION)) {
            emit DisputeResolvedWithCode(_jobId, msg.sender, resolutionCode, reason);
            return;
        }

        _clearDispute(job);

        if (resolutionCode == uint8(DisputeResolutionCode.AGENT_WIN)) {
            _completeJob(_jobId, true);
        } else if (resolutionCode == uint8(DisputeResolutionCode.EMPLOYER_WIN)) {
            _refundEmployer(_jobId, job);
        } else {
            revert InvalidParameters();
        }

        string memory legacyResolution = resolutionCode == uint8(DisputeResolutionCode.AGENT_WIN)
            ? "agent win"
            : "employer win";
        emit DisputeResolved(_jobId, msg.sender, legacyResolution);
        emit DisputeResolvedWithCode(_jobId, msg.sender, resolutionCode, reason);
    }

    function resolveStaleDispute(uint256 _jobId, bool employerWins) external onlyOwner whenSettlementNotPaused nonReentrant {
        Job storage job = _job(_jobId);
        _requireActiveDispute(job);
        if (job.disputedAt == 0 || block.timestamp <= job.disputedAt + disputeReviewPeriod) revert InvalidState();

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

    function delistJob(uint256 _jobId) external onlyOwner whenSettlementNotPaused {
        Job storage job = _job(_jobId);
        if (job.completed || job.assignedAgent != address(0)) revert InvalidState();
        _cancelJobAndRefund(_jobId, job);
    }

    function addModerator(address _moderator) external onlyOwner { _setAddressFlag(moderators, _moderator, true); }
    function removeModerator(address _moderator) external onlyOwner { _setAddressFlag(moderators, _moderator, false); }
    function updateAGITokenAddress(address _newTokenAddress) external onlyOwner whenIdentityConfigurable {
        if (_newTokenAddress == address(0)) revert InvalidParameters();
        _requireEmptyEscrow();
        agiToken = IERC20(_newTokenAddress);
    }
    function updateEnsRegistry(address _newEnsRegistry) external onlyOwner whenIdentityConfigurable {
        if (_newEnsRegistry == address(0)) revert InvalidParameters();
        _requireEmptyEscrow();
        ens = ENS(_newEnsRegistry);
        emit EnsRegistryUpdated(_newEnsRegistry);
    }
    function updateNameWrapper(address _newNameWrapper) external onlyOwner whenIdentityConfigurable {
        if (_newNameWrapper == address(0)) revert InvalidParameters();
        _requireEmptyEscrow();
        nameWrapper = NameWrapper(_newNameWrapper);
        emit NameWrapperUpdated(_newNameWrapper);
    }
    function setEnsJobPages(address _ensJobPages) external onlyOwner whenIdentityConfigurable {
        if (_ensJobPages != address(0) && _ensJobPages.code.length == 0) revert InvalidParameters();
        ensJobPages = _ensJobPages;
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
    function updateMerkleRoots(bytes32 _validatorMerkleRoot, bytes32 _agentMerkleRoot) external onlyOwner {
        validatorMerkleRoot = _validatorMerkleRoot;
        agentMerkleRoot = _agentMerkleRoot;
        emit MerkleRootsUpdated(_validatorMerkleRoot, _agentMerkleRoot);
    }
    function setBaseIpfsUrl(string calldata _url) external onlyOwner { baseIpfsUrl = _url; }
    function setRequiredValidatorApprovals(uint256 _approvals) external onlyOwner {
        _validateValidatorThresholds(_approvals, requiredValidatorDisapprovals);
        requiredValidatorApprovals = _approvals;
    }
    function setRequiredValidatorDisapprovals(uint256 _disapprovals) external onlyOwner {
        _validateValidatorThresholds(requiredValidatorApprovals, _disapprovals);
        requiredValidatorDisapprovals = _disapprovals;
    }
    function setVoteQuorum(uint256 _quorum) external onlyOwner {
        if (_quorum == 0 || _quorum > MAX_VALIDATORS_PER_JOB) revert InvalidParameters();
        voteQuorum = _quorum;
    }
    function setPremiumReputationThreshold(uint256 _threshold) external onlyOwner { premiumReputationThreshold = _threshold; }
    function setMaxJobPayout(uint256 _maxPayout) external onlyOwner { maxJobPayout = _maxPayout; }
    function setJobDurationLimit(uint256 _limit) external onlyOwner { jobDurationLimit = _limit; }
    function setCompletionReviewPeriod(uint256 _period) external onlyOwner {
        _requireValidReviewPeriod(_period);
        uint256 oldPeriod = completionReviewPeriod;
        completionReviewPeriod = _period;
        emit CompletionReviewPeriodUpdated(oldPeriod, _period);
    }
    function setDisputeReviewPeriod(uint256 _period) external onlyOwner {
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
        if (bps == 0 && min == 0 && max == 0) {
            agentBondBps = 0;
            agentBond = 0;
            agentBondMax = 0;
            return;
        }
        if (max == 0) revert InvalidParameters();
        agentBondBps = bps;
        agentBond = min;
        agentBondMax = max;
    }
    function setAgentBond(uint256 bond) external onlyOwner {
        agentBond = bond;
    }
    function setValidatorSlashBps(uint256 bps) external onlyOwner {
        if (bps > 10_000) revert InvalidParameters();
        validatorSlashBps = bps;
    }
    function setChallengePeriodAfterApproval(uint256 period) external onlyOwner {
        _requireValidReviewPeriod(period);
        uint256 oldPeriod = challengePeriodAfterApproval;
        challengePeriodAfterApproval = period;
        emit ChallengePeriodAfterApprovalUpdated(oldPeriod, period);
    }
    function setAdditionalAgentPayoutPercentage(uint256) external onlyOwner {
        revert InvalidState();
    }
    function updateTermsAndConditionsIpfsHash(string calldata _hash) external onlyOwner { termsAndConditionsIpfsHash = _hash; }
    function updateContactEmail(string calldata _email) external onlyOwner { contactEmail = _email; }
    function updateAdditionalText1(string calldata _text) external onlyOwner { additionalText1 = _text; }
    function updateAdditionalText2(string calldata _text) external onlyOwner { additionalText2 = _text; }
    function updateAdditionalText3(string calldata _text) external onlyOwner { additionalText3 = _text; }

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
        validationRewardPercentage = _percentage;
    }

    function enforceReputationGrowth(address _user, uint256 _points) internal {
        uint256 newReputation;
        unchecked {
            newReputation = reputation[_user] + _points;
        }
        uint256 diminishedReputation = newReputation / (1 + ((newReputation * newReputation) / (88888 * 88888)));

        if (diminishedReputation > 88888) {
            diminishedReputation = 88888;
        }
        reputation[_user] = diminishedReputation;
        emit ReputationUpdated(_user, diminishedReputation);
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
            if (job.disputedAt == 0) {
                job.disputedAt = block.timestamp;
            }
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
        validatorBudget = (job.payout * validationRewardPercentage) / 100;
        agentPayout = (job.payout * agentPayoutPercentage) / 100;
        unchecked {
            if (agentPayoutPercentage + validationRewardPercentage > 100) {
                revert InvalidParameters();
            }
        }
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
        if (bond != 0) {
            unchecked {
                bond -= 1;
                lockedValidatorBonds -= bond * vCount;
            }
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
            validatorReputationGain = (reputationPoints * validationRewardPercentage) / 100;
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
            if (target != address(0) && target.code.length != 0) {
                bytes memory payload = new bytes(36);
                assembly {
                    mstore(add(payload, 32), 0x751809b400000000000000000000000000000000000000000000000000000000)
                    mstore(add(payload, 36), jobId)
                }
                (bool ok, bytes memory data) = target.staticcall{ gas: ENS_URI_GAS_LIMIT }(payload);
                if (ok && data.length != 0) {
                    string memory ensUri = abi.decode(data, (string));
                    if (bytes(ensUri).length != 0) {
                        tokenUriValue = ensUri;
                    }
                }
            }
        }
        tokenUriValue = UriUtils.applyBaseIpfs(tokenUriValue, baseIpfsUrl);
        _mint(job.employer, tokenId);
        _tokenURIs[tokenId] = tokenUriValue;
        emit NFTIssued(tokenId, job.employer, tokenUriValue);
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
            ? (job.payout * validationRewardPercentage) / 100
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
        if (target == address(0) || target.code.length == 0) {
            return;
        }
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, shl(224, 0x1f76f7a2))
            mstore(add(ptr, 4), hook)
            mstore(add(ptr, 36), jobId)
            pop(call(ENS_HOOK_GAS_LIMIT, target, 0, ptr, 0x44, 0, 0))
        }
    }

    function _verifyOwnership(
        address claimant,
        string memory subdomain,
        bytes32[] calldata proof,
        bytes32 merkleRoot,
        bytes32 rootNode,
        bytes32 alphaRootNode
    ) internal view returns (bool) {
        return MerkleProof.verifyCalldata(proof, merkleRoot, keccak256(abi.encodePacked(claimant)))
            || _verifyOwnershipByRoot(claimant, subdomain, rootNode)
            || _verifyOwnershipByRoot(claimant, subdomain, alphaRootNode);
    }

    function _verifyOwnershipByRoot(address claimant, string memory subdomain, bytes32 rootNode) internal view returns (bool) {
        return rootNode != bytes32(0)
            && ENSOwnership.verifyENSOwnership(address(ens), address(nameWrapper), claimant, subdomain, rootNode);
    }

    function addAdditionalValidator(address validator) external onlyOwner { _setAddressFlag(additionalValidators, validator, true); }
    function removeAdditionalValidator(address validator) external onlyOwner { _setAddressFlag(additionalValidators, validator, false); }
    function addAdditionalAgent(address agent) external onlyOwner { _setAddressFlag(additionalAgents, agent, true); }
    function removeAdditionalAgent(address agent) external onlyOwner { _setAddressFlag(additionalAgents, agent, false); }

    /// @notice Includes retained payout remainders; withdrawable only via withdrawAGI() when paused.
    /// @dev Owner withdrawals are limited to balances not backing lockedEscrow/locked*Bonds.
    function withdrawableAGI() public view returns (uint256) {
        uint256 bal = agiToken.balanceOf(address(this));
        uint256 lockedTotal = lockedEscrow + lockedValidatorBonds + lockedAgentBonds + lockedDisputeBonds;
        if (bal < lockedTotal) revert InsolventEscrowBalance();
        return bal - lockedTotal;
    }

    function withdrawAGI(uint256 amount) external onlyOwner whenSettlementNotPaused whenPaused nonReentrant {
        if (amount == 0) revert InvalidParameters();
        uint256 available = withdrawableAGI();
        if (amount > available) revert InsufficientWithdrawableBalance();
        _t(msg.sender, amount);
        emit AGIWithdrawn(msg.sender, amount, available - amount);
    }

    function canAccessPremiumFeature(address user) external view returns (bool) {
        return reputation[user] >= premiumReputationThreshold;
    }

    function contributeToRewardPool(uint256 amount) external whenNotPaused nonReentrant {
        if (amount == 0) revert InvalidParameters();
        TransferUtils.safeTransferFromExact(address(agiToken), msg.sender, address(this), amount);
        emit RewardPoolContribution(msg.sender, amount);
    }

    function addAGIType(address nftAddress, uint256 payoutPercentage) external onlyOwner {
        if (!(nftAddress != address(0) && payoutPercentage > 0 && payoutPercentage <= 100)) revert InvalidParameters();

        (bool exists, uint256 maxPct) = _maxAGITypePayoutAfterUpdate(nftAddress, payoutPercentage);
        if ((!exists && agiTypes.length >= MAX_AGI_TYPES) || maxPct > 100 - validationRewardPercentage) {
            revert InvalidParameters();
        }
        if (exists) {
            _updateAgiTypePayout(nftAddress, payoutPercentage);
        } else {
            agiTypes.push(AGIType({ nftAddress: nftAddress, payoutPercentage: payoutPercentage }));
        }
        emit AGITypeUpdated(nftAddress, payoutPercentage);
    }

    function _maxAGITypePayoutAfterUpdate(address nftAddress, uint256 payoutPercentage) internal view returns (bool exists, uint256 maxPct) {
        maxPct = payoutPercentage;
        for (uint256 i = 0; i < agiTypes.length; ) {
            uint256 pct = agiTypes[i].payoutPercentage;
            if (agiTypes[i].nftAddress == nftAddress) {
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
        return (exists, maxPct);
    }

    function _updateAgiTypePayout(address nftAddress, uint256 payoutPercentage) internal {
        for (uint256 i = 0; i < agiTypes.length; ) {
            if (agiTypes[i].nftAddress == nftAddress) {
                agiTypes[i].payoutPercentage = payoutPercentage;
                break;
            }
            unchecked {
                ++i;
            }
        }
    }

    function getHighestPayoutPercentage(address agent) public view returns (uint256) {
        uint256 highestPercentage = 0;
        for (uint256 i = 0; i < agiTypes.length; ) {
            if (IERC721(agiTypes[i].nftAddress).balanceOf(agent) > 0 && agiTypes[i].payoutPercentage > highestPercentage) {
                highestPercentage = agiTypes[i].payoutPercentage;
            }
            unchecked {
                ++i;
            }
        }
        return highestPercentage;
    }
}
