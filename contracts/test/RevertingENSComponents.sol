// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract RevertingENSRegistry {
    bool public revertOwner;
    bool public revertResolver;
    address public resolverAddress;

    function setRevertOwner(bool value) external {
        revertOwner = value;
    }

    function setRevertResolver(bool value) external {
        revertResolver = value;
    }

    function setResolverAddress(address value) external {
        resolverAddress = value;
    }

    function owner(bytes32) external view returns (address) {
        if (revertOwner) revert();
        return address(0);
    }

    function resolver(bytes32) external view returns (address) {
        if (revertResolver) revert();
        return resolverAddress;
    }
}

contract RevertingNameWrapper {
    bool public revertOwnerOf;

    function setRevertOwnerOf(bool value) external {
        revertOwnerOf = value;
    }

    function ownerOf(uint256) external view returns (address) {
        if (revertOwnerOf) revert();
        return address(0);
    }

    function isApprovedForAll(address, address) external pure returns (bool) {
        revert();
    }
}

contract RevertingResolver {
    bool public revertAddr;
    address public resolved;

    function setRevertAddr(bool value) external {
        revertAddr = value;
    }

    function setResolved(address value) external {
        resolved = value;
    }

    function addr(bytes32) external view returns (address payable) {
        if (revertAddr) revert();
        return payable(resolved);
    }
}
