// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-test/harness/AGIJobManagerHarness.sol";
import "contracts/test/MockERC20.sol";
import "contracts/test/MockERC721.sol";

contract AGIJobManagerTimingFuzz is Test {
    AGIJobManagerHarness internal manager;
    MockERC20 internal token;
    address internal employer = address(0x111);
    address internal agent = address(0x222);
    address internal validator = address(0x333);
    MockERC721 internal agiType;

    function setUp() external {
        token = new MockERC20();
        address[2] memory ensConfig = [address(0), address(0)];
        bytes32[4] memory rootNodes;
        bytes32[2] memory merkleRoots;
        manager = new AGIJobManagerHarness(address(token), "", ensConfig, rootNodes, merkleRoots);

        token.mint(employer, 1000 ether);
        token.mint(agent, 1000 ether);
        token.mint(validator, 1000 ether);
        vm.prank(employer);
        token.approve(address(manager), type(uint256).max);
        vm.prank(agent);
        token.approve(address(manager), type(uint256).max);
        vm.prank(validator);
        token.approve(address(manager), type(uint256).max);

        vm.startPrank(manager.owner());
        manager.addAdditionalAgent(agent);
        manager.addAdditionalValidator(validator);
        manager.setSettlementPaused(false);
        manager.setRequiredValidatorApprovals(1);

        agiType = new MockERC721();
        manager.addAGIType(address(agiType), 60);
        agiType.mint(agent);
        vm.stopPrank();
    }

    function _createAssignedJob() internal returns (uint256 jobId) {
        vm.prank(employer);
        manager.createJob("ipfs://spec", 10 ether, 2 days, "");
        jobId = manager.nextJobId() - 1;
        vm.prank(agent);
        manager.applyForJob(jobId, "", new bytes32[](0));
        vm.prank(agent);
        manager.requestJobCompletion(jobId, "ipfs://done");
    }

    function testFuzz_completionReviewBoundary(uint256 deltaSeed) external {
        uint256 jobId = _createAssignedJob();
        (,,, uint256 completionRequestedAt,) = manager.getJobValidation(jobId);
        uint256 boundary = completionRequestedAt + manager.completionReviewPeriod();
        uint256 delta = bound(deltaSeed, 0, 2);

        vm.warp(boundary - (delta == 0 ? 1 : 0));
        vm.prank(validator);
        if (block.timestamp <= boundary) {
            manager.validateJob(jobId, "", new bytes32[](0));
        }

        vm.warp(boundary + 1);
        vm.prank(validator);
        vm.expectRevert();
        manager.disapproveJob(jobId, "", new bytes32[](0));
    }

    function testFuzz_challengePeriodBoundary(uint256 extra) external {
        uint256 jobId = _createAssignedJob();
        vm.prank(validator);
        manager.validateJob(jobId, "", new bytes32[](0));
        (, uint256 approvedAt) = manager.jobValidatorApprovalState(jobId);
        uint256 challengePeriod = manager.challengePeriodAfterApproval();

        vm.warp(approvedAt + challengePeriod - 1);
        vm.expectRevert();
        manager.finalizeJob(jobId);

        vm.warp(approvedAt + challengePeriod + bound(extra, 0, 2));
        try manager.finalizeJob(jobId) {} catch {}
    }

    function testFuzz_expiryBoundary(uint256 dt) external {
        vm.prank(employer);
        manager.createJob("ipfs://spec", 10 ether, 1 days, "");
        uint256 jobId = manager.nextJobId() - 1;
        vm.prank(agent);
        manager.applyForJob(jobId, "", new bytes32[](0));

        (,,, uint256 duration, uint256 assignedAt,,,,) = manager.getJobCore(jobId);
        vm.warp(assignedAt + duration - 1);
        vm.expectRevert();
        manager.expireJob(jobId);

        vm.warp(assignedAt + duration + bound(dt, 1, 2));
        try manager.expireJob(jobId) {} catch {}
    }

    function testFuzz_disputeAndStaleResolutionBoundary(uint256 dt) external {
        uint256 jobId = _createAssignedJob();
        (,,, uint256 completionRequestedAt,) = manager.getJobValidation(jobId);
        uint256 reviewBoundary = completionRequestedAt + manager.completionReviewPeriod();

        vm.warp(reviewBoundary + 1);
        vm.prank(employer);
        vm.expectRevert();
        manager.disputeJob(jobId);

        vm.warp(reviewBoundary - 1);
        vm.prank(employer);
        try manager.disputeJob(jobId) {}
        catch {
            return;
        }

        (,,,, uint256 disputedAt) = manager.getJobValidation(jobId);
        vm.warp(disputedAt + manager.disputeReviewPeriod() - 1);
        vm.expectRevert();
        manager.resolveStaleDispute(jobId, true);

        vm.warp(disputedAt + manager.disputeReviewPeriod() + bound(dt, 1, 2));
        manager.resolveStaleDispute(jobId, true);
    }
}
