// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-test/harness/AGIJobManagerHarness.sol";
import "forge-test/harness/ReentrantFinalizeReceiver.sol";
import "contracts/test/MockERC20.sol";
import "contracts/test/FeeOnTransferToken.sol";
import "contracts/test/MockERC721.sol";
import "contracts/test/MockENSJobPages.sol";
import "contracts/test/MockENSJobPagesMalformed.sol";

contract AGIJobManagerSecurityVerification is Test {
    AGIJobManagerHarness internal manager;
    MockERC20 internal token;
    MockENSJobPages internal ensPages;

    address internal employer = address(0xA11CE);
    address internal agent = address(0xB0B);
    address internal validator = address(0xCAFE);

    function setUp() external {
        token = new MockERC20();
        address[2] memory ensConfig = [address(0), address(0)];
        bytes32[4] memory rootNodes;
        bytes32[2] memory merkleRoots;
        manager = new AGIJobManagerHarness(address(token), "", ensConfig, rootNodes, merkleRoots);
        ensPages = new MockENSJobPages();

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
        manager.addAdditionalAgent(agent);
        manager.addAdditionalValidator(validator);
        manager.addAGIType(address(agiType), 80);
        agiType.mint(agent);
        manager.setSettlementPaused(false);
        manager.setRequiredValidatorApprovals(1);
        manager.setVoteQuorum(1);
        manager.setEnsJobPages(address(ensPages));
        vm.stopPrank();
    }

    function _createAssignedCompletedJob(address _employer, address _agent) internal returns (uint256 jobId) {
        vm.prank(_employer);
        manager.createJob("ipfs://spec", 100 ether, 3 days, "details");
        jobId = manager.nextJobId() - 1;

        vm.prank(_agent);
        manager.applyForJob(jobId, "", new bytes32[](0));

        vm.prank(_agent);
        manager.requestJobCompletion(jobId, "ipfs://completion");

        vm.prank(validator);
        manager.validateJob(jobId, "", new bytes32[](0));

        (, uint256 approvedAt) = manager.jobValidatorApprovalState(jobId);
        vm.warp(approvedAt + manager.challengePeriodAfterApproval() + 1);
    }

    function test_ensSelectorAndCalldataCompatibility() external {
        assertEq(bytes4(keccak256("handleHook(uint8,uint256)")), bytes4(0x1f76f7a2));
        assertEq(bytes4(keccak256("jobEnsURI(uint256)")), bytes4(0x751809b4));

        (bool okHook,) = address(ensPages).call(abi.encodeWithSelector(bytes4(0x1f76f7a2), uint8(3), uint256(42)));
        assertTrue(okHook);
        assertEq(ensPages.lastHandleHookSelector(), bytes4(0x1f76f7a2));
        assertEq(ensPages.lastHandleHookCalldataLength(), 0x44);

        (bool okUri, bytes memory uriRet) =
            address(ensPages).staticcall(abi.encodeWithSelector(bytes4(0x751809b4), uint256(42)));
        assertTrue(okUri);
        assertTrue(uriRet.length >= 64);
        string memory uri = abi.decode(uriRet, (string));
        assertGt(bytes(uri).length, 0);
    }

    function test_feeOnTransferTokenRevertsOnExactTransferFlow() external {
        FeeOnTransferToken feeToken = new FeeOnTransferToken(2_000_000 ether, 500);
        address[2] memory ensConfig = [address(0), address(0)];
        bytes32[4] memory rootNodes;
        bytes32[2] memory merkleRoots;
        AGIJobManagerHarness managerFee =
            new AGIJobManagerHarness(address(feeToken), "", ensConfig, rootNodes, merkleRoots);

        feeToken.transfer(employer, 1000 ether);
        vm.prank(employer);
        feeToken.approve(address(managerFee), type(uint256).max);

        vm.prank(employer);
        vm.expectRevert();
        managerFee.createJob("ipfs://spec", 100 ether, 1 days, "");
    }

    function test_revertingEnsHookDoesNotBrickCoreFlow() external {
        ensPages.setRevertHook(1, true);
        vm.prank(employer);
        manager.createJob("ipfs://spec", 25 ether, 2 days, "");

        uint256 jobId = manager.nextJobId() - 1;
        vm.prank(agent);
        manager.applyForJob(jobId, "", new bytes32[](0));

        ensPages.setRevertHook(3, true);
        vm.prank(agent);
        manager.requestJobCompletion(jobId, "ipfs://done");

        ensPages.setRevertHook(4, true);
        vm.prank(validator);
        manager.validateJob(jobId, "", new bytes32[](0));

        (, uint256 approvedAt) = manager.jobValidatorApprovalState(jobId);
        vm.warp(approvedAt + manager.challengePeriodAfterApproval() + 1);
        manager.finalizeJob(jobId);

        (,,,,, bool completed,,,) = manager.getJobCore(jobId);
        assertTrue(completed);
    }

    function test_invalidEnsTokenURIIsIgnored() external {
        MockENSJobPagesMalformed malformed = new MockENSJobPagesMalformed();
        malformed.setTokenURIBytes(hex"0001");

        vm.startPrank(manager.owner());
        manager.setEnsJobPages(address(malformed));
        manager.setUseEnsJobTokenURI(true);
        vm.stopPrank();

        uint256 jobId = _createAssignedCompletedJob(employer, agent);
        manager.finalizeJob(jobId);

        string memory mintedUri = manager.tokenURI(0);
        assertEq(mintedUri, "ipfs://completion");
    }

    function test_reentrancyDuringMintCannotDoubleSettle() external {
        ReentrantFinalizeReceiver receiver = new ReentrantFinalizeReceiver(address(manager));
        token.mint(address(receiver), 1000 ether);
        vm.prank(address(receiver));
        token.approve(address(manager), type(uint256).max);

        uint256 jobId = _createAssignedCompletedJob(address(receiver), agent);
        receiver.setReentryJobId(jobId);

        uint256 beforeAgent = token.balanceOf(agent);
        manager.finalizeJob(jobId);

        assertTrue(receiver.attempted());
        assertFalse(receiver.reentrySucceeded());

        vm.expectRevert();
        manager.finalizeJob(jobId);

        uint256 afterAgent = token.balanceOf(agent);
        assertGt(afterAgent, beforeAgent);
        assertEq(manager.lockedEscrow(), 0);
    }
}
