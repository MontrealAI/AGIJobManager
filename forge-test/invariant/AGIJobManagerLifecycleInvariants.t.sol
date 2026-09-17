// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-std/StdInvariant.sol";
import "forge-test/harness/AGIJobManagerHarness.sol";
import "contracts/test/MockERC20.sol";
import "contracts/test/MockERC721.sol";

/// @dev Every selected call makes a valid transition or asserts a specific rejected attack.
/// No unexpected revert is swallowed; three simultaneous jobs exercise reserve isolation.
contract AGIJobManagerLifecycleHandler is Test {
    AGIJobManagerHarness public manager;
    MockERC20 public token;
    address[2] public employers = [address(0xE001), address(0xE002)];
    address[2] public agents = [address(0xA001), address(0xA002)];
    address[3] public validators = [address(0xB001), address(0xB002), address(0xB003)];
    address public initialOwner;
    address public constant NEXT_OWNER = address(0xD001);
    address public constant ATTACKER = address(0xBAD1);
    uint256[3] public jobIds;
    uint8[3] public stages;
    uint256 public surplus;
    uint256 public actionCalls;
    uint256 public completedJobs;
    uint256 public refundedJobs;
    uint256 public expiredJobs;
    uint256 public cancelledJobs;
    uint256 public disputedJobs;
    uint256 public postedJobs;

    constructor(AGIJobManagerHarness manager_, MockERC20 token_) {
        manager = manager_;
        token = token_;
        initialOwner = manager.owner();
        MockERC721 credential = new MockERC721();
        vm.startPrank(initialOwner);
        manager.addAGIType(address(credential), 60);
        manager.setRequiredValidatorApprovals(2);
        manager.setRequiredValidatorDisapprovals(3);
        manager.setVoteQuorum(2);
        manager.addModerator(address(this));
        manager.unpauseAll();
        for (uint256 i; i < 2; ++i) {
            manager.addAdditionalAgent(agents[i]);
            credential.mint(agents[i]);
        }
        for (uint256 i; i < 3; ++i) {
            manager.addAdditionalValidator(validators[i]);
        }
        vm.stopPrank();
        for (uint256 i; i < 2; ++i) {
            _fund(employers[i]);
            _fund(agents[i]);
        }
        for (uint256 i; i < 3; ++i) {
            _fund(validators[i]);
        }
        for (uint256 i; i < 3; ++i) {
            _post(i, (i + 1) * 100e6);
        }
    }

    function _fund(address actor) internal {
        token.mint(actor, 1e24);
        vm.prank(actor);
        token.approve(address(manager), type(uint256).max);
    }

    function _post(uint256 slot, uint256 cost) internal {
        jobIds[slot] = manager.nextJobId();
        vm.prank(employers[slot % 2]);
        manager.createJob("ipfs://spec", cost, 2 days, "stateful accounting");
        stages[slot] = 1;
        ++postedJobs;
    }

    function advance(uint256 slotSeed, uint256 valueSeed, uint8 routeSeed) external {
        ++actionCalls;
        uint256 slot = slotSeed % 3;
        uint256 id = jobIds[slot];
        uint8 stage = stages[slot];
        if (stage == 0) {
            _post(slot, bound(valueSeed, 1, manager.maxJobPayout()));
        } else if (stage == 1) {
            if (routeSeed % 5 == 0) {
                vm.prank(manager.jobEmployer(id));
                manager.cancelJob(id);
                stages[slot] = 0;
                ++cancelledJobs;
            } else {
                vm.prank(agents[slot % 2]);
                manager.applyForJob(id, "", new bytes32[](0));
                stages[slot] = 2;
            }
        } else if (stage == 2) {
            (,,, uint256 duration, uint256 assignedAt,,,,) = manager.getJobCore(id);
            if (block.timestamp > assignedAt + duration || routeSeed % 5 == 0) {
                if (block.timestamp <= assignedAt + duration) vm.warp(assignedAt + duration + 1);
                manager.expireJob(id);
                stages[slot] = 0;
                ++expiredJobs;
            } else {
                _requestAndVote(slot, routeSeed);
            }
        } else if (stage == 3) {
            // No-vote liveness, majority success, and tie-to-dispute all share this path.
            (,,, uint256 requestedAt,) = manager.getJobValidation(id);
            uint256 readyAt = requestedAt + manager.completionReviewPeriod() + 1;
            if (block.timestamp < readyAt) vm.warp(readyAt);
            manager.finalizeJob(id);
            (, bool disputed,,) = manager.jobFlags(id);
            if (disputed) {
                stages[slot] = 4;
                ++disputedJobs;
            } else {
                stages[slot] = 0;
                ++completedJobs;
            }
        } else {
            bool employerWins = routeSeed % 2 == 0;
            if (routeSeed % 3 == 0) {
                (,,,, uint256 disputedAt) = manager.getJobValidation(id);
                uint256 readyAt = disputedAt + manager.disputeReviewPeriod() + 1;
                if (block.timestamp < readyAt) vm.warp(readyAt);
                vm.prank(manager.owner());
                manager.resolveStaleDispute(id, employerWins);
            } else {
                manager.resolveDisputeWithCode(id, employerWins ? 2 : 1, "stateful evidence");
            }
            stages[slot] = 0;
            if (employerWins) ++refundedJobs;
            else ++completedJobs;
        }
        assertAccounting();
    }

    function _requestAndVote(uint256 slot, uint8 routeSeed) internal {
        uint256 id = jobIds[slot];
        vm.prank(manager.jobAssignedAgent(id));
        manager.requestJobCompletion(id, "ipfs://proof");
        uint256 route = routeSeed % 4;
        if (route != 0) {
            vm.prank(validators[0]);
            manager.validateJob(id, "", new bytes32[](0));
            vm.prank(validators[1]);
            if (route == 2) manager.disapproveJob(id, "", new bytes32[](0));
            else manager.validateJob(id, "", new bytes32[](0));
        }
        if (route == 3) {
            vm.prank(manager.jobEmployer(id));
            manager.disputeJob(id);
            stages[slot] = 4;
            ++disputedJobs;
        } else {
            stages[slot] = 3;
        }
    }

    function changeProspectiveEconomics(uint8 rewardSeed, uint16 bondSeed) external {
        ++actionCalls;
        uint256[3] memory previous;
        for (uint256 i; i < 3; ++i) {
            previous[i] = manager.jobValidatorRewardPct(jobIds[i]);
        }
        vm.startPrank(manager.owner());
        manager.setValidationRewardPercentage(bound(rewardSeed, 1, 60));
        uint256 bps = bound(bondSeed, 1, 10_000);
        manager.setAgentBondParams(bps, 1, manager.maxJobPayout());
        manager.setValidatorBondParams(bps, 1, manager.maxJobPayout());
        vm.stopPrank();
        for (uint256 i; i < 3; ++i) {
            assertEq(manager.jobValidatorRewardPct(jobIds[i]), previous[i]);
        }
        assertAccounting();
    }

    function donateAndWithdraw(uint256 donationSeed, uint256 withdrawalSeed) external {
        ++actionCalls;
        uint256 donation = bound(donationSeed, 1, 1000e6);
        token.mint(address(manager), donation);
        surplus += donation;
        uint256 amount = bound(withdrawalSeed, 1, surplus);
        vm.startPrank(manager.owner());
        manager.pauseAll();
        manager.setSettlementPaused(false);
        vm.expectRevert(AGIJobManager.InsufficientWithdrawableBalance.selector);
        manager.withdrawUSDC(surplus + 1);
        manager.withdrawUSDC(amount);
        surplus -= amount;
        manager.unpauseAll();
        vm.stopPrank();
        assertAccounting();
    }

    function ownerAndOutsiderAttacks(uint256 slotSeed) external {
        ++actionCalls;
        uint256 id = jobIds[slotSeed % 3];
        address oldOwner = manager.owner();
        vm.startPrank(ATTACKER);
        vm.expectRevert();
        manager.setSettlementWallets(ATTACKER, address(0x777));
        vm.expectRevert();
        manager.withdrawUSDC(1);
        vm.expectRevert();
        manager.resolveStaleDispute(id, true);
        vm.expectRevert();
        manager.acceptOwnership();
        vm.stopPrank();

        vm.startPrank(oldOwner);
        manager.pauseAll();
        vm.expectRevert(AGIJobManager.SettlementPaused.selector);
        manager.finalizeJob(id);
        manager.setSettlementPaused(false);
        vm.expectRevert(AGIJobManager.InsufficientWithdrawableBalance.selector);
        manager.rescueERC20(address(token), oldOwner, surplus + 1);
        vm.expectRevert(AGIJobManager.InvalidParameters.selector);
        manager.rescueToken(address(token), abi.encodeWithSignature("transfer(address,uint256)", oldOwner, 1));
        if (_reserves() != 0) {
            vm.expectRevert(AGIJobManager.InvalidState.selector);
            manager.setSettlementWallets(address(0x303), address(0x103));
        } else {
            manager.setSettlementWallets(address(0x303), address(0x103));
        }
        vm.expectRevert(AGIJobManager.InvalidState.selector);
        manager.renounceOwnership();
        manager.unpauseAll();
        vm.stopPrank();
        assertEq(manager.owner(), oldOwner);
        assertAccounting();
    }

    function transferOwner() external {
        ++actionCalls;
        address previous = manager.owner();
        address next = previous == initialOwner ? NEXT_OWNER : initialOwner;
        vm.prank(previous);
        manager.transferOwnership(next);
        assertEq(manager.owner(), previous);
        assertEq(manager.pendingOwner(), next);
        vm.prank(ATTACKER);
        vm.expectRevert();
        manager.acceptOwnership();
        vm.prank(next);
        manager.acceptOwnership();
        assertEq(manager.owner(), next);
        assertEq(manager.pendingOwner(), address(0));
        assertAccounting();
    }

    function _reserves() internal view returns (uint256) {
        return manager.lockedEscrow() + manager.lockedAgentBonds() + manager.lockedValidatorBonds()
            + manager.lockedDisputeBonds();
    }

    function assertAccounting() public view {
        uint256 escrow;
        uint256 agentBonds;
        uint256 validatorBonds;
        uint256 disputeBonds;
        uint256[2] memory active;
        for (uint256 i; i < 3; ++i) {
            uint256 id = jobIds[i];
            if (stages[i] == 0) {
                assertEq(manager.jobAgentBondAmount(id), 0);
                assertEq(manager.jobValidatorBondAmount(id), 0);
                assertEq(manager.jobDisputeBondAmount(id), 0);
                continue;
            }
            assertFalse(manager.jobEscrowReleased(id));
            escrow += manager.jobPayout(id);
            agentBonds += manager.jobAgentBondAmount(id);
            disputeBonds += manager.jobDisputeBondAmount(id);
            uint256 encodedBond = manager.jobValidatorBondAmount(id);
            if (encodedBond > 0) validatorBonds += (encodedBond - 1) * manager.jobValidatorsLength(id);
            if (stages[i] > 1) ++active[i % 2];
        }
        assertEq(manager.lockedEscrow(), escrow);
        assertEq(manager.lockedAgentBonds(), agentBonds);
        assertEq(manager.lockedValidatorBonds(), validatorBonds);
        assertEq(manager.lockedDisputeBonds(), disputeBonds);
        assertEq(token.balanceOf(address(manager)), _reserves() + surplus);
        assertEq(manager.withdrawableUSDC(), surplus);
        for (uint256 i; i < 2; ++i) {
            assertEq(manager.activeJobsByAgentView(agents[i]), active[i]);
        }

        uint256 allBalances = token.balanceOf(address(manager)) + token.balanceOf(initialOwner)
            + token.balanceOf(NEXT_OWNER) + token.balanceOf(address(0x301)) + token.balanceOf(address(0x101))
            + token.balanceOf(address(0x303)) + token.balanceOf(address(0x103));
        for (uint256 i; i < 2; ++i) {
            allBalances += token.balanceOf(employers[i]) + token.balanceOf(agents[i]);
        }
        for (uint256 i; i < 3; ++i) {
            allBalances += token.balanceOf(validators[i]);
        }
        assertEq(allBalances, token.totalSupply());
    }
}

