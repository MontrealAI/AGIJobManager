// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockNameWrapperReverting {
    bool public revertSetChildFuses;
    uint256 public setChildFusesCalls;

    function setRevertSetChildFuses(bool enabled) external {
        revertSetChildFuses = enabled;
    }

    function ownerOf(uint256) external pure returns (address) {
        return address(0);
    }

    function isApprovedForAll(address, address) external pure returns (bool) {
        return false;
    }

    function isWrapped(bytes32) external pure returns (bool) {
        return true;
    }

    function burnFuses(bytes32, uint32 fuses) external pure returns (uint32) {
        return fuses;
    }

    function setChildFuses(bytes32, bytes32, uint32, uint64) external {
        if (revertSetChildFuses) revert("setChildFuses failed");
        setChildFusesCalls += 1;
    }

    function setSubnodeRecord(
        bytes32 parentNode,
        string calldata label,
        address,
        address,
        uint64,
        uint32,
        uint64
    ) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(parentNode, keccak256(bytes(label))));
    }
}
