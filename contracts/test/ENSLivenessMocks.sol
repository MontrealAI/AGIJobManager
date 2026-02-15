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

contract RevertingGetApprovedNameWrapper {
    mapping(uint256 => address) private owners;
    mapping(address => mapping(address => bool)) private approvals;

    function setOwner(uint256 id, address owner) external {
        owners[id] = owner;
    }

    function ownerOf(uint256 id) external view returns (address) {
        return owners[id];
    }

    function setApprovalForAll(address operator, bool approved) external {
        approvals[msg.sender][operator] = approved;
    }

    function isApprovedForAll(address owner, address operator) external view returns (bool) {
        return approvals[owner][operator];
    }

    function getApproved(uint256) external pure returns (address) {
        revert("getApproved-disabled");
    }

    function setSubnodeRecord(
        bytes32 parentNode,
        string calldata label,
        address ownerAddr,
        address,
        uint64,
        uint32,
        uint64
    ) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(parentNode, keccak256(bytes(label)), ownerAddr));
    }

    function setChildFuses(bytes32, bytes32, uint32, uint64) external pure {}
}
