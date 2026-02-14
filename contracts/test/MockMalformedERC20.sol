// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockMalformedERC20 {
    enum Mode {
        True32,
        False32,
        NoReturn,
        RevertAlways,
        OneByte,
        TwoWords,
        GarbageBool
    }

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    Mode public transferMode;
    Mode public transferFromMode;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function setTransferMode(Mode mode) external {
        transferMode = mode;
    }

    function setTransferFromMode(Mode mode) external {
        transferFromMode = mode;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return _returnByMode(transferMode);
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance");
        unchecked {
            allowance[from][msg.sender] = allowed - amount;
        }
        _move(from, to, amount);
        return _returnByMode(transferFromMode);
    }

    function _move(address from, address to, uint256 amount) private {
        uint256 fromBal = balanceOf[from];
        require(fromBal >= amount, "balance");
        unchecked {
            balanceOf[from] = fromBal - amount;
            balanceOf[to] += amount;
        }
    }

    function _returnByMode(Mode mode) private pure returns (bool ok) {
        if (mode == Mode.True32) {
            return true;
        }
        if (mode == Mode.False32) {
            return false;
        }
        if (mode == Mode.NoReturn) {
            assembly {
                return(0, 0)
            }
        }
        if (mode == Mode.RevertAlways) {
            revert("forced");
        }
        if (mode == Mode.OneByte) {
            assembly {
                mstore(0x00, 0x01)
                return(0x1f, 0x01)
            }
        }
        if (mode == Mode.TwoWords) {
            assembly {
                mstore(0x00, 0x01)
                mstore(0x20, 0x02)
                return(0x00, 0x40)
            }
        }
        assembly {
            mstore(0x00, 0x02)
            return(0x00, 0x20)
        }
    }
}
