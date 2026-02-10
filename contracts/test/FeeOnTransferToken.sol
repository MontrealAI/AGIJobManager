// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FeeOnTransferToken is ERC20 {
    uint256 public feeBps;

    constructor(uint256 initialSupply, uint256 _feeBps) ERC20("FeeOnTransferToken", "FEE") {
        feeBps = _feeBps;
        _mint(msg.sender, initialSupply);
    }

    function _transfer(address from, address to, uint256 amount) internal virtual override {
        uint256 fee = (amount * feeBps) / 10000;
        uint256 received = amount - fee;
        super._transfer(from, to, received);
        if (fee != 0) {
            _burn(from, fee);
        }
    }
}
