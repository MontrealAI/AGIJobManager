// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-test/harness/AGIJobManagerHarness.sol";
import "contracts/test/MockERC20.sol";
import "contracts/test/MockERC721.sol";

contract AGIJobManagerBoundaryFuzz is Test {
    AGIJobManagerHarness internal manager;
    MockERC20 internal token;
    MockERC721 internal agiType;

    address internal employer = address(0x111);
    address internal agent = address(0x222);
    address internal validatorA = address(0x333);
    address internal validatorB = address(0x444);

    function setUp() external {
        token = new MockERC20();
        address[2] memory ensConfig = [address(0), address(0)];
        bytes32[4] memory rootNodes;
        bytes32[2] memory merkleRoots;
        manager = new AGIJobManagerHarness(address(token), "", ensConfig, rootNodes, merkleRoots);

        token.mint(employer, 2_000_000 ether);
        token.mint(agent, 2_000_000 ether);
        token.mint(validatorA, 2_000_000 ether);
        token.mint(validatorB, 2_000_000 ether);

        vm.prank(employer);
        token.approve(address(manager), type(uint256).max);
        vm.prank(agent);
        token.approve(address(manager), type(uint256).max);
        vm.prank(validatorA);
        token.approve(address(manager), type(uint256).max);
        vm.prank(validatorB);
        token.approve(address(manager), type(uint256).max);

        vm.startPrank(manager.owner());
        agiType = new MockERC721();
        manager.addAGIType(address(agiType), 60);
        agiType.mint(agent);
        manager.addAdditionalAgent(agent);
        manager.addAdditionalValidator(validatorA);
        manager.addAdditionalValidator(validatorB);
        manager.setRequiredValidatorApprovals(1);
        manager.setRequiredValidatorDisapprovals(1);
        manager.setSettlementPaused(false);
        vm.stopPrank();
    }

    function testFuzz_uriLengthCaps(uint256 specLenSeed, uint256 completionLenSeed) external {
        uint256 specLen = bound(specLenSeed, 1, 2200);
        string memory spec = _uriOfLen(specLen);

        vm.prank(employer);
        if (specLen > 2048) {
            vm.expectRevert();
            manager.createJob(spec, 10 ether, 1 days, "");
            return;
        }
        manager.createJob(spec, 10 ether, 1 days, "");

        uint256 jobId = manager.nextJobId() - 1;
        vm.prank(agent);
        manager.applyForJob(jobId, "", new bytes32[](0));

        uint256 completionLen = bound(completionLenSeed, 0, 1200);
        string memory completionUri = completionLen == 0 ? "" : _uriOfLen(completionLen);
        vm.prank(agent);
        if (completionLen == 0 || completionLen > 1024) {
            vm.expectRevert();
            manager.requestJobCompletion(jobId, completionUri);
        } else {
            manager.requestJobCompletion(jobId, completionUri);
        }
    }

    function _uriOfLen(uint256 targetLen) internal pure returns (string memory) {
        bytes memory prefix = "ipfs://";
        if (targetLen <= prefix.length) {
            return "ipfs://a";
        }
        bytes memory buf = new bytes(targetLen);
        for (uint256 i = 0; i < prefix.length; i++) {
            buf[i] = prefix[i];
        }
        for (uint256 i = prefix.length; i < targetLen; i++) {
            buf[i] = 0x61;
        }
        return string(buf);
    }

    function testFuzz_validatorTieBoundary(uint256 payoutSeed) external {
        uint256 payout = bound(payoutSeed, 1 ether, 20 ether);
        vm.prank(employer);
        manager.createJob("ipfs://spec", payout, 1 days, "");
        uint256 jobId = manager.nextJobId() - 1;

        vm.prank(agent);
        manager.applyForJob(jobId, "", new bytes32[](0));
        vm.prank(agent);
        manager.requestJobCompletion(jobId, "ipfs://done");

        vm.prank(validatorA);
        manager.validateJob(jobId, "", new bytes32[](0));
        vm.prank(validatorB);
        try manager.disapproveJob(jobId, "", new bytes32[](0)) {} catch {
            return;
        }

        (, , uint256 approvals, uint256 disapprovals,) = manager.getJobValidation(jobId);
        if (approvals != disapprovals) {
            return;
        }

        vm.warp(block.timestamp + manager.completionReviewPeriod() + 1);
        vm.expectRevert();
        manager.finalizeJob(jobId);
    }

    function testFuzz_disputeBondEdgeBehavior(uint256 payoutSeed) external {
        uint256 payout = bound(payoutSeed, 1 ether, 1_000 ether);
        vm.prank(employer);
        manager.createJob("ipfs://spec", payout, 1 days, "");
        uint256 jobId = manager.nextJobId() - 1;

        vm.prank(agent);
        manager.applyForJob(jobId, "", new bytes32[](0));
        vm.prank(agent);
        manager.requestJobCompletion(jobId, "ipfs://done");

        vm.prank(employer);
        manager.disputeJob(jobId);

        uint256 disputeBond = manager.jobDisputeBondAmount(jobId);
        assertGt(disputeBond, 0);
        assertLe(disputeBond, payout);
        assertLe(disputeBond, 200 ether);
    }
}