/// forge-config: default.invariant.fail-on-revert = true
/// forge-config: ci.invariant.fail-on-revert = true
contract AGIJobManagerLifecycleInvariants is StdInvariant, Test {
    AGIJobManagerLifecycleHandler internal handler;

    function setUp() external {
        MockERC20 token = new MockERC20();
        address[2] memory ens;
        bytes32[4] memory roots;
        bytes32[2] memory merkle;
        AGIJobManagerHarness manager = new AGIJobManagerHarness(address(token), "", ens, roots, merkle);
        handler = new AGIJobManagerLifecycleHandler(manager, token);
        bytes4[] memory selectors = new bytes4[](5);
        selectors[0] = handler.advance.selector;
        selectors[1] = handler.changeProspectiveEconomics.selector;
        selectors[2] = handler.donateAndWithdraw.selector;
        selectors[3] = handler.ownerAndOutsiderAttacks.selector;
        selectors[4] = handler.transferOwner.selector;
        targetContract(address(handler));
        targetSelector(FuzzSelector(address(handler), selectors));
    }

    function invariant_reservesAndAllActorBalancesAreConserved() external view {
        handler.assertAccounting();
    }

    function afterInvariant() external view {
        assertGt(handler.actionCalls(), 0, "no handler action executed");
        handler.assertAccounting();
    }

    function test_DirectedHandlerReachesAllTerminalPaths() external {
        // Majority success.
        handler.advance(0, 0, 1);
        handler.advance(0, 0, 1);
        handler.advance(0, 0, 1);
        // Expiry after time advances for the other assigned job.
        handler.advance(1, 0, 1);
        handler.advance(1, 0, 5);
        // Cancellation.
        handler.advance(2, 0, 5);
        // Explicit dispute, employer refund.
        handler.advance(0, 100e6, 1);
        handler.advance(0, 0, 1);
        handler.advance(0, 0, 3);
        handler.advance(0, 0, 2);
        // Tie escalates to dispute, then the owner resolves for the agent.
        handler.advance(1, 101e6, 1);
        handler.advance(1, 0, 1);
        handler.advance(1, 0, 2);
        handler.advance(1, 0, 1);
        handler.advance(1, 0, 3);
        assertEq(handler.completedJobs(), 2);
        assertEq(handler.expiredJobs(), 1);
        assertEq(handler.cancelledJobs(), 1);
        assertEq(handler.refundedJobs(), 1);
        assertEq(handler.disputedJobs(), 2);
        handler.ownerAndOutsiderAttacks(0);
        handler.donateAndWithdraw(100, 50);
        handler.transferOwner();
        handler.assertAccounting();
    }
}
