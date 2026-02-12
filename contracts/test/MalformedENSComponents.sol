// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MalformedENSRegistry {
    address public resolverAddress;

    function setResolverAddress(address value) external {
        resolverAddress = value;
    }

    function resolver(bytes32) external view returns (address) {
        return resolverAddress;
    }

    function owner(bytes32) external pure returns (address) {
        assembly {
            mstore(0x0, 0x1234)
            return(0x1e, 0x02)
        }
    }
}

contract MalformedNameWrapper {
    function ownerOf(uint256) external pure returns (address) {
        assembly {
            mstore(0x0, 0x1234)
            return(0x1e, 0x02)
        }
    }
}

contract MalformedResolver {
    function addr(bytes32) external pure returns (address payable) {
        assembly {
            mstore(0x0, 0x1234)
            return(0x1e, 0x02)
        }
    }
}

contract MalformedApprovalNameWrapper {
    address public owner;

    function setOwner(address value) external {
        owner = value;
    }

    function ownerOf(uint256) external view returns (address) {
        return owner;
    }

    function getApproved(uint256) external pure returns (address) {
        return address(0);
    }

    function isApprovedForAll(address, address) external pure returns (bool) {
        assembly {
            mstore(0x0, 2)
            return(0x0, 0x20)
        }
    }
}
