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
import "@openzeppelin/contracts/utils/math/Math.sol";

interface ENS {
    function resolver(bytes32 node) external view returns (address);
}

interface Resolver {
    function addr(bytes32 node) external view returns (address payable);
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
    error ValidatorSetTooLarge();
    error IneligibleAgentPayout();
    error InsufficientWithdrawableBalance();
    error InsolventEscrowBalance();
    error ConfigLocked();

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
    uint256 public requiredValidatorApprovals = 3;
    uint256 public requiredValidatorDisapprovals = 3;
    uint256 public premiumReputationThreshold = 10000;
    uint256 public validationRewardPercentage = 8;
    uint256 public maxJobPayout = 88888888e18;
    uint256 public jobDurationLimit = 10000000;
    uint256 public completionReviewPeriod = 7 days;
    uint256 public disputeReviewPeriod = 14 days;
    uint256 internal constant MAX_REVIEW_PERIOD = 365 days;
    uint256 public additionalAgentPayoutPercentage = 50;
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
    event IdentityConfigurationLocked(address indexed locker, uint256 atTimestamp);
    event AgentBlacklisted(address indexed agent, bool status);
    event ValidatorBlacklisted(address indexed validator, bool status);
    event ValidatorBondParamsUpdated(uint256 bps, uint256 min, uint256 max);
    event ChallengePeriodAfterApprovalUpdated(uint256 oldPeriod, uint256 newPeriod);

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
        _safeERC20Transfer(agiToken, to, amount);
    }

    function _safeERC20Transfer(IERC20 token, address to, uint256 amount) internal {
        if (amount == 0) return;
        _callOptionalReturn(token, abi.encodeWithSelector(token.transfer.selector, to, amount));
    }

    function _safeERC20TransferFromExact(IERC20 token, address from, address to, uint256 amount) internal {
        if (amount == 0) return;
        uint256 balanceBefore = token.balanceOf(to);
        _callOptionalReturn(token, abi.encodeWithSelector(token.transferFrom.selector, from, to, amount));
        uint256 balanceAfter = token.balanceOf(to);
        if (balanceAfter < balanceBefore || balanceAfter - balanceBefore != amount) revert TransferFailed();
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

    function _computeValidatorBond(uint256 payout) internal view returns (uint256 bond) {
        if (validatorBondBps == 0 && validatorBondMin == 0 && validatorBondMax == 0) {
            return 0;
        }
        unchecked {
            bond = (payout * validatorBondBps) / 10_000;
        }
        if (bond < validatorBondMin) bond = validatorBondMin;
        if (bond > validatorBondMax) bond = validatorBondMax;
        if (bond > payout) bond = payout;
    }

    function _computeAgentBond(uint256 payout, uint256 duration) internal view returns (uint256 bond) {
        if (agentBondBps == 0 && agentBond == 0 && agentBondMax == 0) {
            return 0;
        }
        unchecked {
            bond = (payout * agentBondBps) / 10_000;
        }
        if (bond < agentBond) bond = agentBond;
        if (jobDurationLimit != 0) {
            unchecked {
                bond += (bond * duration) / jobDurationLimit;
            }
        }
        if (agentBondMax != 0 && bond > agentBondMax) bond = agentBondMax;
        if (bond > payout) bond = payout;
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

    function _callOptionalReturn(IERC20 token, bytes memory data) internal {
        (bool success, bytes memory returndata) = address(token).call(data);
        if (!success) revert TransferFailed();
        if (returndata.length == 0) return;
        if (returndata.length == 32) {
            if (!abi.decode(returndata, (bool))) revert TransferFailed();
            return;
        }
        revert TransferFailed();
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    function lockIdentityConfiguration() external onlyOwner whenIdentityConfigurable {
        lockIdentityConfig = true;
        emit IdentityConfigurationLocked(msg.sender, block.timestamp);
    }

    function createJob(string memory _jobSpecURI, uint256 _payout, uint256 _duration, string memory _details) external whenNotPaused nonReentrant {
        if (!(_payout > 0 && _duration > 0 && _payout <= maxJobPayout && _duration <= jobDurationLimit)) revert InvalidParameters();
        _requireValidUri(_jobSpecURI);
        uint256 jobId = nextJobId;
        unchecked {
            ++nextJobId;
        }
        Job storage job = jobs[jobId];
        job.employer = msg.sender;
        job.jobSpecURI = _jobSpecURI;
        job.payout = _payout;
        job.duration = _duration;
        _safeERC20TransferFromExact(agiToken, msg.sender, address(this), _payout);
        unchecked {
            lockedEscrow += _payout;
        }
        emit JobCreated(jobId, _jobSpecURI, _payout, _duration, _details);
    }

    function applyForJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof) external whenNotPaused nonReentrant {
        Job storage job = _job(_jobId);
        if (job.assignedAgent != address(0)) revert InvalidState();
        if (blacklistedAgents[msg.sender]) revert Blacklisted();
        if (!(additionalAgents[msg.sender] || _verifyOwnershipAgent(msg.sender, subdomain, proof))) revert NotAuthorized();
        if (activeJobsByAgent[msg.sender] >= maxActiveJobsPerAgent) revert InvalidState();
        uint256 snapshotPct = getHighestPayoutPercentage(msg.sender);
        if (snapshotPct == 0) revert IneligibleAgentPayout();
        job.agentPayoutPct = uint8(snapshotPct);
        uint256 bond = _computeAgentBond(job.payout, job.duration);
        _safeERC20TransferFromExact(agiToken, msg.sender, address(this), bond);
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
    }

    function requestJobCompletion(uint256 _jobId, string calldata _jobCompletionURI) external {
        Job storage job = _job(_jobId);
        if (bytes(_jobCompletionURI).length == 0) revert InvalidParameters();
        if (msg.sender != job.assignedAgent) revert NotAuthorized();
        if (job.completed || job.expired) revert InvalidState();
        if (!job.disputed && block.timestamp > job.assignedAt + job.duration) revert InvalidState();
        if (job.completionRequested) revert InvalidState();
        _requireValidUri(_jobCompletionURI);
        job.jobCompletionURI = _jobCompletionURI;
        job.completionRequested = true;
        job.completionRequestedAt = block.timestamp;
        emit JobCompletionRequested(_jobId, msg.sender, _jobCompletionURI);
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
        if (job.assignedAgent == address(0)) revert InvalidState();
        if (job.completed) revert InvalidState();
        if (job.expired) revert InvalidState();
        if (blacklistedValidators[msg.sender]) revert Blacklisted();
        if (!(additionalValidators[msg.sender] || _verifyOwnershipValidator(msg.sender, subdomain, proof))) revert NotAuthorized();
        if (!job.completionRequested) revert InvalidState();
        if (block.timestamp > job.completionRequestedAt + completionReviewPeriod) revert InvalidState();
        if (job.approvals[msg.sender] || job.disapprovals[msg.sender]) revert InvalidState();

        uint256 bond = job.validatorBondAmount;
        if (bond == 0) {
            bond = _computeValidatorBond(job.payout);
            job.validatorBondAmount = bond + 1;
        } else {
            unchecked {
                bond -= 1;
            }
        }
        if (bond > 0) {
            _safeERC20TransferFromExact(agiToken, msg.sender, address(this), bond);
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
        if (job.disputed || job.completed || job.expired) revert InvalidState();
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
        _safeERC20TransferFromExact(agiToken, msg.sender, address(this), bond);
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
    function resolveDispute(uint256 _jobId, string calldata resolution) external onlyModerator nonReentrant {
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
    ) external onlyModerator nonReentrant {
        _resolveDispute(_jobId, resolutionCode, reason);
    }

    function _resolveDispute(uint256 _jobId, uint8 resolutionCode, string memory reason) internal {
        Job storage job = _job(_jobId);
        if (!job.disputed || job.expired) revert InvalidState();

        if (resolutionCode == uint8(DisputeResolutionCode.NO_ACTION)) {
            emit DisputeResolvedWithCode(_jobId, msg.sender, resolutionCode, reason);
            return;
        }

        job.disputed = false;
        job.disputedAt = 0;

        if (resolutionCode == uint8(DisputeResolutionCode.AGENT_WIN)) {
            _completeJob(_jobId, true);
        } else if (resolutionCode == uint8(DisputeResolutionCode.EMPLOYER_WIN)) {
            _refundEmployer(job);
        } else {
            revert InvalidParameters();
        }

        string memory legacyResolution = resolutionCode == uint8(DisputeResolutionCode.AGENT_WIN)
            ? "agent win"
            : "employer win";
        emit DisputeResolved(_jobId, msg.sender, legacyResolution);
        emit DisputeResolvedWithCode(_jobId, msg.sender, resolutionCode, reason);
    }

    function resolveStaleDispute(uint256 _jobId, bool employerWins) external onlyOwner nonReentrant {
        Job storage job = _job(_jobId);
        if (!job.disputed || job.expired) revert InvalidState();
        if (job.disputedAt == 0) revert InvalidState();
        if (block.timestamp <= job.disputedAt + disputeReviewPeriod) revert InvalidState();

        job.disputed = false;
        job.disputedAt = 0;
        if (employerWins) {
            _refundEmployer(job);
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

    function delistJob(uint256 _jobId) external onlyOwner {
        Job storage job = _job(_jobId);
        if (job.completed || job.assignedAgent != address(0)) revert InvalidState();
        _releaseEscrow(job);
        _t(job.employer, job.payout);
        delete jobs[_jobId];
        emit JobCancelled(_jobId);
    }

    function addModerator(address _moderator) external onlyOwner { moderators[_moderator] = true; }
    function removeModerator(address _moderator) external onlyOwner { moderators[_moderator] = false; }
    function updateAGITokenAddress(address _newTokenAddress) external onlyOwner whenIdentityConfigurable {
        if (_newTokenAddress == address(0)) revert InvalidParameters();
        if (nextJobId != 0 || lockedEscrow != 0) revert InvalidState();
        agiToken = IERC20(_newTokenAddress);
    }
    function updateEnsRegistry(address _newEnsRegistry) external onlyOwner whenIdentityConfigurable {
        if (_newEnsRegistry == address(0)) revert InvalidParameters();
        if (nextJobId != 0 || lockedEscrow != 0) revert InvalidState();
        ens = ENS(_newEnsRegistry);
        emit EnsRegistryUpdated(_newEnsRegistry);
    }
    function updateNameWrapper(address _newNameWrapper) external onlyOwner whenIdentityConfigurable {
        if (_newNameWrapper == address(0)) revert InvalidParameters();
        if (nextJobId != 0 || lockedEscrow != 0) revert InvalidState();
        nameWrapper = NameWrapper(_newNameWrapper);
        emit NameWrapperUpdated(_newNameWrapper);
    }
    function updateRootNodes(
        bytes32 _clubRootNode,
        bytes32 _agentRootNode,
        bytes32 _alphaClubRootNode,
        bytes32 _alphaAgentRootNode
    ) external onlyOwner whenIdentityConfigurable {
        if (nextJobId != 0 || lockedEscrow != 0) revert InvalidState();
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
    function setPremiumReputationThreshold(uint256 _threshold) external onlyOwner { premiumReputationThreshold = _threshold; }
    function setMaxJobPayout(uint256 _maxPayout) external onlyOwner { maxJobPayout = _maxPayout; }
    function setJobDurationLimit(uint256 _limit) external onlyOwner { jobDurationLimit = _limit; }
    function setCompletionReviewPeriod(uint256 _period) external onlyOwner {
        if (!(_period > 0 && _period <= MAX_REVIEW_PERIOD)) revert InvalidParameters();
        uint256 oldPeriod = completionReviewPeriod;
        completionReviewPeriod = _period;
        emit CompletionReviewPeriodUpdated(oldPeriod, _period);
    }
    function setDisputeReviewPeriod(uint256 _period) external onlyOwner {
        if (!(_period > 0 && _period <= MAX_REVIEW_PERIOD)) revert InvalidParameters();
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
        if (!(period > 0 && period <= MAX_REVIEW_PERIOD)) revert InvalidParameters();
        uint256 oldPeriod = challengePeriodAfterApproval;
        challengePeriodAfterApproval = period;
        emit ChallengePeriodAfterApprovalUpdated(oldPeriod, period);
    }
    function setAdditionalAgentPayoutPercentage(uint256 _percentage) external onlyOwner {
        if (!(_percentage > 0 && _percentage <= 100)) revert InvalidParameters();
        if (_percentage > 100 - validationRewardPercentage) revert InvalidParameters();
        additionalAgentPayoutPercentage = _percentage;
        emit AdditionalAgentPayoutPercentageUpdated(_percentage);
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
        uint256 currentReputation = reputation[_user];
        uint256 newReputation = currentReputation + _points;

        uint256 diminishingFactor = 1 + ((newReputation * newReputation) / (88888 * 88888));
        uint256 diminishedReputation = newReputation / diminishingFactor;

        if (diminishedReputation > 88888) {
            reputation[_user] = 88888;
        } else {
            reputation[_user] = diminishedReputation;
        }
        emit ReputationUpdated(_user, reputation[_user]);
    }

    function cancelJob(uint256 _jobId) external nonReentrant {
        Job storage job = _job(_jobId);
        if (msg.sender != job.employer) revert NotAuthorized();
        if (job.completed || job.assignedAgent != address(0)) revert InvalidState();
        _releaseEscrow(job);
        _t(job.employer, job.payout);
        delete jobs[_jobId];
        emit JobCancelled(_jobId);
    }

    function expireJob(uint256 _jobId) external nonReentrant {
        Job storage job = _job(_jobId);
        if (job.completed || job.expired || job.disputed || job.completionRequested) revert InvalidState();
        if (job.assignedAgent == address(0)) revert InvalidState();
        if (block.timestamp <= job.assignedAt + job.duration) revert InvalidState();

        job.expired = true;
        _decrementActiveJob(job);
        _releaseEscrow(job);
        _settleAgentBond(job, false, false);
        _t(job.employer, job.payout);
        emit JobExpired(_jobId, job.employer, job.assignedAgent, job.payout);
    }

    function finalizeJob(uint256 _jobId) external nonReentrant {
        Job storage job = _job(_jobId);
        uint256 approvals = job.validatorApprovals;
        uint256 disapprovals = job.validatorDisapprovals;
        uint256 quorum = requiredValidatorApprovals;
        if (job.completed || job.expired || job.disputed) revert InvalidState();
        if (!job.completionRequested) revert InvalidState();
        if (requiredValidatorDisapprovals != 0
            && (quorum == 0 || requiredValidatorDisapprovals < quorum)
        ) {
            quorum = requiredValidatorDisapprovals;
        }
        if (quorum < 3) {
            quorum = 3;
        }
        if (job.validatorApproved) {
            if (block.timestamp <= job.validatorApprovedAt + challengePeriodAfterApproval) revert InvalidState();
            if (approvals > disapprovals) {
                _completeJob(_jobId, job.validators.length != 0);
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
            _completeJob(_jobId, job.validators.length != 0);
            return;
        }
        if (totalVotes < quorum || approvals == disapprovals) {
            job.disputed = true;
            job.disputedAt = block.timestamp;
            emit JobDisputed(_jobId, msg.sender);
            return;
        }
        if (approvals > disapprovals) {
            _completeJob(_jobId, job.validators.length != 0);
            return;
        }
        _refundEmployer(job);

    }

    function _completeJob(uint256 _jobId, bool repEligible) internal {
        Job storage job = _job(_jobId);
        if (job.completed || job.expired) revert InvalidState();
        if (job.disputed) revert InvalidState();
        if (job.assignedAgent == address(0)) revert InvalidState();

        uint256 agentPayoutPercentage = job.agentPayoutPct;
        if (agentPayoutPercentage == 0) revert InvalidState();
        uint256 validatorBudget = (job.payout * validationRewardPercentage) / 100;
        if (agentPayoutPercentage + validationRewardPercentage > 100) {
            revert InvalidParameters();
        }
        uint256 agentPayout = (job.payout * agentPayoutPercentage) / 100;
        if (agentPayout + validatorBudget > job.payout) revert InvalidParameters();

        job.completed = true;
        _decrementActiveJob(job);
        _releaseEscrow(job);
        _settleAgentBond(job, true, false);

        uint256 reputationPoints = _computeReputationPoints(job, repEligible);
        enforceReputationGrowth(job.assignedAgent, reputationPoints);

        _t(job.assignedAgent, agentPayout);

        if (job.validators.length == 0) {
            _t(job.employer, validatorBudget);
        } else {
            _settleValidators(job, true, reputationPoints, validatorBudget, 0);
        }
        _mintCompletionNFT(job);
        _settleDisputeBond(job, true);

        emit JobCompleted(_jobId, job.assignedAgent, reputationPoints);
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

    function _mintCompletionNFT(Job storage job) internal {
        uint256 tokenId = nextTokenId;
        unchecked {
            ++nextTokenId;
        }
        string memory tokenUriValue = job.jobCompletionURI;
        bytes memory uriBytes = bytes(tokenUriValue);
        bool hasScheme;
        for (uint256 i = 0; i + 2 < uriBytes.length; ) {
            if (uriBytes[i] == ':' && uriBytes[i + 1] == '/' && uriBytes[i + 2] == '/') {
                hasScheme = true;
                break;
            }
            unchecked {
                ++i;
            }
        }
        if (!hasScheme && bytes(baseIpfsUrl).length != 0) {
            tokenUriValue = string(abi.encodePacked(baseIpfsUrl, "/", tokenUriValue));
        }
        _mint(job.employer, tokenId);
        _tokenURIs[tokenId] = tokenUriValue;
        emit NFTIssued(tokenId, job.employer, tokenUriValue);
    }

    function _refundEmployer(Job storage job) internal {
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
        uint256 reputationPoints = _computeReputationPoints(job, true);
        _settleValidators(job, false, reputationPoints, escrowValidatorReward, agentBondPool);
        _t(job.employer, employerRefund);
        _settleDisputeBond(job, false);
    }

    function _computeReputationPoints(
        Job storage job,
        bool repEligible
    ) internal view returns (uint256 reputationPoints) {
        if (!repEligible) {
            return 0;
        }
        uint256 completionTime = job.completionRequestedAt > job.assignedAt
            ? job.completionRequestedAt - job.assignedAt
            : 0;
        unchecked {
            uint256 payoutUnits = job.payout / 1e15;
            uint256 timeBonus;
            if (job.duration > completionTime) {
                timeBonus = (job.duration - completionTime) / 10000;
            }
            uint256 base = Math.log2(1 + payoutUnits);
            if (timeBonus > base) {
                timeBonus = base;
            }
            reputationPoints = base + timeBonus;
        }
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireMinted(tokenId);
        return _tokenURIs[tokenId];
    }

    function _requireValidUri(string memory uri) internal pure {
        bytes memory data = bytes(uri);
        if (data.length == 0) revert InvalidParameters();
        for (uint256 i = 0; i < data.length; ) {
            bytes1 c = data[i];
            if (c == 0x20 || c == 0x09 || c == 0x0a || c == 0x0d) revert InvalidParameters();
            unchecked {
                ++i;
            }
        }
    }

    function _verifyOwnershipAgent(
        address claimant,
        string memory subdomain,
        bytes32[] calldata proof
    ) internal view returns (bool) {
        return MerkleProof.verifyCalldata(proof, agentMerkleRoot, keccak256(abi.encodePacked(claimant)))
            || _verifyOwnershipByRoot(claimant, subdomain, agentRootNode)
            || _verifyOwnershipByRoot(claimant, subdomain, alphaAgentRootNode);
    }

    function _verifyOwnershipValidator(
        address claimant,
        string memory subdomain,
        bytes32[] calldata proof
    ) internal view returns (bool) {
        return MerkleProof.verifyCalldata(proof, validatorMerkleRoot, keccak256(abi.encodePacked(claimant)))
            || _verifyOwnershipByRoot(claimant, subdomain, clubRootNode)
            || _verifyOwnershipByRoot(claimant, subdomain, alphaClubRootNode);
    }

    function _verifyOwnershipByRoot(address claimant, string memory subdomain, bytes32 rootNode) internal view returns (bool) {
        if (rootNode == bytes32(0)) {
            return false;
        }
        bytes32 subnode = keccak256(abi.encodePacked(rootNode, keccak256(bytes(subdomain))));
        return _verifyNameWrapperOwnership(claimant, subnode) || _verifyResolverOwnership(claimant, subnode);
    }

    function _verifyNameWrapperOwnership(address claimant, bytes32 subnode) internal view returns (bool) {
        try nameWrapper.ownerOf(uint256(subnode)) returns (address actualOwner) {
            return actualOwner == claimant;
        } catch {
        }
        return false;
    }

    function _verifyResolverOwnership(address claimant, bytes32 subnode) internal view returns (bool) {
        address resolverAddress = ens.resolver(subnode);
        if (resolverAddress == address(0)) {
            return false;
        }

        Resolver resolver = Resolver(resolverAddress);
        try resolver.addr(subnode) returns (address payable resolvedAddress) {
            return resolvedAddress == claimant;
        } catch {
        }
        return false;
    }

    function addAdditionalValidator(address validator) external onlyOwner { additionalValidators[validator] = true; }
    function removeAdditionalValidator(address validator) external onlyOwner { additionalValidators[validator] = false; }
    function addAdditionalAgent(address agent) external onlyOwner { additionalAgents[agent] = true; }
    function removeAdditionalAgent(address agent) external onlyOwner { additionalAgents[agent] = false; }

    function withdrawableAGI() public view returns (uint256) {
        uint256 bal = agiToken.balanceOf(address(this));
        uint256 lockedTotal = lockedEscrow + lockedValidatorBonds + lockedAgentBonds + lockedDisputeBonds;
        if (bal < lockedTotal) revert InsolventEscrowBalance();
        return bal - lockedTotal;
    }

    function withdrawAGI(uint256 amount) external onlyOwner whenPaused nonReentrant {
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
        _safeERC20TransferFromExact(agiToken, msg.sender, address(this), amount);
        emit RewardPoolContribution(msg.sender, amount);
    }

    function addAGIType(address nftAddress, uint256 payoutPercentage) external onlyOwner {
        if (!(nftAddress != address(0) && payoutPercentage > 0 && payoutPercentage <= 100)) revert InvalidParameters();

        (bool exists, uint256 maxPct) = _maxAGITypePayoutAfterUpdate(nftAddress, payoutPercentage);
        if (maxPct > 100 - validationRewardPercentage) revert InvalidParameters();
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
