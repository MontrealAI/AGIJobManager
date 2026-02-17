// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-test/harness/AGIJobManagerHarness.sol";
import "contracts/test/MockERC20.sol";
import "contracts/test/MockERC721.sol";
import "contracts/test/MockENSJobPages.sol";
import "contracts/test/MockENSJobPagesMalformed.sol";
import "contracts/test/FeeOnTransferToken.sol";
import "contracts/test/ReenteringEmployer.sol";

contract AGIJobManagerSecurityRegression is Test {
    AGIJobManagerHarness internal manager;
    MockERC20 internal token;
    MockENSJobPages internal ensPages;

    address internal employer = address(0xE1);
    address internal agent = address(0xA1);
    address internal validator = address(0xB1);

    function setUp() external {
        token = new MockERC20();
        ensPages = new MockENSJobPages();
        address[2] memory ensConfig = [address(0), address(ensPages)];
        bytes32[4] memory rootNodes;
        bytes32[2] memory merkleRoots;
        manager = new AGIJobManagerHarness(address(token), "", ensConfig, rootNodes, merkleRoots);

        token.mint(employer, 1_000_000 ether);
        token.mint(agent, 1_000_000 ether);
        token.mint(validator, 1_000_000 ether);

        vm.prank(employer);
        token.approve(address(manager), type(uint256).max);
        vm.prank(agent);
        token.approve(address(manager), type(uint256).max);
        vm.prank(validator);
        token.approve(address(manager), type(uint256).max);

        MockERC721 agiType = new MockERC721();
        vm.startPrank(manager.owner());
        manager.addAGIType(address(agiType), 60);
        agiType.mint(agent);
        manager.addAdditionalAgent(agent);
        manager.addAdditionalValidator(validator);
        manager.setRequiredValidatorApprovals(1);
        manager.setSettlementPaused(false);
        vm.stopPrank();
    }

    function _createAssignAndRequest() internal returns (uint256 jobId) {
        vm.prank(employer);
        manager.createJob("ipfs://spec", 10 ether, 2 days, "");
        jobId = manager.nextJobId() - 1;
        vm.prank(agent);
        manager.applyForJob(jobId, "", new bytes32[](0));
        vm.prank(agent);
        manager.requestJobCompletion(jobId, "ipfs://done");
    }

    function test_ensSelectorsAndLowLevelCalldataCompatibility() external {
        assertEq(bytes4(keccak256("handleHook(uint8,uint256)")), bytes4(0x1f76f7a2));
        assertEq(bytes4(keccak256("jobEnsURI(uint256)")), bytes4(0x751809b4));

        (bool okHook,) = address(ensPages).call(abi.encodeWithSelector(bytes4(0x1f76f7a2), uint8(2), uint256(7)));
        assertTrue(okHook);
        assertEq(ensPages.lastHandleHookCalldataLength(), 0x44);
        assertEq(ensPages.lastHandleHookSelector(), bytes4(0x1f76f7a2));

        bytes memory payload = abi.encodeWithSelector(bytes4(0x751809b4), uint256(7));
        assertEq(payload.length, 0x24);
        (bool okUri, bytes memory ret) = address(ensPages).staticcall(payload);
        assertTrue(okUri);
        assertEq(abi.decode(ret, (string)), "ens://job-7.alpha.jobs.agi.eth");
    }

    function test_feeOnTransferRevertsOnExactTransfer() external {
        FeeOnTransferToken fee = new FeeOnTransferToken(1_000_000 ether, 100);
        address[2] memory ensConfig = [address(0), address(0)];
        bytes32[4] memory rootNodes;
        bytes32[2] memory merkleRoots;
        AGIJobManagerHarness feeManager = new AGIJobManagerHarness(address(fee), "", ensConfig, rootNodes, merkleRoots);

        fee.transfer(employer, 1_000 ether);
        vm.prank(employer);
        fee.approve(address(feeManager), type(uint256).max);

        vm.prank(employer);
        vm.expectRevert();
        feeManager.createJob("ipfs://spec", 10 ether, 1 days, "");
    }

    function test_ensHookRevertsAndInvalidUriDoNotBrickCoreFlow() external {
        vm.prank(manager.owner());
        ensPages.setRevertHook(ensPages.HOOK_ASSIGN(), true);

        uint256 jobId = _createAssignAndRequest();
        assertEq(manager.jobAssignedAgent(jobId), agent);

        MockENSJobPagesMalformed malformed = new MockENSJobPagesMalformed();
        vm.prank(manager.owner());
        manager.setEnsJobPages(address(malformed));
        vm.prank(manager.owner());
        manager.setUseEnsJobTokenURI(true);

        bytes memory invalidAbi = abi.encodePacked(uint256(0x40), uint256(0xFFFF));
        malformed.setTokenURIBytes(invalidAbi);

        vm.prank(validator);
        manager.validateJob(jobId, "", new bytes32[](0));
        vm.warp(block.timestamp + manager.challengePeriodAfterApproval() + 1);
        manager.finalizeJob(jobId);

        assertEq(manager.ownerOf(0), employer);
        assertEq(manager.tokenURI(0), "ipfs://done");
    }

    function test_reentrancyDuringMintPathDoesNotDoubleSettle() external {
        ReenteringEmployer reenter = new ReenteringEmployer(address(manager), address(token));
        token.mint(address(reenter), 500 ether);

        vm.prank(address(reenter));
        reenter.createJob("ipfs://spec", 10 ether, 2 days, "");
        uint256 jobId = manager.nextJobId() - 1;
        reenter.setJobId(jobId);

        vm.prank(agent);
        manager.applyForJob(jobId, "", new bytes32[](0));
        vm.prank(agent);
        manager.requestJobCompletion(jobId, "ipfs://done");
        vm.prank(validator);
        manager.validateJob(jobId, "", new bytes32[](0));

        uint256 lockedBefore = manager.lockedEscrow();
        vm.warp(block.timestamp + manager.challengePeriodAfterApproval() + 1);
        manager.finalizeJob(jobId);

        assertFalse(reenter.reentered());
        assertLt(manager.lockedEscrow(), lockedBefore);

        vm.expectRevert();
        manager.finalizeJob(jobId);
    }
}
