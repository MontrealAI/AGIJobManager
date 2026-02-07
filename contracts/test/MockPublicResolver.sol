// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockPublicResolver {
    mapping(bytes32 => mapping(address => bool)) private authorisations;
    mapping(bytes32 => mapping(bytes32 => string)) private textRecords;

    event AuthorisationUpdated(bytes32 indexed node, address indexed target, bool allowed);
    event TextRecordUpdated(bytes32 indexed node, string key, string value);

    function setAuthorisation(bytes32 node, address target, bool isAuthorized) external {
        authorisations[node][target] = isAuthorized;
        emit AuthorisationUpdated(node, target, isAuthorized);
    }

    function isAuthorised(bytes32 node, address target) external view returns (bool) {
        return authorisations[node][target];
    }

    function setText(bytes32 node, string calldata key, string calldata value) external {
        textRecords[node][keccak256(bytes(key))] = value;
        emit TextRecordUpdated(node, key, value);
    }

    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return textRecords[node][keccak256(bytes(key))];
    }
}
