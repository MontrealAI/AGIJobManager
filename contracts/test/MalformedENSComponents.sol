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
