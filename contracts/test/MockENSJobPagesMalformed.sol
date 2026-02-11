// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockENSJobPagesMalformed {
    bytes private tokenURIBytes;
    bool public revertOnHook;

    function setTokenURIBytes(bytes calldata data) external {
        tokenURIBytes = data;
    }

    function setRevertOnHook(bool shouldRevert) external {
        revertOnHook = shouldRevert;
    }

    function handleHook(uint8, uint256) external view {
        if (revertOnHook) revert();
    }

    function jobEnsURI(uint256) external view returns (string memory) {
        bytes memory data = tokenURIBytes;
        assembly {
            return(add(data, 32), mload(data))
        }
    }
}
