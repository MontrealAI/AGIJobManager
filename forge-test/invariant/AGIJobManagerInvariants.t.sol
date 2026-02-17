// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-std/StdInvariant.sol";
import "forge-test/harness/AGIJobManagerHarness.sol";
import "contracts/test/MockERC20.sol";
import "contracts/test/MockERC721.sol";

contract AGIJobManagerHandler is Test {
    AGIJobManagerHarness public manager;
    MockERC20 public token;

    address[] public employers;
    address[] public agents;
    address[] public validators;
    address public moderator;
    uint256 public maxJobs = 16;

    MockERC721 public agiType;

    constructor(AGIJobManagerHarness _manager, MockERC20 _token) {
        manager = _manager;
        token = _token;

        for (uint256 i = 0; i < 3; i++) {
            employers.push(address(uint160(0x100 + i)));
            agents.push(address(uint160(0x200 + i)));
            validators.push(address(uint160(0x300 + i)));
        }
        moderator = address(0x404);

        for (uint256 i = 0; i < employers.length; i++) {
            token.mint(employers[i], 1_000_000 ether);
            vm.prank(employers[i]);
            token.approve(address(manager), type(uint256).max);
        }

        for (uint256 i = 0; i < agents.length; i++) {
            token.mint(agents[i], 1_000_000 ether);
            vm.prank(agents[i]);
            token.approve(address(manager), type(uint256).max);
        }

        for (uint256 i = 0; i < validators.length; i++) {
            token.mint(validators[i], 1_000_000 ether);
            vm.prank(validators[i]);
            token.approve(address(manager), type(uint256).max);
        }

        token.mint(moderator, 1_000_000 ether);
        vm.prank(moderator);
        token.approve(address(manager), type(uint256).max);

        agiType = new MockERC721();
        vm.startPrank(manager.owner());
        manager.addAGIType(address(agiType), 60);

        for (uint256 i = 0; i < agents.length; i++) {
            agiType.mint(agents[i]);
            manager.addAdditionalAgent(agents[i]);
        }
        for (uint256 i = 0; i < validators.length; i++) {
            manager.addAdditionalValidator(validators[i]);
        }

        manager.addModerator(moderator);
        manager.setSettlementPaused(false);
        manager.unpauseAll();
        manager.setRequiredValidatorApprovals(1);
        manager.setRequiredValidatorDisapprovals(1);
        manager.setVoteQuorum(1);
        vm.stopPrank();
    }

    function _warp(uint256 deltaSeed, uint256 maxDelta) internal {
        vm.warp(block.timestamp + bound(deltaSeed, 0, maxDelta));
    }

    function createJob(uint256 employerSeed, uint256 payoutSeed, uint256 durationSeed) external {
        if (manager.nextJobId() >= maxJobs) return;
        address employer = employers[bound(employerSeed, 0, employers.length - 1)];
        uint256 payout = bound(payoutSeed, 1 ether, 100 ether);
        uint256 duration = bound(durationSeed, 1 hours, 7 days);
        vm.prank(employer);
        try manager.createJob("ipfs://spec", payout, duration, "d") {} catch {}
    }

    function applyForJob(uint256 jobSeed, uint256 agentSeed) external {
        if (manager.nextJobId() == 0) return;
        uint256 jobId = bound(jobSeed, 0, manager.nextJobId() - 1);
        address agent = agents[bound(agentSeed, 0, agents.length - 1)];
        vm.prank(agent);
        try manager.applyForJob(jobId, "", new bytes32[](0)) {} catch {}
    }

    function requestCompletion(uint256 jobSeed, uint256 agentSeed) external {
        if (manager.nextJobId() == 0) return;
        uint256 jobId = bound(jobSeed, 0, manager.nextJobId() - 1);
        address agent = agents[bound(agentSeed, 0, agents.length - 1)];
        vm.prank(agent);
        try manager.requestJobCompletion(jobId, "ipfs://done") {} catch {}
    }

    function validateOrDisapprove(uint256 jobSeed, uint256 validatorSeed, bool approveVote) external {
        if (manager.nextJobId() == 0) return;
        uint256 jobId = bound(jobSeed, 0, manager.nextJobId() - 1);
        address validator = validators[bound(validatorSeed, 0, validators.length - 1)];
        vm.prank(validator);
        if (approveVote) {
            try manager.validateJob(jobId, "", new bytes32[](0)) {} catch {}
        } else {
            try manager.disapproveJob(jobId, "", new bytes32[](0)) {} catch {}
        }
    }

    function finalizeJob(uint256 jobSeed, uint256 warpSeed) external {
        if (manager.nextJobId() == 0) return;
        _warp(warpSeed, 14 days);
        uint256 jobId = bound(jobSeed, 0, manager.nextJobId() - 1);
        try manager.finalizeJob(jobId) {} catch {}
    }

    function dispute(uint256 jobSeed, bool byEmployer) external {
        if (manager.nextJobId() == 0) return;
        uint256 jobId = bound(jobSeed, 0, manager.nextJobId() - 1);
        address actor = byEmployer ? manager.jobEmployer(jobId) : manager.jobAssignedAgent(jobId);
        if (actor == address(0)) return;
        vm.prank(actor);
        try manager.disputeJob(jobId) {} catch {}
    }

    function resolveDispute(uint256 jobSeed, uint8 code) external {
        if (manager.nextJobId() == 0) return;
        uint256 jobId = bound(jobSeed, 0, manager.nextJobId() - 1);
        vm.prank(moderator);
        try manager.resolveDisputeWithCode(jobId, uint8(bound(code, 1, 4)), "handler") {} catch {}
    }

    function resolveStaleDispute(uint256 jobSeed, uint256 warpSeed, bool employerWins) external {
        if (manager.nextJobId() == 0) return;
        _warp(warpSeed, 30 days);
        uint256 jobId = bound(jobSeed, 0, manager.nextJobId() - 1);
        vm.prank(manager.owner());
        try manager.resolveStaleDispute(jobId, employerWins) {} catch {}
    }

    function expireJob(uint256 jobSeed, uint256 warpSeed) external {
        if (manager.nextJobId() == 0) return;
        _warp(warpSeed, 30 days);
        uint256 jobId = bound(jobSeed, 0, manager.nextJobId() - 1);
        try manager.expireJob(jobId) {} catch {}
    }

    function cancelJob(uint256 jobSeed, uint256 employerSeed) external {
        if (manager.nextJobId() == 0) return;
        uint256 jobId = bound(jobSeed, 0, manager.nextJobId() - 1);
        address employer = employers[bound(employerSeed, 0, employers.length - 1)];
        vm.prank(employer);
        try manager.cancelJob(jobId) {} catch {}
    }

    function delistJob(uint256 jobSeed) external {
        if (manager.nextJobId() == 0) return;
        uint256 jobId = bound(jobSeed, 0, manager.nextJobId() - 1);
        vm.prank(manager.owner());
        try manager.delistJob(jobId) {} catch {}
    }

    function togglePauses(bool settlePaused, bool globalPaused) external {
        vm.startPrank(manager.owner());
        manager.setSettlementPaused(settlePaused);
        if (globalPaused) manager.pause();
        else manager.unpause();
        vm.stopPrank();
    }

    function withdrawAGI(uint256 amountSeed) external {
        vm.startPrank(manager.owner());
        manager.pauseAll();
        manager.setSettlementPaused(false);
        uint256 max = manager.withdrawableAGI();
        if (max == 0) {
            vm.stopPrank();
            return;
        }
        uint256 amount = bound(amountSeed, 1, max);
        try manager.withdrawAGI(amount) {} catch {}
        vm.stopPrank();
    }

    function rescueERC20(uint256 amountSeed) external {
        MockERC20 rescue = new MockERC20();
        rescue.mint(address(manager), 10 ether);
        uint256 amount = bound(amountSeed, 1, 10 ether);
        vm.prank(manager.owner());
        try manager.rescueERC20(address(rescue), address(this), amount) {} catch {}
    }

    function trackedAgents() external view returns (address[] memory) {
        return agents;
    }
}

