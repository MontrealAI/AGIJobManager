// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract GasGriefENSRegistry {
    function resolver(bytes32) external pure returns (address) {
        while (true) {}
        return address(0);
    }
}

contract GasGriefNameWrapper {
    function ownerOf(uint256) external pure returns (address) {
        while (true) {}
        return address(0);
    }
}

contract GasGriefResolver {
    function addr(bytes32) external pure returns (address payable) {
        while (true) {}
        return payable(address(0));
    }
}
