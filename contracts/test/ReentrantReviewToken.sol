// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ReentrantReviewToken is ERC20 {
    address public target;
    bytes public callback;
    bool public attempted;
    bool public succeeded;
    bytes public returned;
    bool private entering;

    constructor() ERC20("Review callback fixture", "RCF") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function configure(address recipient, bytes calldata data) external {
        target = recipient;
        callback = data;
        attempted = false;
        succeeded = false;
    }
    function probe() external {
        (succeeded, returned) = target.call(callback);
    }
    function _afterTokenTransfer(address from, address to, uint256 amount) internal override {
        super._afterTokenTransfer(from, to, amount);
        if (from == address(0) || target == address(0) || entering) return;
        entering = true;
        attempted = true;
        (succeeded, returned) = target.call(callback);
        entering = false;
    }
}
