// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-test/harness/AGIJobManagerHarness.sol";
import "contracts/test/MockERC20.sol";
import "contracts/test/FeeOnTransferToken.sol";
import "contracts/test/MockERC721.sol";
import "contracts/test/MockHookCaller.sol";
import "contracts/test/MockENSJobPages.sol";
import "contracts/test/MockENSJobPagesMalformed.sol";
import "contracts/test/MaliciousCompletionReceiver.sol";

contract AGIJobManagerSecurityVerificationTest is Test {
    MockERC20 internal token;
    AGIJobManagerHarness internal manager;
    MockERC721 internal agiType;

    address internal employer = address(0xE1);
    address internal agent = address(0xA1);
    address internal validator = address(0xB1);

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
        manager.addAdditionalValidator(validator);
        manager.setSettlementPaused(false);
        manager.setRequiredValidatorApprovals(1);

        token.mint(employer, 1000 ether);
        token.mint(agent, 1000 ether);
        token.mint(validator, 1000 ether);

        vm.prank(employer);
        token.approve(address(manager), type(uint256).max);
        vm.prank(agent);
        token.approve(address(manager), type(uint256).max);
        vm.prank(validator);
        token.approve(address(manager), type(uint256).max);
    }

    function _createReadyToFinalizeJob(address employerAddr, address agentAddr) internal returns (uint256 jobId) {
        vm.prank(employerAddr);
        manager.createJob("ipfs://spec", 10 ether, 2 days, "details");
        jobId = manager.nextJobId() - 1;

        vm.prank(agentAddr);
        manager.applyForJob(jobId, "", new bytes32[](0));
        vm.prank(agentAddr);
        manager.requestJobCompletion(jobId, "ipfs://done");
        vm.prank(validator);
        manager.validateJob(jobId, "", new bytes32[](0));

        (, uint256 approvedAt) = manager.jobValidatorApprovalState(jobId);
        vm.warp(approvedAt + manager.challengePeriodAfterApproval() + 1);
    }

    function test_ENSSelectorAndCalldataCompatibility() external {
        assertEq(bytes4(keccak256("handleHook(uint8,uint256)")), bytes4(0x1f76f7a2));
        assertEq(bytes4(keccak256("jobEnsURI(uint256)")), bytes4(0x751809b4));

        MockENSJobPages pages = new MockENSJobPages();
        MockHookCaller caller = new MockHookCaller();

        bool successHook = caller.callHandleHookRaw44(address(pages), 1, 77);
        assertTrue(successHook);
        assertEq(pages.lastHandleHookSelector(), bytes4(0x1f76f7a2));
        assertEq(pages.lastHandleHookCalldataLength(), 0x44);

        (bool successUri, bytes memory returndata) = caller.staticcallJobEnsURIRaw24(address(pages), 77);
        assertTrue(successUri);
        string memory decoded = abi.decode(returndata, (string));
        assertGt(bytes(decoded).length, 0);
    }

    function test_FeeOnTransferTokenRevertsExactTransferFlow() external {
        FeeOnTransferToken feeToken = new FeeOnTransferToken(10_000 ether, 500);
        address[2] memory ensConfig = [address(0), address(0)];
        bytes32[4] memory rootNodes;
        bytes32[2] memory merkleRoots;
        AGIJobManagerHarness feeManager =
            new AGIJobManagerHarness(address(feeToken), "", ensConfig, rootNodes, merkleRoots);

        feeToken.transfer(employer, 100 ether);
        vm.prank(employer);
        feeToken.approve(address(feeManager), type(uint256).max);

        vm.prank(employer);
        vm.expectRevert();
        feeManager.createJob("ipfs://spec", 10 ether, 1 days, "details");
    }

    function test_ENSHookRevertAndMalformedURIAreGraceful() external {
        MockENSJobPagesMalformed malformed = new MockENSJobPagesMalformed();
        manager.setEnsJobPages(address(malformed));
        manager.setUseEnsJobTokenURI(true);

        malformed.setRevertOnHook(true);
        uint256 jobId = _createReadyToFinalizeJob(employer, agent);

        malformed.setTokenURIBytes(hex"0001");
        vm.prank(employer);
        manager.finalizeJob(jobId);

        assertTrue(manager.jobEscrowReleased(jobId));
    }

    function test_ReentrancyDuringNFTMintCannotDoubleSettle() external {
        MaliciousCompletionReceiver receiver = new MaliciousCompletionReceiver(address(manager), address(token));

        token.mint(address(receiver), 100 ether);
        agiType.mint(address(receiver));
        manager.addAdditionalAgent(address(receiver));

        vm.prank(address(receiver));
        receiver.createAndFundJob(10 ether, 2 days);
        uint256 jobId = manager.nextJobId() - 1;

        vm.prank(address(receiver));
        receiver.applyAsAgent(jobId);
        vm.prank(address(receiver));
        receiver.requestCompletion(jobId);

        vm.prank(validator);
        manager.validateJob(jobId, "", new bytes32[](0));
        (, uint256 approvedAt) = manager.jobValidatorApprovalState(jobId);
        vm.warp(approvedAt + manager.challengePeriodAfterApproval() + 1);

        vm.prank(address(receiver));
        receiver.finalize(jobId);

        assertEq(receiver.reentryAttempts(), 1);
        assertFalse(receiver.reentrySucceeded());

        vm.expectRevert();
        vm.prank(address(receiver));
        receiver.finalize(jobId);
    }
}
