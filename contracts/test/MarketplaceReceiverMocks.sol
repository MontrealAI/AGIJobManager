// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

interface IAGIJobManagerMarketplace {
    function purchaseNFT(uint256 tokenId) external;
}

contract NonReceiverBuyer {
    function approveToken(address token, address spender, uint256 amount) external {
        IERC20(token).approve(spender, amount);
    }

    function purchase(address manager, uint256 tokenId) external {
        IAGIJobManagerMarketplace(manager).purchaseNFT(tokenId);
    }
}

contract ERC721ReceiverBuyer is IERC721Receiver {
    function approveToken(address token, address spender, uint256 amount) external {
        IERC20(token).approve(spender, amount);
    }

    function purchase(address manager, uint256 tokenId) external {
        IAGIJobManagerMarketplace(manager).purchaseNFT(tokenId);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
