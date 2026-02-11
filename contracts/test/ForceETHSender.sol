// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ForceETHSender {
    constructor() payable {}

    function forceSend(address payable to) external {
        selfdestruct(to);
    }
}
