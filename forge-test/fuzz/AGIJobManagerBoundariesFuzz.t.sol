// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-test/harness/AGIJobManagerHarness.sol";
import "contracts/test/MockERC20.sol";
import "contracts/test/MockERC721.sol";

contract AGIJobManagerBoundariesFuzz is Test {
    AGIJobManagerHarness internal manager;
    MockERC20 internal token;
    address internal employer = address(0x111);
    address internal agent = address(0x222);
    address internal v1 = address(0x333);
    address internal v2 = address(0x334);

    function setUp() external {
        token = new MockERC20();
        address[2] memory ensConfig = [address(0), address(0)];
        bytes32[4] memory rootNodes;
        bytes32[2] memory merkleRoots;
        manager = new AGIJobManagerHarness(address(token), "", ensConfig, rootNodes, merkleRoots);

        token.mint(employer, 1_000_000 ether);
        token.mint(agent, 1_000_000 ether);
        token.mint(v1, 1_000_000 ether);
        token.mint(v2, 1_000_000 ether);
        vm.prank(employer);
        token.approve(address(manager), type(uint256).max);
        vm.prank(agent);
        token.approve(address(manager), type(uint256).max);
        vm.prank(v1);
        token.approve(address(manager), type(uint256).max);
        vm.prank(v2);
        token.approve(address(manager), type(uint256).max);

        MockERC721 agiType = new MockERC721();
        vm.startPrank(manager.owner());
        manager.addAdditionalAgent(agent);
        manager.addAdditionalValidator(v1);
        manager.addAdditionalValidator(v2);
        manager.addAGIType(address(agiType), 80);
        agiType.mint(agent);
        manager.setSettlementPaused(false);
        manager.setRequiredValidatorApprovals(2);
        manager.setRequiredValidatorDisapprovals(2);
        manager.setVoteQuorum(2);
        vm.stopPrank();
    }

    function _createApplyAndRequest(uint256 payout, uint256 duration) internal returns (uint256 jobId) {
        vm.prank(employer);
        manager.createJob("ipfs://spec", payout, duration, "details");
        jobId = manager.nextJobId() - 1;
        vm.prank(agent);
        manager.applyForJob(jobId, "", new bytes32[](0));
        vm.prank(agent);
        manager.requestJobCompletion(jobId, "ipfs://done");
    }

    function testFuzz_jobParamBoundaries(uint256 payoutSeed, uint256 durationSeed) external {
        uint256 payout = bound(payoutSeed, 1, 1_000_000 ether);
        uint256 duration = bound(durationSeed, 1, manager.jobDurationLimit());

        vm.prank(employer);
        manager.createJob("ipfs://spec", payout, duration, "details");

        uint256 maxPayout = manager.maxJobPayout();
        vm.prank(employer);
        vm.expectRevert();
        manager.createJob("ipfs://spec", maxPayout + 1, duration, "details");

        uint256 maxDuration = manager.jobDurationLimit();
        vm.prank(employer);
        vm.expectRevert();
        manager.createJob("ipfs://spec", payout, maxDuration + 1, "details");
    }

    function testFuzz_uriLengthBoundaries(uint16 specLenSeed, uint16 completionLenSeed, uint16 baseLenSeed) external {
        uint256 specLen = bound(uint256(specLenSeed), 1, 2300);
        uint256 completionLen = bound(uint256(completionLenSeed), 1, 1300);
        uint256 baseLen = bound(uint256(baseLenSeed), 0, 700);

        string memory spec = string(abi.encodePacked("ipfs://", _repeat("a", specLen)));
        string memory completion = string(abi.encodePacked("ipfs://", _repeat("b", completionLen)));
        string memory base = string(abi.encodePacked("ipfs://", _repeat("c", baseLen)));

        vm.startPrank(manager.owner());
        if (bytes(base).length <= 512) {
            manager.setBaseIpfsUrl(base);
        } else {
            vm.expectRevert();
            manager.setBaseIpfsUrl(base);
        }
        vm.stopPrank();

        vm.prank(employer);
        if (bytes(spec).length <= 2048) {
            manager.createJob(spec, 10 ether, 1 days, "");
            uint256 jobId = manager.nextJobId() - 1;
            vm.prank(agent);
            manager.applyForJob(jobId, "", new bytes32[](0));
            vm.prank(agent);
            if (bytes(completion).length <= 1024) {
                manager.requestJobCompletion(jobId, completion);
            } else {
                vm.expectRevert();
                manager.requestJobCompletion(jobId, completion);
            }
        } else {
            vm.expectRevert();
            manager.createJob(spec, 10 ether, 1 days, "");
        }
    }

    function testFuzz_voteTieAndThresholdBoundary(uint256 payoutSeed, uint256 durationSeed) external {
        uint256 payout = bound(payoutSeed, 10 ether, 1000 ether);
        uint256 duration = bound(durationSeed, 1 days, 7 days);
        uint256 jobId = _createApplyAndRequest(payout, duration);

        vm.prank(v1);
        manager.validateJob(jobId, "", new bytes32[](0));
        vm.prank(v2);
        manager.disapproveJob(jobId, "", new bytes32[](0));

        (, uint256 approvals, uint256 disapprovals,,) = manager.getJobValidation(jobId);
        assertEq(approvals, disapprovals);
        assertEq(manager.jobValidatorsLength(jobId), approvals + disapprovals);
    }

    function _repeat(string memory c, uint256 count) internal pure returns (string memory out) {
        bytes memory input = bytes(c);
        bytes memory buf = new bytes(count);
        for (uint256 i = 0; i < count; i++) {
            buf[i] = input[0];
        }
        out = string(buf);
    }
}
