// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-test/harness/AGIJobManagerHarness.sol";
import "forge-test/mocks/AdversarialUSDC.sol";
import "contracts/test/MockERC721.sol";

contract AGIJobManagerSettlementFuzz is Test {
    AdversarialUSDC internal token;
    AGIJobManagerHarness internal manager;
    address internal constant EMPLOYER = address(0xE111);
    address internal constant AGENT = address(0xA111);
    address internal constant VALIDATOR_A = address(0xB111);
    address internal constant VALIDATOR_B = address(0xB112);
    address internal constant VALIDATOR_C = address(0xB113);
    uint256 internal constant FUNDING = 1e24;
    bytes32 internal constant TRANSFER = keccak256("Transfer(address,address,uint256)");

    function setUp() external {
        token = new AdversarialUSDC();
        address[2] memory ens;
        bytes32[4] memory roots;
        bytes32[2] memory merkle;
        manager = new AGIJobManagerHarness(address(token), "", ens, roots, merkle);
        MockERC721 credential = new MockERC721();
        credential.mint(AGENT);
        manager.addAGIType(address(credential), 60);
        manager.addAdditionalAgent(AGENT);
        manager.addAdditionalValidator(VALIDATOR_A);
        manager.addAdditionalValidator(VALIDATOR_B);
        manager.addAdditionalValidator(VALIDATOR_C);
        manager.addModerator(address(this));
        manager.setRequiredValidatorApprovals(2);
        manager.setRequiredValidatorDisapprovals(3);
        manager.setVoteQuorum(2);
        manager.setSettlementPaused(false);
        _fund(EMPLOYER);
        _fund(AGENT);
        _fund(VALIDATOR_A);
        _fund(VALIDATOR_B);
        _fund(VALIDATOR_C);
    }

    function _fund(address actor) internal {
        token.mint(actor, FUNDING);
        vm.prank(actor);
        token.approve(address(manager), type(uint256).max);
    }

    function _post(uint256 cost) internal returns (uint256 id) {
        id = manager.nextJobId();
        vm.prank(EMPLOYER);
        manager.createJob("ipfs://spec", cost, 2 days, "settlement qualification");
    }

    function _request(uint256 id) internal {
        vm.startPrank(AGENT);
        manager.applyForJob(id, "", new bytes32[](0));
        manager.requestJobCompletion(id, "ipfs://proof");
        vm.stopPrank();
    }

    function _vote(uint256 id, address validator, bool approve) internal {
        vm.prank(validator);
        if (approve) manager.validateJob(id, "", new bytes32[](0));
        else manager.disapproveJob(id, "", new bytes32[](0));
    }

    function _ready(uint256 id) internal {
        _request(id);
        _vote(id, VALIDATOR_A, true);
        _vote(id, VALIDATOR_B, true);
        _vote(id, VALIDATOR_C, false);
        (, uint256 approvedAt) = manager.jobValidatorApprovalState(id);
        vm.warp(approvedAt + manager.challengePeriodAfterApproval() + 1);
    }

    function _assertEmptyReserves() internal view {
        assertEq(manager.lockedEscrow(), 0);
        assertEq(manager.lockedAgentBonds(), 0);
        assertEq(manager.lockedValidatorBonds(), 0);
        assertEq(manager.lockedDisputeBonds(), 0);
        assertEq(token.balanceOf(address(manager)), 0);
        assertEq(manager.withdrawableUSDC(), 0);
        assertEq(manager.activeJobsByAgentView(AGENT), 0);
    }

    function testFuzz_nftPolicyPreservesJobTermsAndPayout(uint256 costSeed, bool firstRequired, uint8 rateSeed)
        external
    {
        uint256 cost = bound(costSeed, 1, manager.maxJobPayout());
        uint256 rate = bound(uint256(rateSeed), 1, 60);
        manager.setValidationRewardPercentage(rate);
        manager.setRequiredValidatorApprovals(1);
        manager.setVoteQuorum(1);
        (address collection,) = manager.agiTypes(0);
        MockERC721 credential = MockERC721(collection);
        vm.prank(AGENT);
        credential.transferFrom(AGENT, EMPLOYER, 1);
        for (uint256 i = 0; i < 2; ++i) {
            bool required = i == 0 ? firstRequired : !firstRequired;
            manager.setAgentNftRequired(required);
            uint256 id = _post(cost);
            manager.setAgentNftRequired(!required);
            assertEq(manager.jobAgentNftRequired(id), required);
            uint256 credentialId;
            if (required) {
                vm.expectRevert(AGIJobManager.IneligibleAgentPayout.selector);
                vm.prank(AGENT);
                manager.applyForJob(id, "", new bytes32[](0));
                credentialId = credential.mint(AGENT);
            }
            _request(id);
            if (required) {
                vm.prank(AGENT);
                credential.transferFrom(AGENT, EMPLOYER, credentialId);
            }
            _vote(id, VALIDATOR_A, true);
            (, uint256 approvedAt) = manager.jobValidatorApprovalState(id);
            vm.warp(approvedAt + manager.challengePeriodAfterApproval() + 1);
            manager.finalizeJob(id);
            assertEq(manager.jobAgentNftRequired(id), required);
            _assertEmptyReserves();
        }
        uint256 budget = cost * rate / 100;
        assertEq(token.balanceOf(VALIDATOR_A), FUNDING + 2 * budget);
        assertEq(token.balanceOf(AGENT), FUNDING + 2 * (cost - budget - cost * 30 / 100 - cost * 10 / 100));
        assertEq(token.balanceOf(manager.wallet30()), 2 * (cost * 30 / 100));
        assertEq(token.balanceOf(manager.wallet10()), 2 * (cost * 10 / 100));
    }

    function testFuzz_bondSnapshotsSurviveOwnerChangesBetweenVotes(uint256 costSeed, bool initiallyDisabled) external {
        uint256 cost = bound(costSeed, 1, manager.maxJobPayout());
        if (initiallyDisabled) manager.setValidatorBondParams(0, 0, 0);
        else manager.setValidatorBondParams(10_000, 1, manager.maxJobPayout());
        uint256 id = _post(cost);
        _request(id);
        uint256 agentBondSnapshot = manager.jobAgentBondAmount(id);
        _vote(id, VALIDATOR_A, true);
        uint256 validatorBondSnapshot = manager.jobValidatorBondAmount(id);
        assertEq(validatorBondSnapshot, initiallyDisabled ? 1 : cost + 1);

        // Later voters must use the first vote's bond, including its encoded zero.
        manager.setAgentBondParams(0, 0, 0);
        if (initiallyDisabled) manager.setValidatorBondParams(10_000, 1, manager.maxJobPayout());
        else manager.setValidatorBondParams(0, 0, 0);
        _vote(id, VALIDATOR_B, true);
        _vote(id, VALIDATOR_C, true);
        assertEq(manager.jobAgentBondAmount(id), agentBondSnapshot);
        assertEq(manager.lockedAgentBonds(), agentBondSnapshot);
        assertEq(manager.jobValidatorBondAmount(id), validatorBondSnapshot);
        assertEq(manager.lockedValidatorBonds(), (validatorBondSnapshot - 1) * 3);
        (, uint256 approvedAt) = manager.jobValidatorApprovalState(id);
        vm.warp(approvedAt + manager.challengePeriodAfterApproval() + 1);
        manager.finalizeJob(id);

        uint256 budget = cost * 8 / 100;
        assertEq(token.balanceOf(VALIDATOR_A), FUNDING + budget / 3);
        assertEq(token.balanceOf(VALIDATOR_B), FUNDING + budget / 3);
        assertEq(token.balanceOf(VALIDATOR_C), FUNDING + budget / 3);
        assertEq(token.balanceOf(AGENT), FUNDING + cost - cost * 30 / 100 - cost * 10 / 100 - budget + budget % 3);
        assertEq(token.balanceOf(manager.wallet30()), cost * 30 / 100);
        assertEq(token.balanceOf(manager.wallet10()), cost * 10 / 100);
        _assertEmptyReserves();
    }

    function testFuzz_maximumDurationRemainsSettleable(uint256 costSeed, bool completed) external {
        uint256 cost = bound(costSeed, 1, manager.maxJobPayout());
        manager.setJobDurationLimit(365 days);
        vm.expectRevert(AGIJobManager.InvalidParameters.selector);
        manager.setJobDurationLimit(365 days + 1);
        uint256 id = manager.nextJobId();
        vm.prank(EMPLOYER);
        manager.createJob("ipfs://spec", cost, 365 days, "maximum duration");
        vm.prank(AGENT);
        manager.applyForJob(id, "", new bytes32[](0));
        (,,, uint256 duration, uint256 assignedAt,,,,) = manager.getJobCore(id);
        assertEq(duration, 365 days);
        vm.warp(assignedAt + duration);
        vm.expectRevert(AGIJobManager.InvalidState.selector);
        manager.expireJob(id);
        if (completed) {
            vm.prank(AGENT);
            manager.requestJobCompletion(id, "ipfs://proof");
            vm.warp(block.timestamp + manager.completionReviewPeriod() + 1);
            manager.finalizeJob(id);
            assertEq(token.balanceOf(AGENT), FUNDING + cost - cost * 30 / 100 - cost * 10 / 100);
        } else {
            uint256 agentBond = manager.jobAgentBondAmount(id);
            vm.warp(block.timestamp + 1);
            manager.expireJob(id);
            assertEq(token.balanceOf(EMPLOYER), FUNDING + agentBond);
            assertEq(token.balanceOf(AGENT), FUNDING - agentBond);
        }
        assertTrue(manager.jobEscrowReleased(id));
        _assertEmptyReserves();
    }

    function testFuzz_successDistributesGrossCostAndSlashedBondsExactly(
        uint256 costSeed,
        uint8 pctSeed,
        uint16 slashSeed
    ) external {
        uint256 cost = bound(costSeed, 1, manager.maxJobPayout());
        uint256 pct = bound(pctSeed, 1, 60);
        uint256 slashBps = bound(slashSeed, 0, 10_000);
        manager.setValidationRewardPercentage(pct);
        manager.setValidatorSlashBps(slashBps);
        uint256 id = _post(cost);
        // Changing the current budget must not rewrite the posted economics.
        manager.setValidationRewardPercentage(pct == 60 ? 1 : 60);
        _ready(id);
        uint256 bond = manager.jobValidatorBondAmount(id) - 1;
        uint256 slashed = bond * slashBps / 10_000;
        uint256 pool = cost * pct / 100 + slashed;
        uint256 amount30 = cost * 30 / 100;
        uint256 amount10 = cost * 10 / 100;
        uint256 agentReward = cost - cost * pct / 100 - amount30 - amount10 + pool % 2;
        manager.finalizeJob(id);
        assertEq(token.balanceOf(VALIDATOR_A), FUNDING + pool / 2);
        assertEq(token.balanceOf(VALIDATOR_B), FUNDING + pool / 2);
        assertEq(token.balanceOf(VALIDATOR_C), FUNDING - slashed);
        assertEq(token.balanceOf(AGENT), FUNDING + agentReward);
        assertEq(token.balanceOf(EMPLOYER), FUNDING - cost);
        assertEq(token.balanceOf(manager.wallet30()), amount30);
        assertEq(token.balanceOf(manager.wallet10()), amount10);
        assertEq(amount30 + amount10 + agentReward + 2 * (pool / 2) - slashed, cost);
        _assertEmptyReserves();
        vm.expectRevert();
        manager.finalizeJob(id);
    }

    function testFuzz_noVotesRefundUnusedValidatorBudgetToAgent(uint256 costSeed, uint8 pctSeed) external {
        uint256 cost = bound(costSeed, 1, manager.maxJobPayout());
        manager.setValidationRewardPercentage(bound(pctSeed, 1, 60));
        uint256 id = _post(cost);
        _request(id);
        vm.warp(block.timestamp + manager.completionReviewPeriod() + 1);
        manager.finalizeJob(id);
        assertEq(token.balanceOf(AGENT), FUNDING + cost - cost * 30 / 100 - cost * 10 / 100);
        assertEq(token.balanceOf(VALIDATOR_A), FUNDING);
        assertEq(token.balanceOf(manager.wallet30()), cost * 30 / 100);
        assertEq(token.balanceOf(manager.wallet10()), cost * 10 / 100);
        _assertEmptyReserves();
    }

    function testFuzz_issuerRestrictionRollsBackAllTransfersAndAllowsRetry(uint256 costSeed, uint8 targetSeed)
        external
    {
        uint256 cost = bound(costSeed, 100, manager.maxJobPayout());
        uint256 id = _post(cost);
        _ready(id);
        uint256 balance = token.balanceOf(address(manager));
        uint256 agentBond = manager.lockedAgentBonds();
        uint256 validatorBonds = manager.lockedValidatorBonds();
        address[5] memory targets = [VALIDATOR_B, manager.wallet30(), manager.wallet10(), AGENT, address(manager)];
        address target = targets[bound(targetSeed, 0, 4)];
        token.setBlocked(target, true);
        vm.expectRevert();
        manager.finalizeJob(id);
        assertEq(token.balanceOf(address(manager)), balance);
        assertEq(manager.lockedEscrow(), cost);
        assertEq(manager.lockedAgentBonds(), agentBond);
        assertEq(manager.lockedValidatorBonds(), validatorBonds);
        assertFalse(manager.jobEscrowReleased(id));
        assertEq(token.balanceOf(manager.wallet30()), 0);
        assertEq(token.balanceOf(manager.wallet10()), 0);
        assertEq(manager.nextTokenId(), 0);
        assertEq(manager.activeJobsByAgentView(AGENT), 1);
        token.setBlocked(target, false);
        token.setTransfersPaused(true);
        vm.expectRevert();
        manager.finalizeJob(id);
        token.setTransfersPaused(false);
        manager.finalizeJob(id);
        _assertEmptyReserves();
    }

    function testFuzz_validatorTransfersPrecedeBothWalletsThenAgent(uint256 costSeed) external {
        uint256 cost = bound(costSeed, 100, manager.maxJobPayout());
        manager.setAgentBondParams(0, 0, 0);
        manager.setValidatorBondParams(0, 0, 0);
        uint256 id = _post(cost);
        _ready(id);
        vm.recordLogs();
        manager.finalizeJob(id);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        address[5] memory recipients = [VALIDATOR_A, VALIDATOR_B, manager.wallet30(), manager.wallet10(), AGENT];
        uint256 count;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != address(token) || logs[i].topics[0] != TRANSFER) continue;
            assertLt(count, recipients.length);
            assertEq(address(uint160(uint256(logs[i].topics[1]))), address(manager));
            assertEq(address(uint160(uint256(logs[i].topics[2]))), recipients[count]);
            ++count;
        }
        assertEq(count, recipients.length);
        _assertEmptyReserves();
    }

    function testFuzz_refundDoesNotChargeSettlementWallets(uint256 costSeed, bool stale, bool employerDisputes)
        external
    {
        uint256 cost = bound(costSeed, 1, manager.maxJobPayout());
        uint256 id = _post(cost);
        _request(id);
        _vote(id, VALIDATOR_A, false);
        _vote(id, VALIDATOR_B, false);
        _vote(id, VALIDATOR_C, true);
        uint256 agentBond = manager.jobAgentBondAmount(id);
        uint256 validatorBond = manager.jobValidatorBondAmount(id) - 1;
        address initiator = employerDisputes ? EMPLOYER : AGENT;
        vm.prank(initiator);
        manager.disputeJob(id);
        uint256 disputeBond = manager.jobDisputeBondAmount(id);
        if (stale) {
            vm.warp(block.timestamp + manager.disputeReviewPeriod() + 1);
            manager.resolveStaleDispute(id, true);
        } else {
            manager.resolveDisputeWithCode(id, 2, "proof rejected");
        }
        uint256 slashed = validatorBond * manager.validatorSlashBps() / 10_000;
        uint256 pool = cost * 8 / 100 + slashed;
        uint256 employerNet = agentBond + pool % 2 + (employerDisputes ? 0 : disputeBond);
        assertEq(token.balanceOf(EMPLOYER), FUNDING - cost * 8 / 100 + employerNet);
        assertEq(token.balanceOf(AGENT), FUNDING - agentBond - (employerDisputes ? 0 : disputeBond));
        assertEq(token.balanceOf(VALIDATOR_A), FUNDING + pool / 2);
        assertEq(token.balanceOf(VALIDATOR_B), FUNDING + pool / 2);
        assertEq(token.balanceOf(VALIDATOR_C), FUNDING - slashed);
        assertEq(token.balanceOf(manager.wallet30()), 0);
        assertEq(token.balanceOf(manager.wallet10()), 0);
        _assertEmptyReserves();
    }
}
