// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-test/harness/AGIJobManagerHarness.sol";
import "contracts/test/MockERC20.sol";
import "contracts/test/MockERC721.sol";

contract AGIJobManagerBoundaryFuzz is Test {
    MockERC20 internal token;
    AGIJobManagerHarness internal manager;
    MockERC721 internal agiType;

    address internal employer = address(0x11);
    address internal agent = address(0x22);
    address internal validatorA = address(0x33);
    address internal validatorB = address(0x44);

    function setUp() external {
        token = new MockERC20();
        address[2] memory ensConfig = [address(0), address(0)];
        bytes32[4] memory rootNodes;
        bytes32[2] memory merkleRoots;
        manager = new AGIJobManagerHarness(address(token), "", ensConfig, rootNodes, merkleRoots);

        agiType = new MockERC721();
        manager.addAGIType(address(agiType), 60);
        agiType.mint(agent);
        manager.addAdditionalAgent(agent);
        manager.addAdditionalValidator(validatorA);
        manager.addAdditionalValidator(validatorB);
        manager.setSettlementPaused(false);

        token.mint(employer, 1_000_000_000 ether);
        token.mint(agent, 10_000 ether);
        token.mint(validatorA, 10_000 ether);
        token.mint(validatorB, 10_000 ether);

        vm.prank(employer);
        token.approve(address(manager), type(uint256).max);
        vm.prank(agent);
        token.approve(address(manager), type(uint256).max);
        vm.prank(validatorA);
        token.approve(address(manager), type(uint256).max);
        vm.prank(validatorB);
        token.approve(address(manager), type(uint256).max);
    }

    function testFuzz_createJob_DetailsLengthBoundary(uint16 detailsLen) external {
        bytes memory details = new bytes(bound(detailsLen, 0, 2050));
        vm.prank(employer);
        if (details.length > 2048) {
            vm.expectRevert();
        }
        manager.createJob("ipfs://spec", 1 ether, 1 days, string(details));
    }

    function testFuzz_completionURIBoundary(uint16 completionLen) external {
        vm.prank(employer);
        manager.createJob("ipfs://spec", 10 ether, 1 days, "details");
        uint256 jobId = manager.nextJobId() - 1;

        vm.prank(agent);
        manager.applyForJob(jobId, "", new bytes32[](0));

        bytes memory uri = new bytes(bound(completionLen, 0, 1030));
        vm.prank(agent);
        if (uri.length == 0 || uri.length > 1024) {
            vm.expectRevert();
        }
        manager.requestJobCompletion(jobId, string(uri));
    }

    function testFuzz_validatorThresholdTieBoundary(uint8 approvals, uint8 disapprovals) external {
        uint256 a = bound(approvals, 1, 2);
        uint256 d = bound(disapprovals, 1, 2);
        manager.setRequiredValidatorApprovals(a);
        manager.setRequiredValidatorDisapprovals(d);
        manager.setVoteQuorum(1);

        vm.prank(employer);
        manager.createJob("ipfs://spec", 10 ether, 2 days, "details");
        uint256 jobId = manager.nextJobId() - 1;
        vm.prank(agent);
        manager.applyForJob(jobId, "", new bytes32[](0));
        vm.prank(agent);
        manager.requestJobCompletion(jobId, "ipfs://done");

        vm.prank(validatorA);
        manager.validateJob(jobId, "", new bytes32[](0));
        vm.prank(validatorB);
        manager.disapproveJob(jobId, "", new bytes32[](0));

        (, uint256 validatorApprovals, uint256 validatorDisapprovals,,) = manager.getJobValidation(jobId);
        assertEq(manager.jobValidatorsLength(jobId), validatorApprovals + validatorDisapprovals);
    }
}
