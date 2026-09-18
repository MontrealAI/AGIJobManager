// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

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
    bool agentNftRequired;
    uint256 validatorApprovedAt;
    uint256 validatorBondAmount;
    uint256 agentBondAmount;
    uint256 assignmentPause;
    uint256 completionPause;
    uint256 approvalPause;
    uint256 disputePause;
    mapping(bytes32 => bool) usedValidatorCredentials;
    mapping(address => bool) usedValidatorControllers;
}

struct SettlementLedger {
    uint256 escrow;
    uint256 agentBonds;
    uint256 validatorBonds;
    uint256 disputeBonds;
    uint256 claims;
    mapping(address => uint256) pending;
    mapping(address => uint256) reputation;
    mapping(address => uint256) activeJobs;
}
