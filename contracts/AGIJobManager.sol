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

pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
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
    using MerkleProof for bytes32[];

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
    error InvalidAgentPayoutSnapshot();
    error InsufficientWithdrawableBalance();
    error InsolventEscrowBalance();
    error ConfigLocked();

    /// @notice Canonical job lifecycle status enum (numeric ordering is stable; do not reorder).
    /// @dev 0 = Deleted (employer == address(0) or removed)
    /// @dev 1 = Open (exists, employer set, no assigned agent)
    /// @dev 2 = InProgress (assigned agent, not completed, not disputed, no completion request)
    /// @dev 3 = CompletionRequested (agent requested completion)
    /// @dev 4 = Disputed (disputed flag on)
    /// @dev 5 = Completed (completed flag on)
    /// @dev 6 = Expired (computed timeout; informational if expireJob not called)
    enum JobStatus {
        Deleted,
        Open,
        InProgress,
        CompletionRequested,
        Disputed,
        Completed,
        Expired
    }

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
    uint256 public maxJobPayout = 4888e18;
    uint256 public jobDurationLimit = 10000000;
    uint256 public completionReviewPeriod = 7 days;
    uint256 public disputeReviewPeriod = 14 days;
    uint256 internal constant MAX_REVIEW_PERIOD = 365 days;
    uint256 public additionalAgentPayoutPercentage = 50;
    /// @notice Total AGI reserved for unsettled job escrows.
    /// @dev Tracks job payout escrows only.
    uint256 public lockedEscrow;

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
    bool public configLocked;

    struct Job {
        uint256 id;
        address employer;
        string jobSpecURI;
        string jobCompletionURI;
        string ipfsHash;
        uint256 payout;
        uint256 duration;
        address assignedAgent;
        uint256 assignedAt;
        bool completed;
        bool completionRequested;
        uint256 validatorApprovals;
        uint256 validatorDisapprovals;
        bool disputed;
        string details;
        mapping(address => bool) approvals;
        mapping(address => bool) disapprovals;
        address[] validators;
        uint256 completionRequestedAt;
        uint256 disputedAt;
        bool expired;
        uint8 agentPayoutPct;
        bool escrowReleased;
    }

    struct AGIType {
        address nftAddress;
        uint256 payoutPercentage;
    }

    struct Listing {
        uint256 tokenId;
        address seller;
        uint256 price;
        bool isActive;
    }


    uint256 public nextJobId;
    uint256 public nextTokenId;
    mapping(uint256 => Job) internal jobs;
    mapping(address => uint256) public reputation;
    mapping(address => bool) public moderators;
    mapping(address => bool) public additionalValidators;
    mapping(address => bool) public additionalAgents;
    mapping(address => uint256[]) public validatorApprovedJobs;
    mapping(uint256 => Listing) public listings;
    mapping(address => bool) public blacklistedAgents;
    mapping(address => bool) public blacklistedValidators;
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
    event JobFinalized(uint256 jobId, address agent, address employer, bool agentPaid, uint256 payout);
    event DisputeTimeoutResolved(uint256 jobId, address resolver, bool employerWins);
    event EnsRegistryUpdated(address indexed newEnsRegistry);
    event NameWrapperUpdated(address indexed newNameWrapper);
    event RootNodesUpdated(
        bytes32 clubRootNode,
        bytes32 agentRootNode,
        bytes32 alphaClubRootNode,
        bytes32 alphaAgentRootNode
    );
    event MerkleRootsUpdated(bytes32 validatorMerkleRoot, bytes32 agentMerkleRoot);
    event OwnershipVerified(address claimant, string subdomain);
    event RecoveryInitiated(string reason);
    event AGITypeUpdated(address indexed nftAddress, uint256 payoutPercentage);
    event NFTIssued(uint256 indexed tokenId, address indexed employer, string tokenURI);
    event NFTListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event NFTPurchased(uint256 indexed tokenId, address indexed buyer, uint256 price);
    event NFTDelisted(uint256 indexed tokenId);
    event RewardPoolContribution(address indexed contributor, uint256 amount);
    event CompletionReviewPeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
    event DisputeReviewPeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
    event AdditionalAgentPayoutPercentageUpdated(uint256 newPercentage);
    event AGIWithdrawn(address indexed to, uint256 amount, uint256 remainingWithdrawable);
    event ConfigurationLocked(address indexed locker, uint256 atTimestamp);

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

    modifier whenCriticalConfigurable() {
        if (configLocked) revert ConfigLocked();
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

    function _tFrom(address from, address to, uint256 amount) internal {
        _safeERC20TransferFrom(agiToken, from, to, amount);
    }

    function _safeERC20Transfer(IERC20 token, address to, uint256 amount) internal {
        if (amount == 0) return;
        _callOptionalReturn(token, abi.encodeWithSelector(token.transfer.selector, to, amount));
    }

    function _safeERC20TransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        if (amount == 0) return;
        _callOptionalReturn(token, abi.encodeWithSelector(token.transferFrom.selector, from, to, amount));
    }

    function _safeERC20TransferFromExact(IERC20 token, address from, address to, uint256 amount) internal {
        if (amount == 0) return;
        uint256 balanceBefore = token.balanceOf(to);
        _safeERC20TransferFrom(token, from, to, amount);
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
    function lockConfiguration() external onlyOwner whenCriticalConfigurable {
        configLocked = true;
        emit ConfigurationLocked(msg.sender, block.timestamp);
    }

    function createJob(string memory _jobSpecURI, uint256 _payout, uint256 _duration, string memory _details) external whenNotPaused nonReentrant {
        if (!(_payout > 0 && _duration > 0 && _payout <= maxJobPayout && _duration <= jobDurationLimit)) revert InvalidParameters();
        _requireValidUri(_jobSpecURI);
        uint256 jobId = nextJobId;
        unchecked {
            ++nextJobId;
        }
        Job storage job = jobs[jobId];
        job.id = jobId;
        job.employer = msg.sender;
        job.jobSpecURI = _jobSpecURI;
        job.ipfsHash = _jobSpecURI;
        job.payout = _payout;
        job.duration = _duration;
        job.details = _details;
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
        uint256 snapshotPct = getHighestPayoutPercentage(msg.sender);
        if (snapshotPct == 0) revert IneligibleAgentPayout();
        job.agentPayoutPct = uint8(snapshotPct);
        job.assignedAgent = msg.sender;
        job.assignedAt = block.timestamp;
        emit JobApplied(_jobId, msg.sender);
    }

    function requestJobCompletion(uint256 _jobId, string calldata _jobCompletionURI) external {
        Job storage job = _job(_jobId);
        if (bytes(_jobCompletionURI).length == 0) revert InvalidParameters();
        require(!paused() || job.disputed, "Pausable: paused");
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
        Job storage job = _job(_jobId);
        if (job.disputed) revert InvalidState();
        if (job.assignedAgent == address(0)) revert InvalidState();
        if (job.completed) revert InvalidState();
        if (job.expired) revert InvalidState();
        if (blacklistedValidators[msg.sender]) revert Blacklisted();
        if (!(additionalValidators[msg.sender] || _verifyOwnershipValidator(msg.sender, subdomain, proof))) revert NotAuthorized();
        if (!job.completionRequested) revert InvalidState();
        _requireValidUri(job.jobCompletionURI);
        if (job.approvals[msg.sender]) revert InvalidState();
        if (job.disapprovals[msg.sender]) revert InvalidState();

        _enforceValidatorCapacity(job.validators.length);
        job.validatorApprovals++;
        job.approvals[msg.sender] = true;
        job.validators.push(msg.sender);
        validatorApprovedJobs[msg.sender].push(_jobId);
        emit JobValidated(_jobId, msg.sender);
        if (job.validatorApprovals >= requiredValidatorApprovals) _completeJob(_jobId);
    }

    function disapproveJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof) external whenNotPaused nonReentrant {
        Job storage job = _job(_jobId);
        if (job.disputed) revert InvalidState();
        if (job.assignedAgent == address(0)) revert InvalidState();
        if (job.completed) revert InvalidState();
        if (job.expired) revert InvalidState();
        if (blacklistedValidators[msg.sender]) revert Blacklisted();
        if (!(additionalValidators[msg.sender] || _verifyOwnershipValidator(msg.sender, subdomain, proof))) revert NotAuthorized();
        if (!job.completionRequested) revert InvalidState();
        _requireValidUri(job.jobCompletionURI);
        if (job.disapprovals[msg.sender]) revert InvalidState();
        if (job.approvals[msg.sender]) revert InvalidState();

        _enforceValidatorCapacity(job.validators.length);
        job.validatorDisapprovals++;
        job.disapprovals[msg.sender] = true;
        job.validators.push(msg.sender);
        validatorApprovedJobs[msg.sender].push(_jobId);
        emit JobDisapproved(_jobId, msg.sender);
        if (job.validatorDisapprovals >= requiredValidatorDisapprovals) {
            job.disputed = true;
            if (job.disputedAt == 0) {
                job.disputedAt = block.timestamp;
            }
            emit JobDisputed(_jobId, msg.sender);
        }
    }

    function disputeJob(uint256 _jobId) external whenNotPaused nonReentrant {
        Job storage job = _job(_jobId);
        if (job.disputed || job.completed || job.expired) revert InvalidState();
        if (msg.sender != job.assignedAgent && msg.sender != job.employer) revert NotAuthorized();
        if (!job.completionRequested) revert InvalidState();
        job.disputed = true;
        if (job.disputedAt == 0) {
            job.disputedAt = block.timestamp;
        }
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
            _completeJob(_jobId);
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

    function resolveStaleDispute(uint256 _jobId, bool employerWins) external onlyOwner whenPaused nonReentrant {
        Job storage job = _job(_jobId);
        if (!job.disputed || job.expired) revert InvalidState();
        if (job.disputedAt == 0) revert InvalidState();
        if (block.timestamp <= job.disputedAt + disputeReviewPeriod) revert InvalidState();

        emit RecoveryInitiated("DISPUTE_TIMEOUT");
        if (employerWins) {
            _refundEmployer(job);
        } else {
            job.disputed = false;
            job.disputedAt = 0;
            _completeJob(_jobId);
        }
        emit DisputeTimeoutResolved(_jobId, msg.sender, employerWins);
    }

    function blacklistAgent(address _agent, bool _status) external onlyOwner {
        blacklistedAgents[_agent] = _status;
    }
    function blacklistValidator(address _validator, bool _status) external onlyOwner {
        blacklistedValidators[_validator] = _status;
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
    function updateAGITokenAddress(address _newTokenAddress) external onlyOwner whenCriticalConfigurable {
        if (_newTokenAddress == address(0)) revert InvalidParameters();
        if (nextJobId != 0 || lockedEscrow != 0) revert InvalidState();
        agiToken = IERC20(_newTokenAddress);
    }
    function updateEnsRegistry(address _newEnsRegistry) external onlyOwner whenCriticalConfigurable {
        if (_newEnsRegistry == address(0)) revert InvalidParameters();
        if (nextJobId != 0 || lockedEscrow != 0) revert InvalidState();
        ens = ENS(_newEnsRegistry);
        emit EnsRegistryUpdated(_newEnsRegistry);
    }
    function updateNameWrapper(address _newNameWrapper) external onlyOwner whenCriticalConfigurable {
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
    ) external onlyOwner whenCriticalConfigurable {
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
    function updateTermsAndContact(string calldata _hash, string calldata _email) external onlyOwner {
        termsAndConditionsIpfsHash = _hash;
        contactEmail = _email;
    }
    function updateAdditionalTexts(
        string calldata _text1,
        string calldata _text2,
        string calldata _text3
    ) external onlyOwner {
        additionalText1 = _text1;
        additionalText2 = _text2;
        additionalText3 = _text3;
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

    function getJobURIs(uint256 jobId)
        external
        view
        returns (
            string memory jobSpecURI,
            string memory jobCompletionURI,
            string memory ipfsHash,
            string memory details
        )
    {
        Job storage job = _job(jobId);
        return (job.jobSpecURI, job.jobCompletionURI, job.ipfsHash, job.details);
    }

    function setValidationRewardPercentage(uint256 _percentage) external onlyOwner {
        if (!(_percentage > 0 && _percentage <= 100)) revert InvalidParameters();
        uint256 maxPct = _maxAGITypePayoutPercentage();
        if (maxPct > 100 - _percentage) revert InvalidParameters();
        validationRewardPercentage = _percentage;
    }

    function calculateReputationPoints(uint256 _payout, uint256 _duration) internal pure returns (uint256) {
        unchecked {
            uint256 scaledPayout = _payout / 1e18;
            uint256 payoutPoints = scaledPayout ** 3 / 1e5;
            return log2(1 + payoutPoints * 1e6) + _duration / 10000;
        }
    }

    function calculateValidatorReputationPoints(uint256 agentReputationGain) internal view returns (uint256) {
        unchecked {
            return (agentReputationGain * validationRewardPercentage) / 100;
        }
    }

    function log2(uint x) internal pure returns (uint y) {
        return Math.log2(x);
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
        _releaseEscrow(job);
        _t(job.employer, job.payout);
        emit JobExpired(_jobId, job.employer, job.assignedAgent, job.payout);
    }

    function finalizeJob(uint256 _jobId) external nonReentrant {
        Job storage job = _job(_jobId);
        _validateFinalization(job);

        if (_shouldFinalizeFromValidators(job)) {
            _completeJob(_jobId);
            emit JobFinalized(_jobId, job.assignedAgent, job.employer, true, job.payout);
            return;
        }

        bool agentWins = _agentWinsFinalization(job);
        if (agentWins) {
            _completeJob(_jobId);
        } else {
            _refundEmployer(job);
        }

        emit JobFinalized(_jobId, job.assignedAgent, job.employer, agentWins, job.payout);
    }

    function _validateFinalization(Job storage job) internal view {
        if (job.completed || job.expired || job.disputed) revert InvalidState();
        if (!job.completionRequested || job.completionRequestedAt == 0) revert InvalidState();
        if (block.timestamp <= job.completionRequestedAt + completionReviewPeriod) revert InvalidState();
        if (requiredValidatorDisapprovals > 0 && job.validatorDisapprovals >= requiredValidatorDisapprovals) {
            revert InvalidState();
        }
    }

    function _shouldFinalizeFromValidators(Job storage job) internal view returns (bool) {
        return requiredValidatorApprovals > 0 && job.validatorApprovals >= requiredValidatorApprovals;
    }

    function _agentWinsFinalization(Job storage job) internal view returns (bool) {
        if (job.validatorApprovals == 0 && job.validatorDisapprovals == 0) {
            return true;
        }
        return job.validatorApprovals > job.validatorDisapprovals;
    }

    function _completeJob(uint256 _jobId) internal {
        Job storage job = _job(_jobId);
        _validateCompletion(job);
        _validatePayoutBounds(job);

        job.completed = true;
        job.disputed = false;
        _releaseEscrow(job);

        uint256 reputationPoints = _applyCompletionReputation(job);

        _payAgent(job);
        _payValidators(job, reputationPoints);
        _mintJobNft(job);

        emit JobCompleted(_jobId, job.assignedAgent, reputationPoints);
        emit ReputationUpdated(job.assignedAgent, reputation[job.assignedAgent]);
    }

    function _validateCompletion(Job storage job) internal view {
        if (job.completed || job.expired) revert InvalidState();
        if (job.disputed) revert InvalidState();
        if (job.assignedAgent == address(0)) revert InvalidState();
        if (!job.completionRequested) revert InvalidState();
        _requireValidUri(job.jobCompletionURI);
    }

    function _validatePayoutBounds(Job storage job) internal view {
        uint256 agentPayoutPercentage = job.agentPayoutPct;
        if (agentPayoutPercentage == 0) revert InvalidAgentPayoutSnapshot();
        uint256 validatorPayoutPercentage = job.validators.length > 0 ? validationRewardPercentage : 0;
        if (agentPayoutPercentage + validatorPayoutPercentage > 100) revert InvalidParameters();
        uint256 agentPayout = (job.payout * agentPayoutPercentage) / 100;
        uint256 totalValidatorPayout = job.validators.length > 0
            ? (job.payout * validationRewardPercentage) / 100
            : 0;
        if (agentPayout + totalValidatorPayout > job.payout) revert InvalidParameters();
    }

    function _applyCompletionReputation(Job storage job) internal returns (uint256) {
        uint256 completionTime = block.timestamp - job.assignedAt;
        uint256 reputationPoints = calculateReputationPoints(job.payout, completionTime);
        enforceReputationGrowth(job.assignedAgent, reputationPoints);
        return reputationPoints;
    }

    function _refundEmployer(Job storage job) internal {
        job.completed = true;
        job.disputed = false;
        job.disputedAt = 0;
        _releaseEscrow(job);
        _t(job.employer, job.payout);
    }

    function _payAgent(Job storage job) internal {
        uint256 agentPayoutPercentage = job.agentPayoutPct;
        if (agentPayoutPercentage == 0) revert InvalidAgentPayoutSnapshot();
        uint256 agentPayout;
        unchecked {
            agentPayout = (job.payout * agentPayoutPercentage) / 100;
        }
        _t(job.assignedAgent, agentPayout);
    }

    function _payValidators(Job storage job, uint256 reputationPoints) internal {
        uint256 vCount = job.validators.length;
        if (vCount > MAX_VALIDATORS_PER_JOB) revert ValidatorSetTooLarge();
        if (vCount == 0) return;

        uint256 totalValidatorPayout;
        uint256 validatorPayout;
        unchecked {
            totalValidatorPayout = (job.payout * validationRewardPercentage) / 100;
            validatorPayout = totalValidatorPayout / vCount;
        }
        uint256 validatorReputationGain = calculateValidatorReputationPoints(reputationPoints);

        for (uint256 i = 0; i < vCount; ) {
            address validator = job.validators[i];
            _t(validator, validatorPayout);
            enforceReputationGrowth(validator, validatorReputationGain);
            unchecked {
                ++i;
            }
        }
    }

    function _mintJobNft(Job storage job) internal {
        uint256 tokenId = nextTokenId;
        unchecked {
            ++nextTokenId;
        }
        _requireValidUri(job.jobCompletionURI);
        string memory tokenUriValue = _formatTokenURI(job.jobCompletionURI);
        _mint(job.employer, tokenId);
        _setTokenURI(tokenId, tokenUriValue);
        emit NFTIssued(tokenId, job.employer, tokenUriValue);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireMinted(tokenId);
        return _tokenURIs[tokenId];
    }

    function _setTokenURI(uint256 tokenId, string memory _tokenURI) internal {
        _requireMinted(tokenId);
        _tokenURIs[tokenId] = _tokenURI;
    }

    function _formatTokenURI(string memory uri) internal view returns (string memory) {
        if (_isFullUri(uri)) {
            return uri;
        }
        if (bytes(baseIpfsUrl).length == 0) {
            return uri;
        }
        return string(abi.encodePacked(baseIpfsUrl, "/", uri));
    }

    function _isFullUri(string memory uri) internal pure returns (bool) {
        bytes memory data = bytes(uri);
        if (data.length < 3) return false;
        for (uint256 i = 0; i + 2 < data.length; ) {
            if (data[i] == ":" && data[i + 1] == "/" && data[i + 2] == "/") {
                return true;
            }
            unchecked {
                ++i;
            }
        }
        return false;
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

    function listNFT(uint256 tokenId, uint256 price) external whenNotPaused {
        if (ownerOf(tokenId) != msg.sender) revert NotAuthorized();
        if (price == 0) revert InvalidParameters();
        listings[tokenId] = Listing(tokenId, msg.sender, price, true);
        emit NFTListed(tokenId, msg.sender, price);
    }

    function purchaseNFT(uint256 tokenId) external whenNotPaused nonReentrant {
        Listing storage listing = listings[tokenId];
        if (!listing.isActive) revert InvalidState();
        address seller = listing.seller;
        uint256 price = listing.price;
        if (seller == address(0)) revert InvalidState();
        if (seller == msg.sender) revert NotAuthorized();
        if (price == 0) revert InvalidParameters();
        if (ownerOf(tokenId) != seller) revert InvalidState();
        listing.isActive = false;
        _tFrom(msg.sender, seller, price);
        _safeTransfer(seller, msg.sender, tokenId, "");
        emit NFTPurchased(tokenId, msg.sender, price);
    }

    function delistNFT(uint256 tokenId) external whenNotPaused {
        Listing storage listing = listings[tokenId];
        if (!listing.isActive || listing.seller != msg.sender) revert NotAuthorized();
        listing.isActive = false;
        emit NFTDelisted(tokenId);
    }

    function _verifyOwnershipAgent(address claimant, string memory subdomain, bytes32[] calldata proof) internal returns (bool) {
        if (proof.verify(agentMerkleRoot, keccak256(abi.encodePacked(claimant)))) {
            emit OwnershipVerified(claimant, subdomain);
            return true;
        }

        if (_verifyOwnershipByRoot(claimant, subdomain, agentRootNode)) {
            emit OwnershipVerified(claimant, subdomain);
            return true;
        }

        if (_verifyOwnershipByRoot(claimant, subdomain, alphaAgentRootNode)) {
            emit OwnershipVerified(claimant, subdomain);
            return true;
        }

        return false;
    }

    function _verifyOwnershipValidator(address claimant, string memory subdomain, bytes32[] calldata proof) internal returns (bool) {
        if (proof.verify(validatorMerkleRoot, keccak256(abi.encodePacked(claimant)))) {
            emit OwnershipVerified(claimant, subdomain);
            return true;
        }

        if (_verifyOwnershipByRoot(claimant, subdomain, clubRootNode)) {
            emit OwnershipVerified(claimant, subdomain);
            return true;
        }

        if (_verifyOwnershipByRoot(claimant, subdomain, alphaClubRootNode)) {
            emit OwnershipVerified(claimant, subdomain);
            return true;
        }

        return false;
    }

    function _verifyOwnershipByRoot(address claimant, string memory subdomain, bytes32 rootNode) internal returns (bool) {
        if (rootNode == bytes32(0)) {
            return false;
        }
        bytes32 subnode = keccak256(abi.encodePacked(rootNode, keccak256(bytes(subdomain))));
        if (_verifyNameWrapperOwnership(claimant, subnode)) {
            return true;
        }

        if (_verifyResolverOwnership(claimant, subnode)) {
            return true;
        }

        return false;
    }

    function _verifyNameWrapperOwnership(address claimant, bytes32 subnode) internal returns (bool) {
        try nameWrapper.ownerOf(uint256(subnode)) returns (address actualOwner) {
            return actualOwner == claimant;
        } catch {
            emit RecoveryInitiated("NW_FAIL");
        }
        return false;
    }

    function _verifyResolverOwnership(address claimant, bytes32 subnode) internal returns (bool) {
        address resolverAddress = ens.resolver(subnode);
        if (resolverAddress == address(0)) {
            emit RecoveryInitiated("NO_RES");
            return false;
        }

        Resolver resolver = Resolver(resolverAddress);
        try resolver.addr(subnode) returns (address payable resolvedAddress) {
            return resolvedAddress == claimant;
        } catch {
            emit RecoveryInitiated("RES_FAIL");
        }
        return false;
    }

    function addAdditionalValidator(address validator) external onlyOwner { additionalValidators[validator] = true; }
    function removeAdditionalValidator(address validator) external onlyOwner { additionalValidators[validator] = false; }
    function addAdditionalAgent(address agent) external onlyOwner { additionalAgents[agent] = true; }
    function removeAdditionalAgent(address agent) external onlyOwner { additionalAgents[agent] = false; }

    function withdrawableAGI() public view returns (uint256) {
        uint256 bal = agiToken.balanceOf(address(this));
        if (bal < lockedEscrow) revert InsolventEscrowBalance();
        return bal - lockedEscrow;
    }

    function withdrawAGI(uint256 amount) external onlyOwner whenPaused nonReentrant {
        if (amount == 0) revert InvalidParameters();
        uint256 available = withdrawableAGI();
        if (amount > available) revert InsufficientWithdrawableBalance();
        _t(msg.sender, amount);
        emit AGIWithdrawn(msg.sender, amount, available - amount);
    }

    function canAccessPremiumFeature(address user) public view returns (bool) {
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
