// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ForceSendETH {
    constructor() payable {}

    function destroy(address payable target) external {
        selfdestruct(target);
    }
}
