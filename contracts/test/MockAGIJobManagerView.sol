// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockAGIJobManagerView {
    struct JobCore {
        address employer;
        address assignedAgent;
        uint256 payout;
        uint256 duration;
        uint256 assignedAt;
        bool completed;
        bool disputed;
        bool expired;
        uint8 agentPayoutPct;
    }

    mapping(uint256 => JobCore) private _core;
    mapping(uint256 => string) private _spec;
    mapping(uint256 => string) private _completion;

    function setJob(uint256 jobId, address employer, address assignedAgent, string calldata specURI) external {
        _core[jobId].employer = employer;
        _core[jobId].assignedAgent = assignedAgent;
        _spec[jobId] = specURI;
    }

    function setCompletionURI(uint256 jobId, string calldata completionURI) external {
        _completion[jobId] = completionURI;
    }

    function setJobTerminalState(uint256 jobId, bool completed, bool disputed, bool expired) external {
        _core[jobId].completed = completed;
        _core[jobId].disputed = disputed;
        _core[jobId].expired = expired;
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
        JobCore memory core = _core[jobId];
        return (
            core.employer,
            core.assignedAgent,
            core.payout,
            core.duration,
            core.assignedAt,
            core.completed,
            core.disputed,
            core.expired,
            core.agentPayoutPct
        );
    }

    function getJobSpecURI(uint256 jobId) external view returns (string memory) {
        return _spec[jobId];
    }

    function getJobCompletionURI(uint256 jobId) external view returns (string memory) {
        return _completion[jobId];
    }
}
