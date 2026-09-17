// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./JobState.sol";
import "./BondMath.sol";
import "./TransferUtils.sol";

/// @notice Records one vote per wallet, membership credential and controller in a job.
library JobValidation {
    error NotAuthorized();
    error InvalidState();
    error ValidatorLimitReached();
    event JobValidated(uint256 indexed jobId, address indexed validator);
    event JobDisapproved(uint256 indexed jobId, address indexed validator);
    event JobDisputed(uint256 indexed jobId, address indexed disputant);
    event JobApprovalThresholdReached(uint256 indexed jobId, uint256 approvedAt);
    event ValidatorCredentialUsed(uint256 indexed jobId, address indexed voter, bytes32 indexed credential, address controller);

    /// @dev params: review, approval threshold, disapproval threshold, bond bps/min/max, paused seconds.
    function record(
        uint256 jobId, Job storage job, SettlementLedger storage ledger, address token,
        bool approve, bytes32 credential, address controller, uint256[7] memory params
    ) external {
        if (msg.sender == job.employer || msg.sender == job.assignedAgent || controller == job.employer || controller == job.assignedAgent) revert NotAuthorized();
        // Intentional elapsed-time deadline, adjusted for settlement pauses; not a randomness source.
        // forge-lint: disable-next-line(block-timestamp)
        if (!job.completionRequested || block.timestamp > job.completionRequestedAt + params[0] + params[6] - job.completionPause) revert InvalidState();
        if (job.approvals[msg.sender] || job.disapprovals[msg.sender]
            || job.usedValidatorCredentials[credential] || job.usedValidatorControllers[controller]) revert InvalidState();
        if (job.validators.length >= 50) revert ValidatorLimitReached();
        uint256 bond = job.validatorBondAmount;
        if (bond == 0) {
            bond = BondMath.computeValidatorBond(job.payout, params[3], params[4], params[5]);
            job.validatorBondAmount = bond + 1;
        } else {
            bond -= 1;
        }
        if (bond > 0) {
            TransferUtils.safeTransferFromExact(token, msg.sender, address(this), bond);
            ledger.validatorBonds += bond;
        }
        job.validators.push(msg.sender);
        job.usedValidatorCredentials[credential] = true;
        job.usedValidatorControllers[controller] = true;
        emit ValidatorCredentialUsed(jobId, msg.sender, credential, controller);
        if (approve) {
            job.validatorApprovals++;
            job.approvals[msg.sender] = true;
            emit JobValidated(jobId, msg.sender);
            if (!job.validatorApproved && params[1] > 0 && job.validatorApprovals >= params[1]) {
                job.validatorApproved = true;
                job.validatorApprovedAt = block.timestamp;
                job.approvalPause = params[6];
                emit JobApprovalThresholdReached(jobId, block.timestamp);
            }
        } else {
            job.validatorDisapprovals++;
            job.disapprovals[msg.sender] = true;
            emit JobDisapproved(jobId, msg.sender);
            if (params[2] > 0 && job.validatorDisapprovals >= params[2]) {
                job.disputed = true;
                job.disputedAt = block.timestamp;
                job.disputePause = params[6];
                emit JobDisputed(jobId, msg.sender);
            }
        }
    }
}
