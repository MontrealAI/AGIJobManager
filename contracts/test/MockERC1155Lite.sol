// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockERC1155Lite {
    mapping(address => mapping(uint256 => uint256)) public balances;

    function mint(address to, uint256 id, uint256 amount) external {
        balances[to][id] += amount;
    }

    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata) external {
        uint256 bal = balances[from][id];
        require(bal >= amount, "insufficient");
        unchecked {
            balances[from][id] = bal - amount;
        }
        balances[to][id] += amount;
    }

    function balanceOf(address account, uint256 id) external view returns (uint256) {
        return balances[account][id];
    }
}
