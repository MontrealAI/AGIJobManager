// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IReviewJobManager {
    function usdcToken() external view returns (IERC20);
    function getJobCore(uint256 jobId) external view returns (
        address employer, address agent, uint256 payout, uint256 duration,
        uint256 assignedAt, bool completed, bool disputed, bool expired, uint8 agentPayoutPct
    );
    function getJobValidation(uint256 jobId) external view returns (bool, uint256, uint256, uint256, uint256);
    function getJobCompletionURI(uint256 jobId) external view returns (string memory);
}

/**
 * @title AGIReviewEscrow
 * @notice Employer-funded review retainers, separate from job escrow and vote rewards.
 * @dev A named reviewer earns the fixed retainer by activating an authorized assignment
 * while its exact delivery is reviewable. This buys bounded review capacity, not a verdict
 * or proof of work quality. Employers bear authorized nonperformance risk. Earned credit
 * survives job acceptance, expiry and disputes. No administrator can remove that credit.
 */
contract AGIReviewEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    error InvalidAssignment();
    error Unauthorized();
    error AssignmentExists();
    error AssignmentNotFunded();
    error AssignmentExpired();
    error JobNotReviewable();
    error WrongDelivery();
    error InexactTransfer();
    error NoCredit();

    struct Assignment {
        address employer;
        address reviewer;
        uint256 jobId;
        bytes32 completionHash;
        uint256 fee;
        uint64 startBy;
        uint8 state; // 0 absent, 1 funded, 2 earned, 3 refunded
    }

    IReviewJobManager public immutable manager;
    IERC20 public immutable usdcToken;
    uint256 public totalLiability;
    mapping(bytes32 => Assignment) public assignments;
    mapping(address => uint256) public credits;

    event ReviewFunded(bytes32 indexed id, uint256 indexed jobId, address indexed reviewer,
        address employer, bytes32 completionHash, uint256 fee, uint64 startBy);
    event ReviewActivated(bytes32 indexed id, address indexed reviewer, uint256 fee);
    event ReviewRefunded(bytes32 indexed id, address indexed employer, uint256 fee);
    event CreditWithdrawn(address indexed beneficiary, uint256 amount);

    constructor(address managerAddress) {
        if (managerAddress.code.length == 0) revert InvalidAssignment();
        manager = IReviewJobManager(managerAddress);
        IERC20 token = manager.usdcToken();
        if (address(token).code.length == 0 || IERC20Metadata(address(token)).decimals() != 6) revert InvalidAssignment();
        if (block.chainid == 1 && address(token) != 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48) revert InvalidAssignment();
        if (block.chainid == 11155111 && address(token) != 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238) revert InvalidAssignment();
        usdcToken = token;
    }

    /// @notice One assignment per manager/job/reviewer, including cancelled assignments.
    function assignmentId(uint256 jobId, address reviewer) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), address(manager), jobId, reviewer));
    }

    function _reviewable(uint256 jobId, bytes32 completionHash, address reviewer) internal view returns (address employer) {
        address agent;
        bool completed;
        bool disputed;
        bool expired;
        (employer, agent, , , , completed, disputed, expired, ) = manager.getJobCore(jobId);
        (bool submitted, , , , ) = manager.getJobValidation(jobId);
        if (employer == address(0) || agent == address(0) || !submitted || completed || disputed || expired) revert JobNotReviewable();
        if (reviewer == employer || reviewer == agent) revert InvalidAssignment();
        if (keccak256(bytes(manager.getJobCompletionURI(jobId))) != completionHash) revert WrongDelivery();
    }

    /// @notice Funds a fixed, additional retainer from the actual employer's own USDC.
    function fundReview(uint256 jobId, address reviewer, bytes32 completionHash, uint256 fee, uint64 startBy)
        external nonReentrant returns (bytes32 id)
    {
        if (reviewer == address(0) || reviewer == address(this) || reviewer == address(manager) ||
            reviewer == address(usdcToken) || completionHash == bytes32(0) || fee == 0) revert InvalidAssignment();
        // Elapsed-time limits, not a randomness source.
        // solhint-disable-next-line not-rely-on-time
        if (startBy <= block.timestamp || startBy > block.timestamp + 30 days) revert InvalidAssignment();
        if (_reviewable(jobId, completionHash, reviewer) != msg.sender) revert Unauthorized();
        id = assignmentId(jobId, reviewer);
        if (assignments[id].state != 0) revert AssignmentExists();
        assignments[id] = Assignment(msg.sender, reviewer, jobId, completionHash, fee, startBy, 1);
        totalLiability += fee;
        uint256 beforeBalance = usdcToken.balanceOf(address(this));
        usdcToken.safeTransferFrom(msg.sender, address(this), fee);
        if (usdcToken.balanceOf(address(this)) != beforeBalance + fee) revert InexactTransfer();
        emit ReviewFunded(id, jobId, reviewer, msg.sender, completionHash, fee, startBy);
    }

    /// @notice Earned credit is irrevocable. Workers should confirm and collect it before spending.
    function activateReview(bytes32 id) external nonReentrant {
        Assignment storage a = assignments[id];
        if (a.state != 1) revert AssignmentNotFunded();
        if (msg.sender != a.reviewer) revert Unauthorized();
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp >= a.startBy) revert AssignmentExpired();
        if (_reviewable(a.jobId, a.completionHash, a.reviewer) != a.employer) revert InvalidAssignment();
        a.state = 2;
        credits[a.reviewer] += a.fee;
        emit ReviewActivated(id, a.reviewer, a.fee);
    }

    /// @notice Only unactivated assignments can be cancelled; anyone can release an expired one.
    function refundReview(bytes32 id) external nonReentrant {
        Assignment storage a = assignments[id];
        if (a.state != 1) revert AssignmentNotFunded();
        // solhint-disable-next-line not-rely-on-time
        if (msg.sender != a.employer && block.timestamp < a.startBy) revert Unauthorized();
        a.state = 3;
        credits[a.employer] += a.fee;
        emit ReviewRefunded(id, a.employer, a.fee);
    }

    /// @notice Anyone may trigger payment, but funds can only reach the recorded beneficiary.
    /// @dev A failed USDC transfer reverts the complete operation, preserving the credit.
    function withdrawCredit(address beneficiary) external nonReentrant {
        uint256 amount = credits[beneficiary];
        if (amount == 0) revert NoCredit();
        credits[beneficiary] = 0;
        totalLiability -= amount;
        usdcToken.safeTransfer(beneficiary, amount);
        emit CreditWithdrawn(beneficiary, amount);
    }
}
