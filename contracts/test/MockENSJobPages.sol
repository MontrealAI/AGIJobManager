// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/Strings.sol";

contract MockENSJobPages {
    using Strings for uint256;

    uint8 public constant HOOK_CREATE = 1;
    uint8 public constant HOOK_ASSIGN = 2;
    uint8 public constant HOOK_COMPLETION = 3;
    uint8 public constant HOOK_REVOKE = 4;
    uint8 public constant HOOK_LOCK = 5;

    mapping(uint8 => bool) public revertHook;

    uint256 public createCalls;
    uint256 public assignCalls;
    uint256 public completionCalls;
    uint256 public revokeCalls;
    uint256 public lockCalls;

    uint256 public lastJobId;
    address public lastEmployer;
    address public lastAgent;
    string public lastSpecURI;
    string public lastCompletionURI;
    bool public lastBurnFuses;
    bool public useEnsJobTokenURI;

    function setRevertHook(uint8 hook, bool shouldRevert) external {
        revertHook[hook] = shouldRevert;
    }

    function setUseEnsJobTokenURI(bool enabled) external {
        useEnsJobTokenURI = enabled;
    }

    function createJobPage(uint256 jobId, address employer, string calldata specURI) external {
        if (revertHook[HOOK_CREATE]) revert("revert create");
        createCalls += 1;
        lastJobId = jobId;
        lastEmployer = employer;
        lastSpecURI = specURI;
    }

    function handleHook(uint8 hook, uint256 jobId) external {
        if (revertHook[hook]) revert("revert hook");
        if (hook == HOOK_CREATE) {
            createCalls += 1;
            lastJobId = jobId;
            lastEmployer = address(0);
            lastSpecURI = "";
            return;
        }
        if (hook == HOOK_ASSIGN) {
            assignCalls += 1;
            lastJobId = jobId;
            lastAgent = address(0);
            return;
        }
        if (hook == HOOK_COMPLETION) {
            completionCalls += 1;
            lastJobId = jobId;
            lastCompletionURI = "";
            return;
        }
        if (hook == HOOK_REVOKE) {
            revokeCalls += 1;
            lastJobId = jobId;
            lastEmployer = address(0);
            lastAgent = address(0);
            return;
        }
        if (hook == HOOK_LOCK) {
            lockCalls += 1;
            lastJobId = jobId;
            lastEmployer = address(0);
            lastAgent = address(0);
            lastBurnFuses = false;
            return;
        }
    }

    function onAgentAssigned(uint256 jobId, address agent) external {
        if (revertHook[HOOK_ASSIGN]) revert("revert assign");
        assignCalls += 1;
        lastJobId = jobId;
        lastAgent = agent;
    }

    function onCompletionRequested(uint256 jobId, string calldata completionURI) external {
        if (revertHook[HOOK_COMPLETION]) revert("revert completion");
        completionCalls += 1;
        lastJobId = jobId;
        lastCompletionURI = completionURI;
    }

    function revokePermissions(uint256 jobId, address employer, address agent) external {
        if (revertHook[HOOK_REVOKE]) revert("revert revoke");
        revokeCalls += 1;
        lastJobId = jobId;
        lastEmployer = employer;
        lastAgent = agent;
    }

    function lockJobENS(uint256 jobId, address employer, address agent, bool burnFuses) external {
        if (revertHook[HOOK_LOCK]) revert("revert lock");
        lockCalls += 1;
        lastJobId = jobId;
        lastEmployer = employer;
        lastAgent = agent;
        lastBurnFuses = burnFuses;
    }

    function lockJobENSFromManager(uint256 jobId, bool burnFuses) external {
        if (revertHook[HOOK_LOCK]) revert("revert lock");
        lockCalls += 1;
        lastJobId = jobId;
        lastEmployer = address(0);
        lastAgent = address(0);
        lastBurnFuses = burnFuses;
    }

    function jobEnsName(uint256 jobId) external pure returns (string memory) {
        return string(abi.encodePacked("job-", jobId.toString(), ".alpha.jobs.agi.eth"));
    }

    function jobEnsURI(uint256 jobId) external view returns (string memory) {
        if (!useEnsJobTokenURI) return "";
        return string(abi.encodePacked("ens://job-", jobId.toString(), ".alpha.jobs.agi.eth"));
    }

}
