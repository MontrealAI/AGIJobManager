// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IENSJobPages {
    function onJobEvent(uint256 jobId, uint8 hookType) external;
    function lockJobENS(uint256 jobId, address employer, address agent, bool burnFuses) external;
    function jobEnsUri(uint256 jobId) external view returns (string memory);
}
