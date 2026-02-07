// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockPublicResolver {
    mapping(bytes32 => mapping(address => bool)) private authorisations;
    mapping(bytes32 => mapping(string => string)) private texts;

    event AuthorisationUpdated(bytes32 indexed node, address indexed target, bool isAuthorised);
    event TextUpdated(bytes32 indexed node, string indexed key, string value);

    function setAuthorisation(bytes32 node, address target, bool isAuthorised) external {
        authorisations[node][target] = isAuthorised;
        emit AuthorisationUpdated(node, target, isAuthorised);
    }

    function setText(bytes32 node, string calldata key, string calldata value) external {
        texts[node][key] = value;
        emit TextUpdated(node, key, value);
    }

    function authorisation(bytes32 node, address target) external view returns (bool) {
        return authorisations[node][target];
    }

    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return texts[node][key];
    }
}
