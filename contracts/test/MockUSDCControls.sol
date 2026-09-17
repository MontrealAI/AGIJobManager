// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Local fixture for Circle-style transfer restrictions, not a production USDC implementation.
contract MockUSDCControls is ERC20 {
    bool public paused;
    mapping(address => bool) public blocked;

    constructor() ERC20("Mock USDC", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address account, uint256 amount) external { _mint(account, amount); }
    function setPaused(bool value) external { paused = value; }
    function setBlocked(address account, bool value) external { blocked[account] = value; }
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        require(!paused && !blocked[from] && !blocked[to], "USDC transfer restricted");
        super._beforeTokenTransfer(from, to, amount);
    }
}

contract MockWrongDecimals is ERC20 {
    constructor() ERC20("Wrong decimal fixture", "TEST") {}
}
