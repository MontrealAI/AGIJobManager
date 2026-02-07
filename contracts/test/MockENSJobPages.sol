// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/Strings.sol";
import "../ens/IAGIJobManagerView.sol";

contract MockENSJobPages {
    using Strings for uint256;

    uint8 private constant HOOK_CREATE = 1;
    uint8 private constant HOOK_ASSIGNED = 2;
    uint8 private constant HOOK_TERMINAL = 3;

    bool public shouldRevert;
    uint256 public createCalls;
    uint256 public agentCalls;
    uint256 public completionCalls;
    uint256 public revokeCalls;
    uint256 public lockCalls;

    uint256 public lastJobId;
    address public lastEmployer;
    address public lastAgent;
    string public lastSpecURI;
    string public lastCompletionURI;
    bool public lastBurnFuses;

    function setShouldRevert(bool value) external {
        shouldRevert = value;
    }

    function createJobPage(uint256 jobId, address employer) public {
        if (shouldRevert) revert("fail");
        createCalls++;
        lastJobId = jobId;
        lastEmployer = employer;
        lastSpecURI = IAGIJobManagerView(msg.sender).getJobSpecURI(jobId);
    }

    function onAgentAssigned(uint256 jobId, address agent) public {
        if (shouldRevert) revert("fail");
        agentCalls++;
        lastJobId = jobId;
        lastAgent = agent;
    }

    function onCompletionRequested(uint256 jobId) public {
        if (shouldRevert) revert("fail");
        completionCalls++;
        lastJobId = jobId;
        lastCompletionURI = IAGIJobManagerView(msg.sender).getJobCompletionURI(jobId);
    }

    function onJobEvent(uint256 jobId, uint8 hookType) external {
        if (shouldRevert) revert("fail");
        (
            address employer,
            address assignedAgent,
            uint256 payout,
            uint256 duration,
            uint256 assignedAt,
            bool completed,
            bool disputed,
            bool expired,
            uint8 agentPayoutPct
        ) = IAGIJobManagerView(msg.sender).getJobCore(jobId);
        payout;
        duration;
        assignedAt;
        completed;
        disputed;
        expired;
        agentPayoutPct;

        if (hookType == HOOK_CREATE) {
            createJobPage(jobId, employer);
        } else if (hookType == HOOK_ASSIGNED) {
            onAgentAssigned(jobId, assignedAgent);
        } else if (hookType == HOOK_TERMINAL) {
            revokePermissions(jobId, employer, assignedAgent);
        } else {
            revert("bad hook");
        }
    }

    function revokePermissions(uint256 jobId, address employer, address agent) public {
        if (shouldRevert) revert("fail");
        revokeCalls++;
        lastJobId = jobId;
        lastEmployer = employer;
        lastAgent = agent;
    }

    function lockJobENS(uint256 jobId, address employer, address agent, bool burnFuses) external {
        if (shouldRevert) revert("fail");
        lockCalls++;
        lastJobId = jobId;
        lastEmployer = employer;
        lastAgent = agent;
        lastBurnFuses = burnFuses;
    }

    function jobEnsUri(uint256 jobId) external pure returns (string memory) {
        return string(abi.encodePacked("ens://job-", jobId.toString(), ".alpha.jobs.agi.eth"));
    }
}
