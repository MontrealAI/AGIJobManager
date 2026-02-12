// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MalformedApprovalNameWrapper {
    address public ownerValue;

    function setOwnerValue(address value) external {
        ownerValue = value;
    }

    function ownerOf(uint256) external view returns (address) {
        return ownerValue;
    }

    function getApproved(uint256) external pure returns (address) {
        return address(0);
    }

    function isApprovedForAll(address, address) external pure returns (bool) {
        assembly {
            mstore(0x0, 2)
            return(0x0, 32)
        }
    }
}

contract GasBurnerENS {
    fallback() external payable {
        while (gasleft() > 0) {
            // solhint-disable-previous-line no-empty-blocks
        }
    }
}
