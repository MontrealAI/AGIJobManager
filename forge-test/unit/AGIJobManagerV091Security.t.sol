// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-test/harness/AGIJobManagerHarness.sol";
import "contracts/test/MockERC20.sol";
import "contracts/test/MockERC721.sol";
import "contracts/utils/ENSOwnership.sol";
import "contracts/ens/ENSJobPages.sol";
import "contracts/test/MockENSRegistry.sol";
import "contracts/test/MockNameWrapper.sol";
import "contracts/test/MockPublicResolver.sol";

contract V091ABIWordSource {
    mapping(bytes4 => uint256) internal words;

    function setWord(bytes4 selector, uint256 word) external {
        words[selector] = word;
    }

    fallback() external {
        uint256 word = words[msg.sig];
        assembly {
            mstore(0, word)
            return(0, 32)
        }
    }
}

contract V091ENSJobPagesHarness is ENSJobPages {
    constructor(address endpoint) ENSJobPages(endpoint, address(0), endpoint, keccak256("jobs-root"), "jobs.eth") {}

    function readAddress(address target) external view returns (bool, address) {
        return _staticcallAddress(target, abi.encodeWithSelector(bytes4(keccak256("owner(bytes32)")), bytes32(0)));
    }
}

contract V091ObservingUSDC is MockERC20 {
    AGIJobManager public manager;
    address public watchedValidator;
    uint256 public watchedJob;
    uint256 public observedReputation;
    uint256 public observedOtherReputation;
    address public otherValidator;
    uint256 public callbacks;
    bool public reentrySucceeded;
    bool public rejectTransfer;

    function watch(AGIJobManager manager_, address validator_, uint256 job_, bool reject_) external {
        manager = manager_;
        watchedValidator = validator_;
        watchedJob = job_;
        rejectTransfer = reject_;
    }

    function watchOther(address other) external {
        otherValidator = other;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (msg.sender == address(manager) && to == watchedValidator) {
            ++callbacks;
            observedReputation = manager.reputation(to);
            observedOtherReputation = manager.reputation(otherValidator);
            (reentrySucceeded,) = address(manager).call(abi.encodeCall(AGIJobManager.finalizeJob, (watchedJob)));
            if (rejectTransfer) return false;
        }
        return super.transfer(to, amount);
    }
}

contract V091ERC165Response {
    uint256 internal erc165Word = 1;
    uint256 internal erc721Word = 1;
    uint256 internal invalidWord;

    function configure(uint256 erc165_, uint256 erc721_, uint256 invalid_) external {
        erc165Word = erc165_;
        erc721Word = erc721_;
        invalidWord = invalid_;
    }

    function supportsInterface(bytes4 interfaceId) external view returns (bool) {
        uint256 word = interfaceId == 0x01ffc9a7 ? erc165Word : interfaceId == 0x80ac58cd ? erc721Word : invalidWord;
        assembly {
            mstore(0, word)
            return(0, 32)
        }
    }
}

