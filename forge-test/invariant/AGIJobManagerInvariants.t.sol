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
    MockERC20 public rescueToken;

    address[] public employers;
    address[] public agents;
    address[] public validators;
    address[] public moderators;

    uint256 public constant MAX_JOBS = 24;

    function agentsLength() external view returns (uint256) {
        return agents.length;
    }

    constructor(AGIJobManagerHarness _manager, MockERC20 _token) {
        manager = _manager;
        token = _token;
        rescueToken = new MockERC20();

        for (uint256 i = 0; i < 4; i++) {
            employers.push(address(uint160(0x100 + i)));
            agents.push(address(uint160(0x200 + i)));
            validators.push(address(uint160(0x300 + i)));
            moderators.push(address(uint160(0x400 + i)));
        }

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

        vm.startPrank(manager.owner());
        MockERC721 agiType = new MockERC721();
        manager.addAGIType(address(agiType), 60);
        for (uint256 i = 0; i < agents.length; i++) {
            agiType.mint(agents[i]);
            manager.addAdditionalAgent(agents[i]);
        }
        for (uint256 i = 0; i < validators.length; i++) {
            manager.addAdditionalValidator(validators[i]);
        }
        for (uint256 i = 0; i < moderators.length; i++) {
            manager.addModerator(moderators[i]);
        }
        manager.setRequiredValidatorApprovals(1);
        manager.setRequiredValidatorDisapprovals(1);
        manager.setSettlementPaused(false);
        vm.stopPrank();

        rescueToken.mint(address(manager), 10_000 ether);
    }

    function createJob(uint256 employerSeed, uint256 payoutSeed, uint256 durationSeed) external {
        if (manager.nextJobId() >= MAX_JOBS) return;
        address employer = employers[bound(employerSeed, 0, employers.length - 1)];
        uint256 payout = bound(payoutSeed, 1 ether, 200 ether);
        uint256 duration = bound(durationSeed, 1 hours, 30 days);
        vm.prank(employer);
        try manager.createJob("ipfs://spec", payout, duration, "") {} catch {}
    }

    function applyForJob(uint256 jobSeed, uint256 agentSeed) external {
        if (manager.nextJobId() == 0) return;
        uint256 jobId = bound(jobSeed, 0, manager.nextJobId() - 1);
        address agent = agents[bound(agentSeed, 0, agents.length - 1)];
        vm.prank(agent);
        try manager.applyForJob(jobId, "", new bytes32[](0)) {} catch {}
    }

    function requestJobCompletion(uint256 jobSeed, uint256 agentSeed) external {
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

    function finalizeJob(uint256 jobSeed, uint256 warpDelta) external {
        if (manager.nextJobId() == 0) return;
        vm.warp(block.timestamp + bound(warpDelta, 0, 14 days));
        uint256 jobId = bound(jobSeed, 0, manager.nextJobId() - 1);
        try manager.finalizeJob(jobId) {} catch {}
    }

    function disputeJob(uint256 jobSeed, bool employerSide) external {
        if (manager.nextJobId() == 0) return;
        uint256 jobId = bound(jobSeed, 0, manager.nextJobId() - 1);
        address actor = employerSide ? manager.jobEmployer(jobId) : manager.jobAssignedAgent(jobId);
        if (actor == address(0)) return;
        vm.prank(actor);
        try manager.disputeJob(jobId) {} catch {}
    }

    function resolveDisputeWithCode(uint256 jobSeed, uint256 moderatorSeed, uint8 code) external {
        if (manager.nextJobId() == 0) return;
        uint256 jobId = bound(jobSeed, 0, manager.nextJobId() - 1);
        address moderator = moderators[bound(moderatorSeed, 0, moderators.length - 1)];
        vm.prank(moderator);
        try manager.resolveDisputeWithCode(jobId, uint8(bound(code, 0, 2)), "handler") {} catch {}
    }

    function resolveStaleDispute(uint256 jobSeed, uint256 warpDelta, bool employerWins) external {
        if (manager.nextJobId() == 0) return;
        vm.warp(block.timestamp + bound(warpDelta, 0, 30 days));
        uint256 jobId = bound(jobSeed, 0, manager.nextJobId() - 1);
        vm.prank(manager.owner());
        try manager.resolveStaleDispute(jobId, employerWins) {} catch {}
    }

    function expireJob(uint256 jobSeed, uint256 warpDelta) external {
        if (manager.nextJobId() == 0) return;
        vm.warp(block.timestamp + bound(warpDelta, 0, 30 days));
        uint256 jobId = bound(jobSeed, 0, manager.nextJobId() - 1);
        try manager.expireJob(jobId) {} catch {}
    }

    function cancelJob(uint256 jobSeed) external {
        if (manager.nextJobId() == 0) return;
        uint256 jobId = bound(jobSeed, 0, manager.nextJobId() - 1);
        address employer = manager.jobEmployer(jobId);
        if (employer == address(0)) return;
        vm.prank(employer);
        try manager.cancelJob(jobId) {} catch {}
    }

    function delistJob(uint256 jobSeed) external {
        if (manager.nextJobId() == 0) return;
        uint256 jobId = bound(jobSeed, 0, manager.nextJobId() - 1);
        vm.prank(manager.owner());
        try manager.delistJob(jobId) {} catch {}
    }

    function setPauseState(bool pauseAllState) external {
        vm.startPrank(manager.owner());
        if (pauseAllState) {
            try manager.pauseAll() {} catch {}
            try manager.unpauseAll() {} catch {}
        } else {
            try manager.pause() {} catch {}
            try manager.unpause() {} catch {}
        }
        vm.stopPrank();
    }

    function setSettlementPaused(bool pausedState) external {
        vm.prank(manager.owner());
        try manager.setSettlementPaused(pausedState) {} catch {}
    }

    function withdrawAGI(uint256 amountSeed) external {
        vm.startPrank(manager.owner());
        try manager.pause() {} catch {}
        try manager.setSettlementPaused(false) {} catch {}
        uint256 available;
        try manager.withdrawableAGI() returns (uint256 v) {
            available = v;
        } catch {
            vm.stopPrank();
            return;
        }
        if (available == 0) {
            vm.stopPrank();
            return;
        }
        uint256 amount = bound(amountSeed, 1, available);
        try manager.withdrawAGI(amount) {} catch {}
        try manager.unpause() {} catch {}
        vm.stopPrank();
    }

    function rescueNonAgiToken(uint256 amountSeed) external {
        uint256 bal = rescueToken.balanceOf(address(manager));
        if (bal == 0) return;
        vm.prank(manager.owner());
        try manager.rescueERC20(address(rescueToken), manager.owner(), bound(amountSeed, 1, bal)) {} catch {}
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

    function invariant_lockedAccountingMatchesPerJobSums() external view {
        uint256 expectedEscrow;
        uint256 expectedAgentBonds;
        uint256 expectedValidatorBonds;
        uint256 expectedDisputeBonds;

        for (uint256 jobId = 0; jobId < manager.nextJobId(); jobId++) {
            if (!manager.jobExists(jobId)) continue;

            if (!manager.jobEscrowReleased(jobId)) expectedEscrow += manager.jobPayout(jobId);
            expectedAgentBonds += manager.jobAgentBondAmount(jobId);
            expectedDisputeBonds += manager.jobDisputeBondAmount(jobId);

            uint256 rawBond = manager.jobValidatorBondAmount(jobId);
            uint256 validatorsLength = manager.jobValidatorsLength(jobId);
            uint256 perValidatorBond = rawBond == 0 ? 0 : rawBond - 1;
            expectedValidatorBonds += perValidatorBond * validatorsLength;
        }

        assertEq(manager.lockedEscrow(), expectedEscrow);
        assertEq(manager.lockedAgentBonds(), expectedAgentBonds);
        assertEq(manager.lockedValidatorBonds(), expectedValidatorBonds);
        assertEq(manager.lockedDisputeBonds(), expectedDisputeBonds);
    }

    function invariant_voteAccountingAndTerminalStateSanity() external view {
        for (uint256 jobId = 0; jobId < manager.nextJobId(); jobId++) {
            if (!manager.jobExists(jobId)) {
                continue;
            }
            (uint256 approvals, uint256 disapprovals) = manager.jobVoteCounts(jobId);
            assertEq(manager.jobValidatorsLength(jobId), approvals + disapprovals);

            (bool completed, bool disputed, bool expired,) = manager.jobFlags(jobId);
            assertFalse(completed && expired);
            assertFalse(completed && disputed);
            assertFalse(expired && disputed);
        }
    }

    function invariant_activeJobCapAndNoNegativeSettlementArtifacts() external view {
        uint256 count = handler.agentsLength();
        for (uint256 i = 0; i < count; i++) {
            address trackedAgent = handler.agents(i);
            assertLe(manager.activeJobsByAgentView(trackedAgent), manager.maxActiveJobsPerAgentView());
        }

        assertGe(manager.lockedEscrow(), 0);
        assertGe(manager.lockedAgentBonds(), 0);
        assertGe(manager.lockedValidatorBonds(), 0);
        assertGe(manager.lockedDisputeBonds(), 0);
    }
}
