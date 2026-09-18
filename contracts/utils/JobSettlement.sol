// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./JobState.sol";
import "./ReputationMath.sol";
import "./TransferUtils.sol";

/// @notice Linked, immutable settlement accounting; invoked in the manager's storage context.
library JobSettlement {
    error InvalidState();
    event ReputationUpdated(address user, uint256 newReputation);
    event USDCDeferred(address indexed beneficiary, uint256 amount);
    event USDCClaimed(address indexed beneficiary, uint256 amount);
    event JobPayoutDistributed(uint256 indexed jobId, uint256 validatorBudget, uint256 wallet30Amount, uint256 wallet10Amount, uint256 agentAmount);

    uint256 private constant PAYOUT_GAS = 150_000;

    function pay(SettlementLedger storage ledger, address beneficiary, uint256 amount) external {
        _pay(ledger, beneficiary, amount);
    }

    function _pay(SettlementLedger storage ledger, address beneficiary, uint256 amount) private {
        if (amount == 0) return;
        ledger.pending[beneficiary] += amount;
        ledger.claims += amount;
        bytes memory payload = abi.encodeWithSignature("executeUSDCTransfer(address,uint256)", beneficiary, amount);
        bool success;
        // The self-call rolls back token side effects if a token returns false or malformed data.
        // Copy no returndata; a failing recipient has a fixed per-payment gas budget.
        // Reads only the allocated payload and writes no memory.
        assembly ("memory-safe") {
            success := call(PAYOUT_GAS, address(), 0, add(payload, 32), mload(payload), 0, 0)
        }
        if (success) {
            ledger.pending[beneficiary] -= amount;
            ledger.claims -= amount;
        } else {
            emit USDCDeferred(beneficiary, amount);
        }
    }

    function claim(SettlementLedger storage ledger, address token, address beneficiary) external {
        uint256 amount = ledger.pending[beneficiary];
        if (amount == 0) revert InvalidState();
        ledger.pending[beneficiary] = 0;
        ledger.claims -= amount;
        TransferUtils.safeTransfer(token, beneficiary, amount);
        emit USDCClaimed(beneficiary, amount);
    }

    function _finish(Job storage job, SettlementLedger storage ledger) private {
        if (job.completed || job.expired || job.escrowReleased) revert InvalidState();
        job.escrowReleased = true;
        job.disputed = false;
        ledger.escrow -= job.payout;
        ledger.activeJobs[job.assignedAgent]--;
    }

    function _reputation(SettlementLedger storage ledger, address account, uint256 points) private {
        uint256 current = ledger.reputation[account];
        uint256 updated;
        unchecked { updated = current + points; }
        if (updated < current || updated > 88888) updated = 88888;
        ledger.reputation[account] = updated;
        emit ReputationUpdated(account, updated);
    }

    function _agentBond(Job storage job, SettlementLedger storage ledger) private returns (uint256 amount) {
        amount = job.agentBondAmount;
        job.agentBondAmount = 0;
        ledger.agentBonds -= amount;
    }

    function _disputeBond(Job storage job, SettlementLedger storage ledger, address recipient) private {
        uint256 amount = job.disputeBondAmount;
        job.disputeBondAmount = 0;
        job.disputeInitiator = address(0);
        ledger.disputeBonds -= amount;
        _pay(ledger, recipient, amount);
    }

    function _validators(
        Job storage job, SettlementLedger storage ledger, bool agentWins,
        uint256 points, uint256 reward, uint256 slashBps
    ) private returns (uint256) {
        uint256 count = job.validators.length;
        if (count == 0) return reward;
        uint256 bond = job.validatorBondAmount - 1;
        job.validatorBondAmount = 0;
        ledger.validatorBonds -= bond * count;
        uint256 correctCount = agentWins ? job.validatorApprovals : job.validatorDisapprovals;
        uint256 slash = bond * slashBps / 10_000;
        uint256 pool = reward + slash * (count - correctCount);
        uint256 each = correctCount == 0 ? 0 : pool / correctCount;
        uint256 gain = points * job.validatorRewardPctSnapshot / 100;
        // Commit all reputation effects before interacting with the token.
        for (uint256 i; i < count; ++i) {
            address voter = job.validators[i];
            if (gain > 0 && (agentWins ? job.approvals[voter] : job.disapprovals[voter])) {
                _reputation(ledger, voter, gain);
            }
        }
        for (uint256 i; i < count; ++i) {
            address voter = job.validators[i];
            bool correct = agentWins ? job.approvals[voter] : job.disapprovals[voter];
            _pay(ledger, voter, correct ? bond + each : bond - slash);
        }
        return pool - each * correctCount;
    }

    function complete(
        uint256 jobId, Job storage job, SettlementLedger storage ledger,
        address recipient30, address recipient10, bool repEligible, uint256 slashBps
    ) external returns (uint256 points) {
        _finish(job, ledger);
        job.completed = true;
        uint256 budget = job.validators.length == 0 ? 0 : job.payout * job.validatorRewardPctSnapshot / 100;
        uint256 amount30 = job.payout * 30 / 100;
        uint256 amount10 = job.payout * 10 / 100;
        uint256 agentAmount = job.payout - budget - amount30 - amount10;
        points = ReputationMath.computeReputationPoints(
            job.payout, job.duration, job.completionRequestedAt - job.completionPause,
            job.assignedAt - job.assignmentPause, repEligible
        );
        _reputation(ledger, job.assignedAgent, points);
        // Buyer acceptance waives further review; it must not punish dissenting reviewers.
        agentAmount += _validators(job, ledger, true, points, budget, repEligible ? slashBps : 0);
        _pay(ledger, recipient30, amount30);
        _pay(ledger, recipient10, amount10);
        _pay(ledger, job.assignedAgent, agentAmount);
        _pay(ledger, job.assignedAgent, _agentBond(job, ledger));
        _disputeBond(job, ledger, job.assignedAgent);
        emit JobPayoutDistributed(jobId, budget, amount30, amount10, agentAmount);
    }

    /// @notice An employer win never spends buyer escrow on validation or wallet fees.
    function refund(Job storage job, SettlementLedger storage ledger, uint256 slashBps) external {
        _finish(job, ledger);
        job.completed = true;
        uint256 bond = _agentBond(job, ledger);
        uint256 budget = job.validatorDisapprovals == 0 ? 0 : job.payout * job.validatorRewardPctSnapshot / 100;
        if (budget > bond) budget = bond;
        uint256 points = ReputationMath.computeReputationPoints(
            job.payout, job.duration, job.completionRequestedAt - job.completionPause,
            job.assignedAt - job.assignmentPause, true
        );
        uint256 remainder = _validators(job, ledger, false, points, budget, slashBps);
        _pay(ledger, job.employer, job.payout + bond - budget + remainder);
        _disputeBond(job, ledger, job.employer);
    }

    /// @notice Unanswered arbitration returns escrow and every bond without judging work quality.
    function unresolved(Job storage job, SettlementLedger storage ledger) external {
        _finish(job, ledger);
        job.expired = true;
        uint256 count = job.validators.length;
        uint256 bond = count == 0 ? 0 : job.validatorBondAmount - 1;
        job.validatorBondAmount = 0;
        ledger.validatorBonds -= count * bond;
        for (uint256 i; i < count; ++i) _pay(ledger, job.validators[i], bond);
        _pay(ledger, job.assignedAgent, _agentBond(job, ledger));
        _disputeBond(job, ledger, job.disputeInitiator);
        _pay(ledger, job.employer, job.payout);
    }
}
