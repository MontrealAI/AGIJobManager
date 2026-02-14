// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract RevertingBalanceOfERC20 {
    mapping(address => uint256) public balance;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balance[to] += amount;
    }

    function balanceOf(address) external pure returns (uint256) {
        revert();
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        uint256 bal = balance[msg.sender];
        require(bal >= amount, "bal");
        unchecked {
            balance[msg.sender] = bal - amount;
            balance[to] += amount;
        }
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance");
        allowance[from][msg.sender] = allowed - amount;

        uint256 bal = balance[from];
        require(bal >= amount, "bal");
        unchecked {
            balance[from] = bal - amount;
            balance[to] += amount;
        }
        return true;
    }
}
