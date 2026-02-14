// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract InvalidBoolNameWrapper {
    address public ownerValue;
    address public approvedValue;

    function setOwnerValue(address value) external {
        ownerValue = value;
    }

    function setApprovedValue(address value) external {
        approvedValue = value;
    }

    function ownerOf(uint256) external view returns (address) {
        return ownerValue;
    }

    function getApproved(uint256) external view returns (address) {
        return approvedValue;
    }

    function isApprovedForAll(address, address) external pure returns (bool) {
        assembly {
            mstore(0x00, 2)
            return(0x00, 0x20)
        }
    }
}
