// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-test/harness/AGIJobManagerHarness.sol";
import "contracts/test/MockERC20.sol";

contract AGIJobManagerTimingFuzz is Test {
    MockERC20 internal token;
    AGIJobManagerHarness internal manager;
    address internal employer = address(0xABCD1);

    function setUp() public {
        token = new MockERC20();
        address[2] memory ensConfig;
        bytes32[4] memory roots;
        bytes32[2] memory merkles;
        manager = new AGIJobManagerHarness(address(token), "ipfs://base", ensConfig, roots, merkles);

        token.mint(employer, 1_000_000 ether);
        vm.prank(employer);
        token.approve(address(manager), type(uint256).max);
    }

    function testFuzz_expiryBoundary(uint256 dt) public {
        uint256 jobId = manager.nextJobId();
        vm.prank(employer);
        manager.createJob("ipfs://spec", 10 ether, 1 days, "d");

        dt = bound(dt, 1 days - 1, 1 days + 1);
        vm.warp(block.timestamp + dt);
        if (dt <= 1 days) {
            vm.expectRevert();
            manager.expireJob(jobId);
        } else {
            try manager.expireJob(jobId) {} catch {}
        }
    }
}