contract AGIJobManagerV091SecurityTest is Test {
    address internal constant EMPLOYER = address(0xE1);
    address internal constant AGENT = address(0xA1);
    address internal constant VALIDATOR = address(0xB1);
    bytes4 internal constant OWNER_OF = 0x6352211e;
    bytes4 internal constant GET_APPROVED = 0x081812fc;
    bytes4 internal constant RESOLVER = 0x0178b8bf;
    bytes4 internal constant ADDR = 0x3b3b57de;
    bytes4 internal constant ENS_OWNER = 0x02571be3;

    function testFuzz_RejectsMalformedWrapperOwnerAddress(uint96 upper, address claimant) external {
        vm.assume(upper != 0 && claimant != address(0));
        V091ABIWordSource wrapper = new V091ABIWordSource();
        uint256 canonical = uint256(uint160(claimant));
        wrapper.setWord(OWNER_OF, canonical | (uint256(upper) << 160));
        assertFalse(
            ENSOwnership.verifyENSOwnership(address(0), address(wrapper), claimant, "alice", bytes32(uint256(1)))
        );
        wrapper.setWord(OWNER_OF, canonical);
        assertTrue(
            ENSOwnership.verifyENSOwnership(address(0), address(wrapper), claimant, "alice", bytes32(uint256(1)))
        );
    }

    function test_RejectsMalformedApprovedAddress() external {
        V091ABIWordSource wrapper = new V091ABIWordSource();
        wrapper.setWord(OWNER_OF, uint256(uint160(EMPLOYER)));
        wrapper.setWord(GET_APPROVED, (uint256(1) << 160) | uint256(uint160(AGENT)));
        assertFalse(ENSOwnership.verifyENSOwnership(address(0), address(wrapper), AGENT, "alice", bytes32(uint256(1))));
        wrapper.setWord(GET_APPROVED, uint256(uint160(AGENT)));
        assertTrue(ENSOwnership.verifyENSOwnership(address(0), address(wrapper), AGENT, "alice", bytes32(uint256(1))));
    }

    function test_RejectsMalformedResolverAndResolvedAddress() external {
        V091ABIWordSource registry = new V091ABIWordSource();
        V091ABIWordSource resolver = new V091ABIWordSource();
        uint256 resolverAddress = uint256(uint160(address(resolver)));
        registry.setWord(RESOLVER, resolverAddress | (uint256(1) << 160));
        resolver.setWord(ADDR, uint256(uint160(AGENT)));
        assertFalse(ENSOwnership.verifyENSOwnership(address(registry), address(0), AGENT, "alice", bytes32(uint256(1))));
        registry.setWord(RESOLVER, resolverAddress);
        resolver.setWord(ADDR, uint256(uint160(AGENT)) | (uint256(1) << 160));
        assertFalse(ENSOwnership.verifyENSOwnership(address(registry), address(0), AGENT, "alice", bytes32(uint256(1))));
        resolver.setWord(ADDR, uint256(uint160(AGENT)));
        assertTrue(ENSOwnership.verifyENSOwnership(address(registry), address(0), AGENT, "alice", bytes32(uint256(1))));
    }

    function testFuzz_JobPageAddressDecodeRejectsDirtyUpperBits(uint96 upper, address candidate) external {
        vm.assume(upper != 0);
        V091ABIWordSource endpoint = new V091ABIWordSource();
        V091ENSJobPagesHarness pages = new V091ENSJobPagesHarness(address(endpoint));
        endpoint.setWord(ENS_OWNER, uint256(uint160(candidate)) | (uint256(upper) << 160));
        (bool ok, address decoded) = pages.readAddress(address(endpoint));
        assertFalse(ok);
        assertEq(decoded, address(0));
        endpoint.setWord(ENS_OWNER, uint256(uint160(candidate)));
        (ok, decoded) = pages.readAddress(address(endpoint));
        assertTrue(ok);
        assertEq(decoded, candidate);
    }

    function test_ValidatorReputationIsCommittedBeforeTransferAndReentryFails() external {
        (V091ObservingUSDC token, AGIJobManagerHarness manager, uint256 id) = _readyJob();
        address secondValidator = address(0xB2);
        manager.addAdditionalValidator(secondValidator);
        token.mint(secondValidator, 1000e6);
        vm.prank(secondValidator);
        token.approve(address(manager), type(uint256).max);
        vm.prank(secondValidator);
        manager.validateJob(id, "", new bytes32[](0));
        token.watchOther(secondValidator);
        token.watch(manager, VALIDATOR, id, false);
        manager.finalizeJob(id);
        assertEq(token.callbacks(), 1);
        assertGt(token.observedReputation(), 0);
        assertEq(token.observedReputation(), manager.reputation(VALIDATOR));
        assertGt(token.observedOtherReputation(), 0);
        assertEq(token.observedOtherReputation(), manager.reputation(secondValidator));
        assertFalse(token.reentrySucceeded());
        assertTrue(manager.jobEscrowReleased(id));
    }

    function test_RejectedTransferRollsBackReputationAndPermitsCleanRetry() external {
        (V091ObservingUSDC token, AGIJobManagerHarness manager, uint256 id) = _readyJob();
        uint256 reserves = manager.lockedEscrow() + manager.lockedAgentBonds() + manager.lockedValidatorBonds();
        uint256 balance = token.balanceOf(address(manager));
        token.watch(manager, VALIDATOR, id, true);
        vm.expectRevert(AGIJobManager.TransferFailed.selector);
        manager.finalizeJob(id);
        assertEq(manager.reputation(VALIDATOR), 0);
        assertEq(token.callbacks(), 0);
        assertFalse(manager.jobEscrowReleased(id));
        assertEq(manager.lockedEscrow() + manager.lockedAgentBonds() + manager.lockedValidatorBonds(), reserves);
        assertEq(token.balanceOf(address(manager)), balance);
        token.watch(manager, VALIDATOR, id, false);
        manager.finalizeJob(id);
        assertTrue(manager.jobEscrowReleased(id));
        assertGt(manager.reputation(VALIDATOR), 0);
    }

    function test_ERC721RegistrationRequiresCanonicalERC165Responses() external {
        (, AGIJobManagerHarness manager,) = _readyJob();
        V091ERC165Response credential = new V091ERC165Response();
        uint256[3][4] memory invalid = [[uint256(2), 1, 0], [uint256(1), 2, 0], [uint256(1), 1, 1], [uint256(1), 1, 2]];
        for (uint256 i; i < invalid.length; ++i) {
            credential.configure(invalid[i][0], invalid[i][1], invalid[i][2]);
            vm.expectRevert(AGIJobManager.InvalidParameters.selector);
            manager.addAGIType(address(credential), 60);
        }
        credential.configure(1, 1, 0);
        manager.addAGIType(address(credential), 60);
    }

    function test_OwnerJobLimitChangesEmitOldAndNewValues() external {
        (, AGIJobManagerHarness manager,) = _readyJob();
        uint256 oldPayout = manager.maxJobPayout();
        uint256 oldDuration = manager.jobDurationLimit();
        vm.recordLogs();
        manager.setMaxJobPayout(150e6);
        manager.setJobDurationLimit(2 days);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 2);
        assertEq(logs[0].emitter, address(manager));
        assertEq(logs[0].topics[0], keccak256("MaxJobPayoutUpdated(uint256,uint256)"));
        assertEq(logs[0].topics[1], bytes32(oldPayout));
        assertEq(logs[0].topics[2], bytes32(uint256(150e6)));
        assertEq(logs[1].emitter, address(manager));
        assertEq(logs[1].topics[0], keccak256("JobDurationLimitUpdated(uint256,uint256)"));
        assertEq(logs[1].topics[1], bytes32(oldDuration));
        assertEq(logs[1].topics[2], bytes32(uint256(2 days)));
    }

    function test_JobPageRejectsMismatchedWrapperReturnAndAllowsCorrectRetry() external {
        MockENSRegistry registry = new MockENSRegistry();
        MockNameWrapper wrapper = new MockNameWrapper();
        MockPublicResolver resolver = new MockPublicResolver();
        bytes32 root = keccak256("jobs-root");
        ENSJobPages pages = new ENSJobPages(address(registry), address(wrapper), address(resolver), root, "jobs.eth");
        registry.setOwner(root, address(wrapper));
        wrapper.setOwner(uint256(root), address(pages));
        wrapper.setENSRegistry(address(registry));
        bytes32 expectedNode = keccak256(abi.encodePacked(root, keccak256("agijob1")));
        bytes memory callData = abi.encodeCall(
            INameWrapperSubnameOwner.setSubnodeOwner, (root, "agijob1", address(pages), 0, type(uint64).max)
        );
        vm.mockCall(address(wrapper), callData, abi.encode(bytes32(uint256(1))));
        vm.expectRevert(ENSJobPages.InvalidParameters.selector);
        pages.createJobPage(1, EMPLOYER, "ipfs://spec");
        assertEq(registry.owner(expectedNode), address(0));
        vm.clearMockedCalls();
        pages.createJobPage(1, EMPLOYER, "ipfs://spec");
        assertEq(wrapper.ownerOf(uint256(expectedNode)), address(pages));
        assertEq(registry.owner(expectedNode), address(wrapper));
    }

    function _readyJob() internal returns (V091ObservingUSDC token, AGIJobManagerHarness manager, uint256 id) {
        token = new V091ObservingUSDC();
        address[2] memory ens;
        bytes32[4] memory roots;
        bytes32[2] memory merkle;
        manager = new AGIJobManagerHarness(address(token), "", ens, roots, merkle);
        MockERC721 credential = new MockERC721();
        manager.addAGIType(address(credential), 60);
        credential.mint(AGENT);
        manager.addAdditionalAgent(AGENT);
        manager.addAdditionalValidator(VALIDATOR);
        manager.setRequiredValidatorApprovals(1);
        address[3] memory actors = [EMPLOYER, AGENT, VALIDATOR];
        for (uint256 i; i < actors.length; ++i) {
            token.mint(actors[i], 1000e6);
            vm.prank(actors[i]);
            token.approve(address(manager), type(uint256).max);
        }
        id = manager.nextJobId();
        vm.prank(EMPLOYER);
        manager.createJob("ipfs://spec", 100e6, 2 days, "review evidence");
        vm.prank(AGENT);
        manager.applyForJob(id, "", new bytes32[](0));
        vm.prank(AGENT);
        manager.requestJobCompletion(id, "ipfs://completion");
        vm.prank(VALIDATOR);
        manager.validateJob(id, "", new bytes32[](0));
        (, uint256 approvedAt) = manager.jobValidatorApprovalState(id);
        vm.warp(approvedAt + manager.challengePeriodAfterApproval() + 1);
    }
}
