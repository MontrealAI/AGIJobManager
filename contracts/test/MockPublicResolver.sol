// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockPublicResolver {
    mapping(bytes32 => mapping(address => bool)) private authorisations;
    mapping(bytes32 => mapping(string => string)) private texts;

    function setAuthorisation(bytes32 node, address target, bool isAuthorised) external {
        authorisations[node][target] = isAuthorised;
    }

    function isAuthorised(bytes32 node, address target) external view returns (bool) {
        return authorisations[node][target];
    }

    function setText(bytes32 node, string calldata key, string calldata value) external {
        texts[node][key] = value;
    }

    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return texts[node][key];
    }
}