contract AGIJobManagerInvariants is StdInvariant, Test {
    AGIJobManagerHarness internal manager;
    MockERC20 internal token;
    AGIJobManagerHandler internal handler;

    function setUp() external {
        token = new MockERC20();
        address[2] memory ensConfig = [address(0), address(0)];
        bytes32[4] memory rootNodes;
        bytes32[2] memory merkleRoots;
        manager = new AGIJobManagerHarness(address(token), "", ensConfig, rootNodes, merkleRoots);
        handler = new AGIJobManagerHandler(manager, token);
        targetContract(address(handler));
    }

    function invariant_solvencyAndWithdrawableNeverReverts() external view {
        uint256 lockedTotal = manager.lockedEscrow() + manager.lockedAgentBonds() + manager.lockedValidatorBonds()
            + manager.lockedDisputeBonds();
        assertGe(token.balanceOf(address(manager)), lockedTotal);
        manager.withdrawableAGI();
    }

    function invariant_lockedTotalsConsistency() external view {
        uint256 expectedEscrow;
        uint256 expectedAgentBonds;
        uint256 expectedValidatorBonds;
        uint256 expectedDisputeBonds;

        for (uint256 jobId = 0; jobId < manager.nextJobId(); jobId++) {
            if (!manager.jobExists(jobId)) continue;

            if (!manager.jobEscrowReleased(jobId)) {
                expectedEscrow += manager.jobPayout(jobId);
            }
            expectedAgentBonds += manager.jobAgentBondAmount(jobId);
            expectedDisputeBonds += manager.jobDisputeBondAmount(jobId);

            uint256 validatorsLength = manager.jobValidatorsLength(jobId);
            uint256 rawBond = manager.jobValidatorBondAmount(jobId);
            uint256 approvals;
            uint256 disapprovals;
            (, approvals, disapprovals,,) = manager.getJobValidation(jobId);
            assertEq(validatorsLength, approvals + disapprovals);

            if (validatorsLength > 0) {
                uint256 perVote = rawBond == 0 ? 0 : rawBond - 1;
                expectedValidatorBonds += perVote * validatorsLength;
            }

            (bool completed, bool disputed, bool expired,) = manager.jobFlags(jobId);
            assertFalse(completed && expired);
            assertFalse(completed && disputed);
        }

        assertEq(manager.lockedEscrow(), expectedEscrow);
        assertEq(manager.lockedAgentBonds(), expectedAgentBonds);
        assertEq(manager.lockedValidatorBonds(), expectedValidatorBonds);
        assertEq(manager.lockedDisputeBonds(), expectedDisputeBonds);
    }

    function invariant_agentActiveJobsBounded() external view {
        address[] memory tracked = handler.trackedAgents();
        uint256 maxActive = manager.maxActiveJobsPerAgentView();
        for (uint256 i = 0; i < tracked.length; i++) {
            assertLe(manager.activeJobsByAgentView(tracked[i]), maxActive);
        }
    }
}
