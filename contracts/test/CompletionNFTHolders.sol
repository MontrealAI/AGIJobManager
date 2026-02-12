// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IAGIJobManagerCreateJob {
    function createJob(string memory _jobSpecURI, uint256 _payout, uint256 _duration, string memory _details) external;
}

interface IAGIJobManagerTokenURI {
    function tokenURI(uint256 tokenId) external view returns (string memory);
}

contract ERC721ReceiverEmployer is IERC721Receiver {
    IAGIJobManagerCreateJob public manager;
    IERC20 public token;
    uint256 public receivedCount;
    uint256 public lastTokenId;

    constructor(address managerAddress, address tokenAddress) {
        manager = IAGIJobManagerCreateJob(managerAddress);
        token = IERC20(tokenAddress);
    }

    function createJob(string memory spec, uint256 payout, uint256 duration, string memory details) external {
        token.approve(address(manager), payout);
        manager.createJob(spec, payout, duration, details);
    }

    function onERC721Received(address, address, uint256 tokenId, bytes calldata)
        external
        override
        returns (bytes4)
    {
        unchecked {
            receivedCount++;
        }
        lastTokenId = tokenId;
        return IERC721Receiver.onERC721Received.selector;
    }
}

contract TokenURIReadingReceiverEmployer is IERC721Receiver {
    IAGIJobManagerCreateJob public manager;
    IERC20 public token;
    string public observedTokenURI;

    constructor(address managerAddress, address tokenAddress) {
        manager = IAGIJobManagerCreateJob(managerAddress);
        token = IERC20(tokenAddress);
    }

    function createJob(string memory spec, uint256 payout, uint256 duration, string memory details) external {
        token.approve(address(manager), payout);
        manager.createJob(spec, payout, duration, details);
    }

    function onERC721Received(address operator, address, uint256 tokenId, bytes calldata)
        external
        override
        returns (bytes4)
    {
        observedTokenURI = IAGIJobManagerTokenURI(operator).tokenURI(tokenId);
        return IERC721Receiver.onERC721Received.selector;
    }
}

contract GasBurningReceiverEmployer is IERC721Receiver {
    IAGIJobManagerCreateJob public manager;
    IERC20 public token;

    constructor(address managerAddress, address tokenAddress) {
        manager = IAGIJobManagerCreateJob(managerAddress);
        token = IERC20(tokenAddress);
    }

    function createJob(string memory spec, uint256 payout, uint256 duration, string memory details) external {
        token.approve(address(manager), payout);
        manager.createJob(spec, payout, duration, details);
    }

    function onERC721Received(address, address, uint256, bytes calldata)
        external
        override
        returns (bytes4)
    {
        while (gasleft() > 1000) {}
        return IERC721Receiver.onERC721Received.selector;
    }
}

contract NonReceiverEmployer {
    IAGIJobManagerCreateJob public manager;
    IERC20 public token;

    constructor(address managerAddress, address tokenAddress) {
        manager = IAGIJobManagerCreateJob(managerAddress);
        token = IERC20(tokenAddress);
    }

    function createJob(string memory spec, uint256 payout, uint256 duration, string memory details) external {
        token.approve(address(manager), payout);
        manager.createJob(spec, payout, duration, details);
    }
}
