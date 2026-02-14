// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MalformedReturnERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        assembly {
            mstore(0x00, 0x01)
            return(0x1f, 0x01)
        }
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance");
        allowance[from][msg.sender] = allowed - amount;
        _move(from, to, amount);
        assembly {
            mstore(0x00, 0x01)
            return(0x1f, 0x01)
        }
    }

    function _move(address from, address to, uint256 amount) private {
        uint256 bal = balanceOf[from];
        require(bal >= amount, "balance");
        unchecked {
            balanceOf[from] = bal - amount;
            balanceOf[to] += amount;
        }
    }
}
