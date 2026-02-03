// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockNameWrapper {
    mapping(uint256 => address) private owners;

    function setOwner(uint256 id, address owner) external {
        owners[id] = owner;
    }

    function ownerOf(uint256 id) external view returns (address) {
        return owners[id];
    }
}
