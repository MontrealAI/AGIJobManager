// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IAGIJobManager {
    function purchaseNFT(uint256 tokenId) external;
}

contract ReentrantERC20 is ERC20 {
    address public manager;
    uint256 public reenterTokenId;
    bool public reenterEnabled;
    bool public reenterAttempted;

    constructor() ERC20("Reentrant AGI", "rAGI") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setReentry(address _manager, uint256 _tokenId, bool _enabled) external {
        manager = _manager;
        reenterTokenId = _tokenId;
        reenterEnabled = _enabled;
        reenterAttempted = false;
    }

    function approveManager(uint256 amount) external {
        require(manager != address(0), "manager not set");
        _approve(address(this), manager, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (reenterEnabled && !reenterAttempted && manager != address(0)) {
            reenterAttempted = true;
            IAGIJobManager(manager).purchaseNFT(reenterTokenId);
        }
        return super.transferFrom(from, to, amount);
    }
}
