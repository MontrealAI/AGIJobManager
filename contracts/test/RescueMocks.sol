// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ForceSendETH {
    constructor() payable {}

    function boom(address payable target) external {
        bytes memory init = new bytes(22);
        init[0] = 0x73;
        bytes20 targetBytes = bytes20(address(target));
        for (uint256 i = 0; i < 20; ) {
            init[1 + i] = targetBytes[i];
            unchecked {
                ++i;
            }
        }
        init[21] = 0xff;

        address deployed;
        uint256 value = address(this).balance;
        assembly {
            deployed := create(value, add(init, 32), 22)
        }
        require(deployed != address(0), "deploy");
    }
}

contract MockRescueERC20 {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        uint256 fromBalance = balanceOf[msg.sender];
        require(fromBalance >= amount, "bal");
        unchecked {
            balanceOf[msg.sender] = fromBalance - amount;
            balanceOf[to] += amount;
        }
        return true;
    }
}

contract MockRescueERC721 {
    mapping(uint256 => address) public ownerOf;

    function mint(address to, uint256 tokenId) external {
        ownerOf[tokenId] = to;
    }

    function transferFrom(address from, address to, uint256 tokenId) external {
        require(ownerOf[tokenId] == from, "owner");
        ownerOf[tokenId] = to;
    }
}

contract MockRescueERC1155 {
    mapping(address => mapping(uint256 => uint256)) public balanceOf;

    function mint(address to, uint256 id, uint256 amount) external {
        balanceOf[to][id] += amount;
    }

    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata) external {
        uint256 fromBalance = balanceOf[from][id];
        require(fromBalance >= amount, "bal");
        unchecked {
            balanceOf[from][id] = fromBalance - amount;
            balanceOf[to][id] += amount;
        }
    }
}


contract MockRescueERC20False {
    function transfer(address, uint256) external pure returns (bool) {
        return false;
    }
}

contract MockRescueMalformedReturn {
    function transfer(address, uint256) external pure returns (bytes4) {
        return 0x12345678;
    }
}
