// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-std/StdInvariant.sol";
import "forge-test/harness/AGIJobManagerHarness.sol";
import "contracts/test/MockERC20.sol";

contract AGIJobManagerHandler is Test {
    AGIJobManagerHarness public manager;
    MockERC20 public token;
    address public owner;
    address[] public employers;
    address[] public agents;
    uint256[] public trackedJobs;

    constructor(AGIJobManagerHarness _manager, MockERC20 _token, address _owner) {
        manager = _manager;
        token = _token;
        owner = _owner;
        employers.push(address(0x1001));
        employers.push(address(0x1002));
        agents.push(address(0x2001));
        agents.push(address(0x2002));

        for (uint256 i = 0; i < employers.length; i++) {
            token.mint(employers[i], 1_000_000 ether);
            vm.prank(employers[i]);
            token.approve(address(manager), type(uint256).max);
        }
        for (uint256 i = 0; i < agents.length; i++) {
            token.mint(agents[i], 1_000_000 ether);
            vm.prank(agents[i]);
            token.approve(address(manager), type(uint256).max);
            vm.prank(owner);
            manager.addAdditionalAgent(agents[i]);
        }
    }

    function createJob(uint256 who, uint256 payout, uint256 duration) external {
        address employer = employers[who % employers.length];
        payout = bound(payout, 1 ether, 100 ether);
        duration = bound(duration, 1 hours, 3 days);
        uint256 beforeId = manager.nextJobId();
        vm.prank(employer);
        try manager.createJob("ipfs://spec", payout, duration, "d") {
            trackedJobs.push(beforeId);
        } catch {}
    }

    function applyForJob(uint256 jobIdx, uint256 who) external {
        if (trackedJobs.length == 0) return;
        uint256 jobId = trackedJobs[jobIdx % trackedJobs.length];
        address agent = agents[who % agents.length];
        vm.prank(agent);
        try manager.applyForJob(jobId, "", new bytes32[](0)) {} catch {}
    }

    function requestCompletion(uint256 jobIdx, uint256 who) external {
        if (trackedJobs.length == 0) return;
        uint256 jobId = trackedJobs[jobIdx % trackedJobs.length];
        address agent = agents[who % agents.length];
        vm.prank(agent);
        try manager.requestJobCompletion(jobId, "ipfs://done") {} catch {}
    }

    function finalize(uint256 jobIdx) external {
        if (trackedJobs.length == 0) return;
        uint256 jobId = trackedJobs[jobIdx % trackedJobs.length];
        vm.warp(block.timestamp + 8 days);
        try manager.finalizeJob(jobId) {} catch {}
        try manager.expireJob(jobId) {} catch {}
    }

    function togglePause(bool pauseFlag) external {
        vm.prank(owner);
        if (pauseFlag) {
            try manager.pause() {} catch {}
        } else {
            try manager.unpause() {} catch {}
        }
    }
}

contract AGIJobManagerInvariants is StdInvariant, Test {
    AGIJobManagerHarness internal manager;
    MockERC20 internal token;
    AGIJobManagerHandler internal handler;

    function setUp() public {
        token = new MockERC20();
        address[2] memory ensConfig;
        bytes32[4] memory roots;
        bytes32[2] memory merkles;
        manager = new AGIJobManagerHarness(address(token), "ipfs://base", ensConfig, roots, merkles);
        token.mint(address(this), 1_000_000 ether);
        token.approve(address(manager), type(uint256).max);

        handler = new AGIJobManagerHandler(manager, token, address(this));
        targetContract(address(handler));
    }

    function invariant_lockedTotalsNeverExceedBalance() public {
        uint256 balance = token.balanceOf(address(manager));
        uint256 lockedTotal = manager.lockedEscrow() + manager.lockedAgentBonds() + manager.lockedValidatorBonds()
            + manager.lockedDisputeBonds();
        assertGe(balance, lockedTotal, "locked totals exceed AGI balance");
    }

    function invariant_terminalJobsReleaseEscrow() public {
        uint256 maxId = manager.nextJobId();
        for (uint256 i = 0; i < maxId; i++) {
            if (!manager.jobExists(i)) continue;
            (bool completed, bool disputed, bool expired,) = manager.jobFlags(i);
            assertFalse(completed && disputed, "completed/disputed overlap");
            assertFalse(completed && expired, "completed/expired overlap");
            assertFalse(expired && disputed, "expired/disputed overlap");
            if (completed || expired) {
                assertTrue(manager.jobEscrowReleased(i), "terminal job escrow not released");
            }
        }
    }
}
