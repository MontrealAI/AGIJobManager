// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockERC721 is ERC721 {
    uint256 private nextTokenId = 1;

    constructor() ERC721("Mock AGIType", "MAGI") {}

    function mint(address to) external returns (uint256) {
        uint256 tokenId = nextTokenId++;
        _mint(to, tokenId);
        return tokenId;
    }
}
