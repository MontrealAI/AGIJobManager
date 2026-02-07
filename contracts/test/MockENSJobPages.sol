// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/Strings.sol";

contract MockENSJobPages {
    using Strings for uint256;

    uint8 private constant HOOK_CREATE = 1;
    uint8 private constant HOOK_ASSIGN = 2;
    uint8 private constant HOOK_REVOKE = 3;
    uint8 private constant HOOK_LOCK = 4;

    bool public shouldRevert;
    uint8 public lastHook;
    uint256 public lastJobId;
    address public lastEmployer;
    address public lastAgent;
    string public lastSpecURI;
    string public lastCompletionURI;
    bool public lastBurnFuses;

    function setShouldRevert(bool value) external {
        shouldRevert = value;
    }


    function createJobPage(uint256 jobId, address employer, string calldata specURI) external {
        _maybeRevert();
        lastJobId = jobId;
        lastEmployer = employer;
        lastSpecURI = specURI;
    }

    function onAgentAssigned(uint256 jobId, address agent) external {
        _maybeRevert();
        lastJobId = jobId;
        lastAgent = agent;
    }

    function onCompletionRequested(uint256 jobId, string calldata completionURI) external {
        _maybeRevert();
        lastJobId = jobId;
        lastCompletionURI = completionURI;
    }

    function revokePermissions(uint256 jobId, address employer, address agent) external {
        _maybeRevert();
        lastJobId = jobId;
        lastEmployer = employer;
        lastAgent = agent;
    }

    function lockJobENS(uint256 jobId, address employer, address agent, bool burnFuses) external {
        _maybeRevert();
        lastJobId = jobId;
        lastEmployer = employer;
        lastAgent = agent;
        lastBurnFuses = burnFuses;
    }

    function jobEnsName(uint256 jobId) external pure returns (string memory) {
        return string(abi.encodePacked("job-", jobId.toString(), ".alpha.jobs.agi.eth"));
    }

    function jobEnsURI(uint256 jobId) external pure returns (string memory) {
        return string(abi.encodePacked("ens://job-", jobId.toString(), ".alpha.jobs.agi.eth"));
    }

    function handleHook(
        uint8 hook,
        uint256 jobId,
        address employer,
        address agent,
        bool burnFuses
    ) external {
        _maybeRevert();
        lastJobId = jobId;
        lastHook = hook;
        if (hook == HOOK_CREATE) {
            lastEmployer = employer;
        } else if (hook == HOOK_ASSIGN) {
            lastAgent = agent;
        } else if (hook == HOOK_REVOKE) {
            lastEmployer = employer;
            lastAgent = agent;
        } else if (hook == HOOK_LOCK) {
            lastEmployer = employer;
            lastAgent = agent;
            lastBurnFuses = burnFuses;
        }
    }

    function _maybeRevert() internal view {
        if (shouldRevert) {
            revert("MockENSJobPages: revert");
        }
    }
}
