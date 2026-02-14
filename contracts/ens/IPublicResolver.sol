// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IPublicResolver {
    function addr(bytes32 node) external view returns (address);
    function setAuthorisation(bytes32 node, address target, bool isAuthorised) external;
    function setText(bytes32 node, string calldata key, string calldata value) external;
}
