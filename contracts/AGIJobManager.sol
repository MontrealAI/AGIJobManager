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

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

interface ENS {
    function resolver(bytes32 node) external view returns (address);
}

interface Resolver {
    function addr(bytes32 node) external view returns (address payable);
}

interface NameWrapper {
    function ownerOf(uint256 id) external view returns (address);
}

contract AGIJobManager is Ownable, ReentrancyGuard, Pausable, ERC721URIStorage {
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

    // Pre-hashed resolution strings (smaller + cheaper than hashing literals each call)
    bytes32 private constant RES_AGENT_WIN = keccak256("agent win");
    bytes32 private constant RES_EMPLOYER_WIN = keccak256("employer win");

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
    uint256 public constant MAX_REVIEW_PERIOD = 365 days;

    string public termsAndConditionsIpfsHash;
    string public contactEmail;
    string public additionalText1;
    string public additionalText2;
    string public additionalText3;

    bytes32 public clubRootNode;
    bytes32 public agentRootNode;
    bytes32 public validatorMerkleRoot;
    bytes32 public agentMerkleRoot;
    ENS public ens;
    NameWrapper public nameWrapper;

    struct Job {
        uint256 id;
        address employer;
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
    mapping(uint256 => Job) public jobs;
    mapping(address => uint256) public reputation;
    mapping(address => bool) public moderators;
    mapping(address => bool) public additionalValidators;
    mapping(address => bool) public additionalAgents;
    mapping(address => uint256[]) public validatorApprovedJobs;
    mapping(uint256 => Listing) public listings;
    mapping(address => bool) public blacklistedAgents;
    mapping(address => bool) public blacklistedValidators;
    AGIType[] public agiTypes;

    event JobCreated(uint256 jobId, string ipfsHash, uint256 payout, uint256 duration, string details);
    event JobApplied(uint256 jobId, address agent);
    event JobCompletionRequested(uint256 jobId, address agent);
    event JobValidated(uint256 jobId, address validator);
    event JobDisapproved(uint256 jobId, address validator);
    event JobCompleted(uint256 jobId, address agent, uint256 reputationPoints);
    event ReputationUpdated(address user, uint256 newReputation);
    event JobCancelled(uint256 jobId);
    event DisputeResolved(uint256 jobId, address resolver, string resolution);
    event JobDisputed(uint256 jobId, address disputant);
    event JobExpired(uint256 jobId, address employer, address agent, uint256 payout);
    event JobFinalized(uint256 jobId, address agent, address employer, bool agentPaid, uint256 payout);
    event DisputeTimeoutResolved(uint256 jobId, address resolver, bool employerWins);
    event RootNodeUpdated(bytes32 indexed newRootNode);
    event MerkleRootUpdated(bytes32 indexed newMerkleRoot);
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

    constructor(
        address _agiTokenAddress,
        string memory _baseIpfsUrl,
        address _ensAddress,
        address _nameWrapperAddress,
        bytes32 _clubRootNode,
        bytes32 _agentRootNode,
        bytes32 _validatorMerkleRoot,
        bytes32 _agentMerkleRoot
    ) ERC721("AGIJobs", "Job") {
        agiToken = IERC20(_agiTokenAddress);
        baseIpfsUrl = _baseIpfsUrl;
        ens = ENS(_ensAddress);
        nameWrapper = NameWrapper(_nameWrapperAddress);
        clubRootNode = _clubRootNode;
        agentRootNode = _agentRootNode;
        validatorMerkleRoot = _validatorMerkleRoot;
        agentMerkleRoot = _agentMerkleRoot;

        _validateValidatorThresholds(requiredValidatorApprovals, requiredValidatorDisapprovals);
    }

    modifier onlyModerator() {
        if (!moderators[msg.sender]) revert NotModerator();
        _;
    }

    // -----------------------
    // Internal helpers (no new public/external functions/events)
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

    function createJob(string memory _ipfsHash, uint256 _payout, uint256 _duration, string memory _details) external whenNotPaused nonReentrant {
        if (!(_payout > 0 && _duration > 0 && _payout <= maxJobPayout && _duration <= jobDurationLimit)) revert InvalidParameters();
        uint256 jobId = nextJobId++;
        Job storage job = jobs[jobId];
        job.id = jobId;
        job.employer = msg.sender;
        job.ipfsHash = _ipfsHash;
        job.payout = _payout;
        job.duration = _duration;
        job.details = _details;
        _safeERC20TransferFromExact(agiToken, msg.sender, address(this), _payout);
        emit JobCreated(jobId, _ipfsHash, _payout, _duration, _details);
    }

    function applyForJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof) external whenNotPaused nonReentrant {
        Job storage job = _job(_jobId);
        if (job.assignedAgent != address(0)) revert InvalidState();
        if (blacklistedAgents[msg.sender]) revert Blacklisted();
        if (!(additionalAgents[msg.sender] || _verifyOwnership(msg.sender, subdomain, proof, agentRootNode))) revert NotAuthorized();
        job.assignedAgent = msg.sender;
        job.assignedAt = block.timestamp;
        emit JobApplied(_jobId, msg.sender);
    }

    function requestJobCompletion(uint256 _jobId, string calldata _ipfsHash) external whenNotPaused {
        Job storage job = _job(_jobId);
        if (msg.sender != job.assignedAgent) revert NotAuthorized();
        if (job.completed || job.disputed || job.expired) revert InvalidState();
        if (block.timestamp > job.assignedAt + job.duration) revert InvalidState();
        if (job.completionRequested) revert InvalidState();
        job.ipfsHash = _ipfsHash;
        job.completionRequested = true;
        job.completionRequestedAt = block.timestamp;
        emit JobCompletionRequested(_jobId, msg.sender);
    }

    function validateJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof) external whenNotPaused nonReentrant {
        Job storage job = _job(_jobId);
        if (job.assignedAgent == address(0)) revert InvalidState();
        if (job.completed) revert InvalidState();
        if (job.expired) revert InvalidState();
        if (blacklistedValidators[msg.sender]) revert Blacklisted();
        if (!(additionalValidators[msg.sender] || _verifyOwnership(msg.sender, subdomain, proof, clubRootNode))) revert NotAuthorized();
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
        if (job.assignedAgent == address(0)) revert InvalidState();
        if (job.completed) revert InvalidState();
        if (job.expired) revert InvalidState();
        if (blacklistedValidators[msg.sender]) revert Blacklisted();
        if (!(additionalValidators[msg.sender] || _verifyOwnership(msg.sender, subdomain, proof, clubRootNode))) revert NotAuthorized();
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
        job.disputed = true;
        if (job.disputedAt == 0) {
            job.disputedAt = block.timestamp;
        }
        emit JobDisputed(_jobId, msg.sender);
    }

    function resolveDispute(uint256 _jobId, string calldata resolution) external onlyModerator nonReentrant {
        Job storage job = _job(_jobId);
        if (!job.disputed || job.expired) revert InvalidState();

        // Preserve original behavior: accept any resolution string.
        // Trigger on-chain actions only for the two canonical strings.
        bytes32 r = keccak256(bytes(resolution));
        if (r == RES_AGENT_WIN) {
            _completeJob(_jobId);
        } else if (r == RES_EMPLOYER_WIN) {
            _t(job.employer, job.payout);
            // Critical fix: close the job to prevent later completion/double payout.
            job.completed = true;
        }

        job.disputed = false;
        job.disputedAt = 0;
        emit DisputeResolved(_jobId, msg.sender, resolution);
    }

    function resolveStaleDispute(uint256 _jobId, bool employerWins) external onlyOwner whenPaused nonReentrant {
        Job storage job = _job(_jobId);
        if (!job.disputed || job.expired) revert InvalidState();
        if (job.disputedAt == 0) revert InvalidState();
        if (block.timestamp <= job.disputedAt + disputeReviewPeriod) revert InvalidState();

        emit RecoveryInitiated("DISPUTE_TIMEOUT");
        if (employerWins) {
            _t(job.employer, job.payout);
            job.completed = true;
        } else {
            _completeJob(_jobId);
        }

        job.disputed = false;
        job.disputedAt = 0;
        emit DisputeTimeoutResolved(_jobId, msg.sender, employerWins);
    }

    function blacklistAgent(address _agent, bool _status) external onlyOwner { blacklistedAgents[_agent] = _status; }
    function blacklistValidator(address _validator, bool _status) external onlyOwner { blacklistedValidators[_validator] = _status; }

    function delistJob(uint256 _jobId) external onlyOwner {
        Job storage job = _job(_jobId);
        if (job.completed || job.assignedAgent != address(0)) revert InvalidState();
        _t(job.employer, job.payout);
        delete jobs[_jobId];
        emit JobCancelled(_jobId);
    }

    function addModerator(address _moderator) external onlyOwner { moderators[_moderator] = true; }
    function removeModerator(address _moderator) external onlyOwner { moderators[_moderator] = false; }
    function updateAGITokenAddress(address _newTokenAddress) external onlyOwner { agiToken = IERC20(_newTokenAddress); }
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
    function updateTermsAndConditionsIpfsHash(string calldata _hash) external onlyOwner { termsAndConditionsIpfsHash = _hash; }
    function updateContactEmail(string calldata _email) external onlyOwner { contactEmail = _email; }
    function updateAdditionalText1(string calldata _text) external onlyOwner { additionalText1 = _text; }
    function updateAdditionalText2(string calldata _text) external onlyOwner { additionalText2 = _text; }
    function updateAdditionalText3(string calldata _text) external onlyOwner { additionalText3 = _text; }

    function getJobStatus(uint256 _jobId) external view returns (bool, bool, string memory) {
        Job storage job = jobs[_jobId];
        return (job.completed, job.completionRequested, job.ipfsHash);
    }

    function setValidationRewardPercentage(uint256 _percentage) external onlyOwner {
        if (!(_percentage > 0 && _percentage <= 100)) revert InvalidParameters();
        validationRewardPercentage = _percentage;
    }

    function calculateReputationPoints(uint256 _payout, uint256 _duration) internal pure returns (uint256) {
        uint256 scaledPayout = _payout / 1e18;
        uint256 payoutPoints = scaledPayout ** 3 / 1e5;
        return log2(1 + payoutPoints * 1e6) + _duration / 10000;
    }

    function calculateValidatorReputationPoints(uint256 agentReputationGain) internal view returns (uint256) {
        return (agentReputationGain * validationRewardPercentage) / 100;
    }

    function log2(uint x) internal pure returns (uint y) {
        assembly {
            x := sub(x, 1)
            x := or(x, div(x, 0x02))
            x := or(x, div(x, 0x04))
            x := or(x, div(x, 0x10))
            x := or(x, div(x, 0x100))
            x := or(x, div(x, 0x10000))
            x := or(x, div(x, 0x100000000))
            x := or(x, div(x, 0x10000000000000000))
            x := or(x, div(x, 0x100000000000000000000000000000000))
            x := add(x, 1)
            y := 0
            for { let shift := 128 } gt(shift, 0) { shift := div(shift, 2) } {
                let temp := shr(shift, x)
                if gt(temp, 0) {
                    x := temp
                    y := add(y, shift)
                }
            }
        }
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
        _t(job.employer, job.payout);
        emit JobExpired(_jobId, job.employer, job.assignedAgent, job.payout);
    }

    function finalizeJob(uint256 _jobId) external nonReentrant {
        Job storage job = _job(_jobId);
        if (job.completed || job.expired || job.disputed) revert InvalidState();
        if (!job.completionRequested || job.completionRequestedAt == 0) revert InvalidState();
        if (block.timestamp <= job.completionRequestedAt + completionReviewPeriod) revert InvalidState();
        if (job.validatorDisapprovals >= requiredValidatorDisapprovals) revert InvalidState();

        if (job.validatorApprovals >= requiredValidatorApprovals) {
            _completeJob(_jobId);
            emit JobFinalized(_jobId, job.assignedAgent, job.employer, true, job.payout);
            return;
        }

        bool agentWins;
        if (job.validatorApprovals == 0 && job.validatorDisapprovals == 0) {
            agentWins = true;
        } else {
            agentWins = job.validatorApprovals > job.validatorDisapprovals;
        }

        if (agentWins) {
            _completeJob(_jobId);
        } else {
            _refundEmployer(job);
        }

        emit JobFinalized(_jobId, job.assignedAgent, job.employer, agentWins, job.payout);
    }

    function _completeJob(uint256 _jobId) internal {
        Job storage job = _job(_jobId);
        if (job.completed || job.expired) revert InvalidState();
        if (job.assignedAgent == address(0)) revert InvalidState();

        job.completed = true;
        job.disputed = false;

        uint256 completionTime = block.timestamp - job.assignedAt;
        uint256 reputationPoints = calculateReputationPoints(job.payout, completionTime);
        enforceReputationGrowth(job.assignedAgent, reputationPoints);

        _payAgent(job);
        _payValidators(job, reputationPoints);
        _mintJobNft(job);

        emit JobCompleted(_jobId, job.assignedAgent, reputationPoints);
        emit ReputationUpdated(job.assignedAgent, reputation[job.assignedAgent]);
    }

    function _refundEmployer(Job storage job) internal {
        job.completed = true;
        job.disputed = false;
        job.disputedAt = 0;
        _t(job.employer, job.payout);
    }

    function _payAgent(Job storage job) internal {
        uint256 agentPayoutPercentage = getHighestPayoutPercentage(job.assignedAgent);
        uint256 agentPayout = (job.payout * agentPayoutPercentage) / 100;
        _t(job.assignedAgent, agentPayout);
    }

    function _payValidators(Job storage job, uint256 reputationPoints) internal {
        uint256 vCount = job.validators.length;
        if (vCount > MAX_VALIDATORS_PER_JOB) revert ValidatorSetTooLarge();
        if (vCount == 0) return;

        uint256 totalValidatorPayout = (job.payout * validationRewardPercentage) / 100;
        uint256 validatorPayout = totalValidatorPayout / vCount;
        uint256 validatorReputationGain = calculateValidatorReputationPoints(reputationPoints);

        for (uint256 i = 0; i < vCount; i++) {
            address validator = job.validators[i];
            _t(validator, validatorPayout);
            enforceReputationGrowth(validator, validatorReputationGain);
        }
    }

    function _mintJobNft(Job storage job) internal {
        uint256 tokenId = nextTokenId++;
        string memory tokenURI = string(abi.encodePacked(baseIpfsUrl, "/", job.ipfsHash));
        _mint(job.employer, tokenId);
        _setTokenURI(tokenId, tokenURI);
        emit NFTIssued(tokenId, job.employer, tokenURI);
    }

    function listNFT(uint256 tokenId, uint256 price) external {
        if (ownerOf(tokenId) != msg.sender) revert NotAuthorized();
        if (price == 0) revert InvalidParameters();
        listings[tokenId] = Listing(tokenId, msg.sender, price, true);
        emit NFTListed(tokenId, msg.sender, price);
    }

    function purchaseNFT(uint256 tokenId) external nonReentrant {
        Listing storage listing = listings[tokenId];
        if (!listing.isActive) revert InvalidState();
        _tFrom(msg.sender, listing.seller, listing.price);
        _transfer(listing.seller, msg.sender, tokenId);
        listing.isActive = false;
        emit NFTPurchased(tokenId, msg.sender, listing.price);
    }

    function delistNFT(uint256 tokenId) external {
        Listing storage listing = listings[tokenId];
        if (!listing.isActive || listing.seller != msg.sender) revert NotAuthorized();
        listing.isActive = false;
        emit NFTDelisted(tokenId);
    }

    function _verifyOwnership(address claimant, string memory subdomain, bytes32[] calldata proof, bytes32 rootNode) internal returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(claimant));
        bytes32 merkleRoot = rootNode == agentRootNode ? agentMerkleRoot : validatorMerkleRoot;
        if (proof.verify(merkleRoot, leaf)) {
            emit OwnershipVerified(claimant, subdomain);
            return true;
        }

        bytes32 subnode = keccak256(abi.encodePacked(rootNode, keccak256(bytes(subdomain))));
        if (_verifyNameWrapperOwnership(claimant, subnode)) {
            emit OwnershipVerified(claimant, subdomain);
            return true;
        }

        if (_verifyResolverOwnership(claimant, subnode)) {
            emit OwnershipVerified(claimant, subdomain);
            return true;
        }

        return false;
    }

    function _verifyNameWrapperOwnership(address claimant, bytes32 subnode) internal returns (bool) {
        try nameWrapper.ownerOf(uint256(subnode)) returns (address actualOwner) {
            return actualOwner == claimant;
        } catch Error(string memory reason) {
            emit RecoveryInitiated(reason);
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

    function withdrawAGI(uint256 amount) external onlyOwner nonReentrant {
        uint256 bal = agiToken.balanceOf(address(this));
        if (amount == 0 || amount > bal) revert InvalidParameters();
        _t(msg.sender, amount);
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

        bool exists = false;
        for (uint256 i = 0; i < agiTypes.length; i++) {
            if (agiTypes[i].nftAddress == nftAddress) {
                agiTypes[i].payoutPercentage = payoutPercentage;
                exists = true;
                break;
            }
        }
        if (!exists) {
            agiTypes.push(AGIType({ nftAddress: nftAddress, payoutPercentage: payoutPercentage }));
        }

        emit AGITypeUpdated(nftAddress, payoutPercentage);
    }

    function getHighestPayoutPercentage(address agent) public view returns (uint256) {
        uint256 highestPercentage = 0;
        for (uint256 i = 0; i < agiTypes.length; i++) {
            if (IERC721(agiTypes[i].nftAddress).balanceOf(agent) > 0 && agiTypes[i].payoutPercentage > highestPercentage) {
                highestPercentage = agiTypes[i].payoutPercentage;
            }
        }
        return highestPercentage;
    }
}
