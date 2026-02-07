// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IPublicResolver {
    function setAuthorisation(bytes32 node, address target, bool isAuthorised) external;
    function setText(bytes32 node, string calldata key, string calldata value) external;
}
