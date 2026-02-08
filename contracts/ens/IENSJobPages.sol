// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IENSJobPages {
    function createJobPage(uint256 jobId, address employer, string calldata specURI) external;
    function handleHook(uint8 hook, uint256 jobId) external;
    function onAgentAssigned(uint256 jobId, address agent) external;
    function onCompletionRequested(uint256 jobId, string calldata completionURI) external;
    function revokePermissions(uint256 jobId, address employer, address agent) external;
    function lockJobENS(uint256 jobId, address employer, address agent, bool burnFuses) external;
    function lockJobENSFromManager(uint256 jobId, bool burnFuses) external;
    function jobEnsName(uint256 jobId) external view returns (string memory);
    function jobEnsURI(uint256 jobId) external view returns (string memory);
    function setUseEnsJobTokenURI(bool enabled) external;
}
