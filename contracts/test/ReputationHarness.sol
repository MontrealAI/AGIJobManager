// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ReputationHarness {
    mapping(address => uint256) public reputation;

    event ReputationUpdated(address user, uint256 newReputation);

    function grantReputation(address user, uint256 points) external {
        uint256 current = reputation[user];
        uint256 updated;
        unchecked {
            updated = current + points;
        }
        if (updated < current || updated > 88888) {
            updated = 88888;
        }
        reputation[user] = updated;
        emit ReputationUpdated(user, updated);
    }
}
