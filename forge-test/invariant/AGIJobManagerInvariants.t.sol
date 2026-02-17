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

    address public owner;
    address public moderator = address(0xD00D);
    address[] public employers;
    address[] public agents;
    address[] public validators;

    uint256 public constant MAX_TRACKED_JOBS = 24;

    constructor(AGIJobManagerHarness _manager, MockERC20 _token, address _owner) {
        manager = _manager;
        token = _token;
        owner = _owner;

        for (uint256 i = 0; i < 4; i++) {
            employers.push(address(uint160(0x100 + i)));
            agents.push(address(uint160(0x200 + i)));
            validators.push(address(uint160(0x300 + i)));
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

        token.mint(owner, 1_000_000 ether);
        vm.prank(owner);
        token.approve(address(manager), type(uint256).max);

        MockERC721 agiType = new MockERC721();
        vm.startPrank(owner);
        manager.addModerator(moderator);
        manager.addAGIType(address(agiType), 70);
        for (uint256 i = 0; i < agents.length; i++) {
            manager.addAdditionalAgent(agents[i]);
            agiType.mint(agents[i]);
        }
        for (uint256 i = 0; i < validators.length; i++) {
            manager.addAdditionalValidator(validators[i]);
        }
        manager.setSettlementPaused(false);
        manager.setRequiredValidatorApprovals(1);
        manager.setRequiredValidatorDisapprovals(1);
        manager.setVoteQuorum(1);
        vm.stopPrank();
    }

    function _boundedJobId(uint256 seed) internal view returns (uint256 jobId, bool ok) {
        uint256 n = manager.nextJobId();
        if (n == 0) return (0, false);
        uint256 limit = n > MAX_TRACKED_JOBS ? MAX_TRACKED_JOBS : n;
        return (bound(seed, 0, limit - 1), true);
    }

    function createJob(uint256 employerSeed, uint256 payoutSeed, uint256 durationSeed) external {
        if (manager.nextJobId() >= MAX_TRACKED_JOBS) return;
        address employer = employers[bound(employerSeed, 0, employers.length - 1)];
        uint256 payout = bound(payoutSeed, 1 ether, 1000 ether);
        uint256 duration = bound(durationSeed, 1 hours, 30 days);
        vm.prank(employer);
        try manager.createJob("ipfs://spec", payout, duration, "details") {} catch {}
    }

    function applyForJob(uint256 jobSeed, uint256 agentSeed) external {
        (uint256 jobId, bool ok) = _boundedJobId(jobSeed);
        if (!ok) return;
        address agent = agents[bound(agentSeed, 0, agents.length - 1)];
        vm.prank(agent);
        try manager.applyForJob(jobId, "", new bytes32[](0)) {} catch {}
    }

    function requestJobCompletion(uint256 jobSeed, uint256 agentSeed) external {
        (uint256 jobId, bool ok) = _boundedJobId(jobSeed);
        if (!ok) return;
        address agent = agents[bound(agentSeed, 0, agents.length - 1)];
        vm.prank(agent);
        try manager.requestJobCompletion(jobId, "ipfs://done") {} catch {}
    }

    function validateJob(uint256 jobSeed, uint256 validatorSeed) external {
        (uint256 jobId, bool ok) = _boundedJobId(jobSeed);
        if (!ok) return;
        address validator = validators[bound(validatorSeed, 0, validators.length - 1)];
        vm.prank(validator);
        try manager.validateJob(jobId, "", new bytes32[](0)) {} catch {}
    }

    function disapproveJob(uint256 jobSeed, uint256 validatorSeed) external {
        (uint256 jobId, bool ok) = _boundedJobId(jobSeed);
        if (!ok) return;
        address validator = validators[bound(validatorSeed, 0, validators.length - 1)];
        vm.prank(validator);
        try manager.disapproveJob(jobId, "", new bytes32[](0)) {} catch {}
    }

    function finalizeJob(uint256 jobSeed, uint256 warpDelta) external {
        (uint256 jobId, bool ok) = _boundedJobId(jobSeed);
        if (!ok) return;
        vm.warp(block.timestamp + bound(warpDelta, 0, 20 days));
        try manager.finalizeJob(jobId) {} catch {}
    }

    function disputeJob(uint256 jobSeed, bool byEmployer) external {
        (uint256 jobId, bool ok) = _boundedJobId(jobSeed);
        if (!ok) return;
        address actor = byEmployer ? manager.jobEmployer(jobId) : manager.jobAssignedAgent(jobId);
        if (actor == address(0)) return;
        vm.prank(actor);
        try manager.disputeJob(jobId) {} catch {}
    }

    function resolveDisputeWithCode(uint256 jobSeed, uint8 codeSeed) external {
        (uint256 jobId, bool ok) = _boundedJobId(jobSeed);
        if (!ok) return;
        uint8 code = uint8(bound(codeSeed, 0, 2));
        vm.prank(moderator);
        try manager.resolveDisputeWithCode(jobId, code, "handler") {} catch {}
    }

    function resolveStaleDispute(uint256 jobSeed, uint256 warpDelta, bool employerWins) external {
        (uint256 jobId, bool ok) = _boundedJobId(jobSeed);
        if (!ok) return;
        vm.warp(block.timestamp + bound(warpDelta, 0, 30 days));
        vm.prank(owner);
        try manager.resolveStaleDispute(jobId, employerWins) {} catch {}
    }

    function expireJob(uint256 jobSeed, uint256 warpDelta) external {
        (uint256 jobId, bool ok) = _boundedJobId(jobSeed);
        if (!ok) return;
        vm.warp(block.timestamp + bound(warpDelta, 0, 40 days));
        try manager.expireJob(jobId) {} catch {}
    }

    function cancelJob(uint256 jobSeed) external {
        (uint256 jobId, bool ok) = _boundedJobId(jobSeed);
        if (!ok) return;
        address employer = manager.jobEmployer(jobId);
        if (employer == address(0)) return;
        vm.prank(employer);
        try manager.cancelJob(jobId) {} catch {}
    }

    function delistJob(uint256 jobSeed) external {
        (uint256 jobId, bool ok) = _boundedJobId(jobSeed);
        if (!ok) return;
        vm.prank(owner);
        try manager.delistJob(jobId) {} catch {}
    }

    function setPauseFlags(bool paused, bool settlementPaused_) external {
        vm.startPrank(owner);
        if (paused) {
            try manager.pauseAll() {} catch {}
        } else {
            try manager.unpauseAll() {} catch {}
        }
        try manager.setSettlementPaused(settlementPaused_) {} catch {}
        vm.stopPrank();
    }

    function withdrawAGI(uint256 amountSeed) external {
        vm.startPrank(owner);
        try manager.unpauseAll() {} catch {}
        try manager.pauseAll() {} catch {}
        try manager.setSettlementPaused(false) {} catch {}
        uint256 available;
        try manager.withdrawableAGI() returns (uint256 w) {
            available = w;
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
        vm.stopPrank();
    }

    function rescueERC20(uint256 amountSeed) external {
        MockERC20 other = new MockERC20();
        other.mint(address(manager), 1000 ether);
        uint256 amount = bound(amountSeed, 1, 1000 ether);
        vm.prank(owner);
        try manager.rescueERC20(address(other), owner, amount) {} catch {}
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
        handler = new AGIJobManagerHandler(manager, token, address(this));
        targetContract(address(handler));
    }

    function invariant_solvencyAndWithdrawable() external view {
        uint256 lockedTotal = manager.lockedEscrow() + manager.lockedAgentBonds() + manager.lockedValidatorBonds()
            + manager.lockedDisputeBonds();
        assertGe(token.balanceOf(address(manager)), lockedTotal);
        manager.withdrawableAGI();
    }

    function invariant_lockedAccountingMatchesJobs() external view {
        uint256 expectedEscrow;
        uint256 expectedAgentBonds;
        uint256 expectedValidatorBonds;
        uint256 expectedDisputeBonds;

        uint256 maxJobs = manager.nextJobId();
        if (maxJobs > handler.MAX_TRACKED_JOBS()) {
            maxJobs = handler.MAX_TRACKED_JOBS();
        }

        for (uint256 jobId = 0; jobId < maxJobs; jobId++) {
            if (!manager.jobExists(jobId)) continue;
            if (!manager.jobEscrowReleased(jobId)) {
                expectedEscrow += manager.jobPayout(jobId);
            }
            expectedAgentBonds += manager.jobAgentBondAmount(jobId);
            expectedDisputeBonds += manager.jobDisputeBondAmount(jobId);
            uint256 validatorsLength = manager.jobValidatorsLength(jobId);
            uint256 raw = manager.jobValidatorBondAmount(jobId);
            uint256 perVote = (raw == 0 || raw == 1) ? 0 : raw - 1;
            expectedValidatorBonds += perVote * validatorsLength;
        }

        assertEq(manager.lockedEscrow(), expectedEscrow);
        assertEq(manager.lockedAgentBonds(), expectedAgentBonds);
        assertEq(manager.lockedValidatorBonds(), expectedValidatorBonds);
        assertEq(manager.lockedDisputeBonds(), expectedDisputeBonds);
    }

    function invariant_voteAccountingAndTerminalState() external view {
        uint256 maxJobs = manager.nextJobId();
        if (maxJobs > handler.MAX_TRACKED_JOBS()) {
            maxJobs = handler.MAX_TRACKED_JOBS();
        }

        for (uint256 jobId = 0; jobId < maxJobs; jobId++) {
            if (!manager.jobExists(jobId)) continue;
            (bool completionRequested, uint256 approvals, uint256 disapprovals,,) = manager.getJobValidation(jobId);
            assertEq(manager.jobValidatorsLength(jobId), approvals + disapprovals);

            (bool completed, bool disputed, bool expired,) = manager.jobFlags(jobId);
            assertFalse(completed && expired);
            if (completed || expired) {
                assertTrue(manager.jobEscrowReleased(jobId));
            }
            if (completionRequested) {
                assertTrue(manager.jobAssignedAgent(jobId) != address(0));
            }
            disputed;
        }
    }

    function invariant_agentActiveJobCap() external view {
        address[] memory list = handler.trackedAgents();
        uint256 cap = manager.maxActiveJobsPerAgentView();
        for (uint256 i = 0; i < list.length; i++) {
            assertLe(manager.activeJobsByAgentView(list[i]), cap);
        }
    }
}
