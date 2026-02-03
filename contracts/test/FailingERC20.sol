// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FailingERC20 is ERC20 {
    bool public failTransfers;
    bool public failTransferFroms;

    constructor() ERC20("Failing ERC20", "FAILX") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setFailTransfers(bool value) external {
        failTransfers = value;
    }

    function setFailTransferFroms(bool value) external {
        failTransferFroms = value;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (failTransfers) {
            return false;
        }
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (failTransferFroms) {
            return false;
        }
        return super.transferFrom(from, to, amount);
    }
}
