// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockENSJobPages {
    bool public revertOnCreate;
    bool public revertOnAssign;
    bool public revertOnCompletion;
    bool public revertOnRevoke;
    bool public revertOnLock;

    uint256 public lastJobId;
    address public lastEmployer;
    address public lastAgent;
    string public lastSpecURI;
    string public lastCompletionURI;
    bool public lastBurnFuses;

    string public ensNameOverride;

    uint8 private constant HOOK_CREATE = 1;
    uint8 private constant HOOK_ASSIGN = 2;
    uint8 private constant HOOK_COMPLETION = 3;
    uint8 private constant HOOK_REVOKE = 4;

    function setReverts(
        bool onCreate,
        bool onAssign,
        bool onCompletion,
        bool onRevoke,
        bool onLock
    ) external {
        revertOnCreate = onCreate;
        revertOnAssign = onAssign;
        revertOnCompletion = onCompletion;
        revertOnRevoke = onRevoke;
        revertOnLock = onLock;
    }

    function setEnsNameOverride(string calldata name) external {
        ensNameOverride = name;
    }


    function hook(uint8 action, uint256 jobId) external {
        if (action == HOOK_CREATE && revertOnCreate) revert("create");
        if (action == HOOK_ASSIGN && revertOnAssign) revert("assign");
        if (action == HOOK_COMPLETION && revertOnCompletion) revert("completion");
        if (action == HOOK_REVOKE && revertOnRevoke) revert("revoke");
        lastJobId = jobId;
    }

    function createJobPage(uint256 jobId, address employer, string calldata specURI) external {
        if (revertOnCreate) revert("create");
        lastJobId = jobId;
        lastEmployer = employer;
        lastSpecURI = specURI;
    }

    function createJobPage(uint256 jobId, address employer) external {
        if (revertOnCreate) revert("create");
        lastJobId = jobId;
        lastEmployer = employer;
        lastSpecURI = "";
    }

    function createJobPage(uint256 jobId) external {
        if (revertOnCreate) revert("create");
        lastJobId = jobId;
        lastEmployer = address(0);
        lastSpecURI = "";
    }

    function onAgentAssigned(uint256 jobId, address agent) external {
        if (revertOnAssign) revert("assign");
        lastJobId = jobId;
        lastAgent = agent;
    }

    function onCompletionRequested(uint256 jobId, string calldata completionURI) external {
        if (revertOnCompletion) revert("completion");
        lastJobId = jobId;
        lastCompletionURI = completionURI;
    }

    function onCompletionRequested(uint256 jobId) external {
        if (revertOnCompletion) revert("completion");
        lastJobId = jobId;
        lastCompletionURI = "";
    }

    function revokePermissions(uint256 jobId, address employer, address agent) external {
        if (revertOnRevoke) revert("revoke");
        lastJobId = jobId;
        lastEmployer = employer;
        lastAgent = agent;
    }

    function revokePermissions(uint256 jobId) external {
        if (revertOnRevoke) revert("revoke");
        lastJobId = jobId;
        lastEmployer = address(0);
        lastAgent = address(0);
    }

    function lockJobENS(uint256 jobId, address employer, address agent, bool burnFuses) external {
        if (revertOnLock) revert("lock");
        lastJobId = jobId;
        lastEmployer = employer;
        lastAgent = agent;
        lastBurnFuses = burnFuses;
    }

    function lockJobENS(uint256 jobId, bool burnFuses) external {
        if (revertOnLock) revert("lock");
        lastJobId = jobId;
        lastEmployer = address(0);
        lastAgent = address(0);
        lastBurnFuses = burnFuses;
    }

    function jobEnsName(uint256 jobId) external view returns (string memory) {
        if (bytes(ensNameOverride).length != 0) {
            return ensNameOverride;
        }
        return string(abi.encodePacked("job-", _toString(jobId), ".alpha.jobs.agi.eth"));
    }

    function jobEnsURI(uint256 jobId) external view returns (string memory) {
        if (bytes(ensNameOverride).length != 0) {
            return string(abi.encodePacked("ens://", ensNameOverride));
        }
        return string(abi.encodePacked("ens://job-", _toString(jobId), ".alpha.jobs.agi.eth"));
    }

    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
