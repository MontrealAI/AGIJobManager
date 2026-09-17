// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "contracts/test/MockERC20.sol";

/// @dev Models issuer pause/blocklist failure semantics, not Circle's implementation.
contract AdversarialUSDC is MockERC20 {
    mapping(address => bool) public blocked;
    bool public transfersPaused;

    function setBlocked(address account, bool value) external {
        blocked[account] = value;
    }

    function setTransfersPaused(bool value) external {
        transfersPaused = value;
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        require(!transfersPaused && !blocked[from] && !blocked[to], "issuer transfer restriction");
        super._beforeTokenTransfer(from, to, amount);
    }
}
