// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @dev Test-only owner/employer that attempts wallet rotation from the completion NFT callback.
contract OwnerRotationReceiver {
    address public immutable manager;
    address public immutable recipient30;
    address public immutable recipient10;
    bool public attempted;
    bool public succeeded;

    constructor(address manager_, address recipient30_, address recipient10_) {
        manager = manager_;
        recipient30 = recipient30_;
        recipient10 = recipient10_;
    }

    function execute(address target, bytes calldata data) external {
        (bool ok, ) = target.call(data);
        require(ok, "test execution failed");
    }

    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        attempted = true;
        (succeeded, ) = manager.call(abi.encodeWithSignature("setSettlementWallets(address,address)", recipient30, recipient10));
        return this.onERC721Received.selector;
    }
}
