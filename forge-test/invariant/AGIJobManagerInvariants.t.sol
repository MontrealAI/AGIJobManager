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
    MockERC721 public agiType;

    constructor(AGIJobManagerHarness _manager, MockERC20 _token) {
        manager = _manager;
        token = _token;

        for (uint256 i = 0; i < 3; i++) {
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

        agiType = new MockERC721();

        vm.startPrank(manager.owner());
        manager.addAGIType(address(agiType), 60);
        for (uint256 i = 0; i < agents.length; i++) {
            agiType.mint(agents[i]);
        }
        for (uint256 i = 0; i < validators.length; i++) {
            manager.addAdditionalValidator(validators[i]);
        }
        manager.setSettlementPaused(false);
        manager.setRequiredValidatorApprovals(1);
        for (uint256 i = 0; i < agents.length; i++) {
            manager.addAdditionalAgent(agents[i]);
        }
        vm.stopPrank();
    }

    function createJob(uint256 employerSeed, uint256 payoutSeed, uint256 durationSeed) external {
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

    function requestCompletion(uint256 jobSeed, uint256 agentSeed) external {
        if (manager.nextJobId() == 0) return;
        uint256 jobId = bound(jobSeed, 0, manager.nextJobId() - 1);
        address agent = agents[bound(agentSeed, 0, agents.length - 1)];
        vm.prank(agent);
        try manager.requestJobCompletion(jobId, "ipfs://done") {} catch {}
    }

    function validate(uint256 jobSeed, uint256 validatorSeed, bool approveVote) external {
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

    function dispute(uint256 jobSeed, bool byEmployer) external {
        if (manager.nextJobId() == 0) return;
        uint256 jobId = bound(jobSeed, 0, manager.nextJobId() - 1);
        address actor = byEmployer ? manager.jobEmployer(jobId) : manager.jobAssignedAgent(jobId);
        if (actor == address(0)) return;
        vm.prank(actor);
        try manager.disputeJob(jobId) {} catch {}
    }

    function finalize(uint256 jobSeed, uint256 warpDelta) external {
        if (manager.nextJobId() == 0) return;
        vm.warp(block.timestamp + bound(warpDelta, 0, 10 days));
        uint256 jobId = bound(jobSeed, 0, manager.nextJobId() - 1);
        try manager.finalizeJob(jobId) {} catch {}
    }

    function expire(uint256 jobSeed, uint256 warpDelta) external {
        if (manager.nextJobId() == 0) return;
        vm.warp(block.timestamp + bound(warpDelta, 0, 20 days));
        uint256 jobId = bound(jobSeed, 0, manager.nextJobId() - 1);
        try manager.expireJob(jobId) {} catch {}
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

    function invariant_lockedTotalsNeverExceedBalance() external view {
        uint256 lockedTotal = manager.lockedEscrow() + manager.lockedAgentBonds() + manager.lockedValidatorBonds() + manager.lockedDisputeBonds();
        assertGe(token.balanceOf(address(manager)), lockedTotal);
    }

    function invariant_activeJobsByAgentConsistency() external view {
        uint256 activeAcrossJobs;
        for (uint256 jobId = 0; jobId < manager.nextJobId(); jobId++) {
            if (!manager.jobExists(jobId)) continue;
            (bool completed, bool disputed, bool expired,) = manager.jobFlags(jobId);
            address assignedAgent = manager.jobAssignedAgent(jobId);
            if (assignedAgent != address(0) && !completed && !expired) {
                activeAcrossJobs++;
                assertLe(manager.activeJobsByAgentView(assignedAgent), 3);
                assertTrue(disputed || !disputed);
            }
            assertFalse(completed && expired);
            assertFalse(completed && disputed);
            assertFalse(expired && disputed);
        }
        assertLe(activeAcrossJobs, manager.nextJobId());
    }


    function invariant_lockedAccountingMatchesJobs() external view {
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
            uint256 raw = manager.jobValidatorBondAmount(jobId);
            if (validatorsLength == 0) {
                assertTrue(raw == 0 || raw == 1);
            } else {
                uint256 perVote = raw == 0 ? 0 : raw - 1;
                expectedValidatorBonds += perVote * validatorsLength;
            }
        }

        assertEq(manager.lockedEscrow(), expectedEscrow);
        assertEq(manager.lockedAgentBonds(), expectedAgentBonds);
        assertEq(manager.lockedValidatorBonds(), expectedValidatorBonds);
        assertEq(manager.lockedDisputeBonds(), expectedDisputeBonds);
    }

    function invariant_terminalJobsReleaseEscrow() external view {
        for (uint256 jobId = 0; jobId < manager.nextJobId(); jobId++) {
            if (!manager.jobExists(jobId)) continue;
            (bool completed,, bool expired,) = manager.jobFlags(jobId);
            if (completed || expired) {
                assertTrue(manager.jobEscrowReleased(jobId));
            }
        }
    }
}
