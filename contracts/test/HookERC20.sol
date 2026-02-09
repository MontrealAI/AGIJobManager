// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract HookERC20 is ERC20 {
    constructor() ERC20("Hook AGI", "hAGI") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _afterTokenTransfer(address from, address to, uint256 amount) internal override {
        super._afterTokenTransfer(from, to, amount);
        if (from == address(0) || to == address(0) || to.code.length == 0) {
            return;
        }
        (bool ok, ) = to.call(abi.encodeWithSignature("onTokenTransfer(address,uint256)", from, amount));
        ok;
    }
}
