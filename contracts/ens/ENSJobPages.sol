// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

interface IENSRegistry {
    function owner(bytes32 node) external view returns (address);
    function setSubnodeRecord(bytes32 node, bytes32 label, address owner, address resolver, uint64 ttl) external;
}

interface IPublicResolver {
    function setAuthorisation(bytes32 node, address target, bool isAuthorised) external;
    function setText(bytes32 node, string calldata key, string calldata value) external;
}

interface INameWrapper {
    function ownerOf(uint256 id) external view returns (address);
    function isApprovedForAll(address account, address operator) external view returns (bool);
    function isWrapped(bytes32 node) external view returns (bool);
    function setSubnodeRecord(
        bytes32 node,
        bytes32 label,
        address owner,
        address resolver,
        uint64 ttl,
        uint32 fuses,
        uint64 expiry
    ) external returns (bytes32);
    function setFuses(bytes32 node, uint32 fuses) external returns (uint32);
}

interface IJobURIProvider {
    function getJobSpecURI(uint256 jobId) external view returns (string memory);
    function getJobCompletionURI(uint256 jobId) external view returns (string memory);
}

interface IJobInfoProvider {
    function getJobCore(uint256 jobId)
        external
        view
        returns (
            address employer,
            address assignedAgent,
            uint256 payout,
            uint256 duration,
            uint256 assignedAt,
            bool completed,
            bool disputed,
            bool expired,
            uint8 agentPayoutPct
        );
}

interface IJobValidationProvider {
    function getJobValidation(uint256 jobId)
        external
        view
        returns (
            bool completionRequested,
            uint256 validatorApprovals,
            uint256 validatorDisapprovals,
            uint256 completionRequestedAt,
            uint256 disputedAt
        );
}

contract ENSJobPages is Ownable {
    using Strings for uint256;

    error InvalidConfiguration();
    error InvalidHookAction();
    error InvalidState();
    error NotController();
    error NotRootOwner();

    IENSRegistry public ens;
    INameWrapper public nameWrapper;
    IPublicResolver public publicResolver;
    bytes32 public jobsRootNode;
    string public jobsRootName;
    address public controller;

    event ENSControllerUpdated(address indexed controller);
    event ENSRegistryUpdated(address indexed ens);
    event ENSNameWrapperUpdated(address indexed nameWrapper);
    event ENSPublicResolverUpdated(address indexed publicResolver);
    event ENSJobsRootNodeUpdated(bytes32 indexed jobsRootNode);
    event ENSJobsRootNameUpdated(string jobsRootName);
    event JobENSPageCreated(uint256 indexed jobId, bytes32 indexed node);
    event JobENSPermissionsUpdated(uint256 indexed jobId, address indexed account, bool isAuthorised);
    event JobENSLocked(uint256 indexed jobId, bytes32 indexed node, bool fusesBurned);

    uint8 private constant HOOK_CREATE = 1;
    uint8 private constant HOOK_ASSIGN = 2;
    uint8 private constant HOOK_COMPLETION = 3;
    uint8 private constant HOOK_REVOKE = 4;

    modifier onlyController() {
        if (msg.sender != controller) revert NotController();
        _;
    }

    function setController(address newController) external onlyOwner {
        if (newController == address(0)) revert InvalidConfiguration();
        controller = newController;
        emit ENSControllerUpdated(newController);
    }

    function setENSRegistry(address newEns) external onlyOwner {
        if (newEns == address(0)) revert InvalidConfiguration();
        ens = IENSRegistry(newEns);
        emit ENSRegistryUpdated(newEns);
    }

    function setNameWrapper(address newNameWrapper) external onlyOwner {
        nameWrapper = INameWrapper(newNameWrapper);
        emit ENSNameWrapperUpdated(newNameWrapper);
    }

    function setPublicResolver(address newResolver) external onlyOwner {
        if (newResolver == address(0)) revert InvalidConfiguration();
        publicResolver = IPublicResolver(newResolver);
        emit ENSPublicResolverUpdated(newResolver);
    }

    function setJobsRootNode(bytes32 newRootNode) external onlyOwner {
        if (newRootNode == bytes32(0)) revert InvalidConfiguration();
        jobsRootNode = newRootNode;
        emit ENSJobsRootNodeUpdated(newRootNode);
    }

    function setJobsRootName(string calldata newRootName) external onlyOwner {
        if (bytes(newRootName).length == 0) revert InvalidConfiguration();
        jobsRootName = newRootName;
        emit ENSJobsRootNameUpdated(newRootName);
    }


    function hook(uint8 action, uint256 jobId) external onlyController {
        if (action == HOOK_CREATE) {
            _hookCreate(jobId);
            return;
        }
        if (action == HOOK_ASSIGN) {
            _hookAssign(jobId);
            return;
        }
        if (action == HOOK_COMPLETION) {
            _hookCompletion(jobId);
            return;
        }
        if (action == HOOK_REVOKE) {
            _hookRevoke(jobId);
            return;
        }
        revert InvalidHookAction();
    }

    function jobEnsLabel(uint256 jobId) public pure returns (string memory) {
        return string(abi.encodePacked("job-", jobId.toString()));
    }

    function jobEnsName(uint256 jobId) external view returns (string memory) {
        if (bytes(jobsRootName).length == 0) revert InvalidConfiguration();
        return string(abi.encodePacked(jobEnsLabel(jobId), ".", jobsRootName));
    }

    function jobEnsURI(uint256 jobId) external view returns (string memory) {
        if (bytes(jobsRootName).length == 0) revert InvalidConfiguration();
        return string(abi.encodePacked("ens://", jobEnsLabel(jobId), ".", jobsRootName));
    }

    function jobEnsNode(uint256 jobId) public view returns (bytes32) {
        if (jobsRootNode == bytes32(0)) revert InvalidConfiguration();
        bytes32 labelHash = keccak256(bytes(jobEnsLabel(jobId)));
        return keccak256(abi.encodePacked(jobsRootNode, labelHash));
    }

    function createJobPage(uint256 jobId) external onlyController {
        (address employer, , , , , , , , ) = IJobInfoProvider(controller).getJobCore(jobId);
        string memory specURI = IJobURIProvider(controller).getJobSpecURI(jobId);
        _createJobPage(jobId, employer, specURI);
    }

    function createJobPage(uint256 jobId, address employer) external onlyController {
        string memory specURI = IJobURIProvider(controller).getJobSpecURI(jobId);
        _createJobPage(jobId, employer, specURI);
    }

    function createJobPage(uint256 jobId, address employer, string calldata specURI) external onlyController {
        _createJobPage(jobId, employer, specURI);
    }

    function _createJobPage(uint256 jobId, address employer, string memory specURI) internal {
        _requireConfigured();
        bytes32 labelHash = keccak256(bytes(jobEnsLabel(jobId)));
        bytes32 node = keccak256(abi.encodePacked(jobsRootNode, labelHash));
        address rootOwner = ens.owner(jobsRootNode);
        if (rootOwner == address(nameWrapper) && address(nameWrapper) != address(0)) {
            _requireWrappedRootPermission();
            nameWrapper.setSubnodeRecord(
                jobsRootNode,
                labelHash,
                address(this),
                address(publicResolver),
                0,
                0,
                type(uint64).max
            );
        } else {
            if (rootOwner != address(this)) revert NotRootOwner();
            ens.setSubnodeRecord(jobsRootNode, labelHash, address(this), address(publicResolver), 0);
        }
        emit JobENSPageCreated(jobId, node);
        publicResolver.setAuthorisation(node, employer, true);
        emit JobENSPermissionsUpdated(jobId, employer, true);
        _setTextBestEffort(node, "schema", "agijobmanager/v1");
        _setTextBestEffort(node, "agijobs.spec.public", specURI);
    }

    function onAgentAssigned(uint256 jobId, address agent) external onlyController {
        _assignAgent(jobId, agent);
    }

    function onAgentAssigned(uint256 jobId) external onlyController {
        (, address agent, , , , , , , ) = IJobInfoProvider(controller).getJobCore(jobId);
        _assignAgent(jobId, agent);
    }

    function onCompletionRequested(uint256 jobId) external onlyController {
        string memory completionURI = IJobURIProvider(controller).getJobCompletionURI(jobId);
        _setCompletionText(jobId, completionURI);
    }

    function onCompletionRequested(uint256 jobId, string calldata completionURI) external onlyController {
        _setCompletionText(jobId, completionURI);
    }

    function mirrorCompletion(uint256 jobId) external {
        (bool completionRequested, , , , ) = IJobValidationProvider(controller).getJobValidation(jobId);
        if (!completionRequested) revert InvalidState();
        string memory completionURI = IJobURIProvider(controller).getJobCompletionURI(jobId);
        _setCompletionText(jobId, completionURI);
    }

    function _setCompletionText(uint256 jobId, string memory completionURI) internal {
        _requireConfigured();
        bytes32 node = jobEnsNode(jobId);
        _setTextBestEffort(node, "agijobs.completion.public", completionURI);
    }

    function revokePermissions(uint256 jobId, address employer, address agent) external onlyController {
        _revoke(jobId, employer, agent);
    }

    function revokePermissions(uint256 jobId) external onlyController {
        (address employer, address agent, , , , , , , ) = IJobInfoProvider(controller).getJobCore(jobId);
        _revoke(jobId, employer, agent);
    }

    function lockJobENS(uint256 jobId, address employer, address agent, bool burnFuses) external onlyController {
        _lock(jobId, employer, agent, burnFuses);
    }

    function lockJobENS(uint256 jobId, bool burnFuses) external {
        (
            address employer,
            address agent,
            ,
            ,
            ,
            bool completed,
            ,
            bool expired,
            uint8 agentPayoutPct
        ) = IJobInfoProvider(controller).getJobCore(jobId);
        agentPayoutPct;
        if (!completed && !expired) revert InvalidState();
        _lock(jobId, employer, agent, burnFuses);
    }

    function _setTextBestEffort(bytes32 node, string memory key, string memory value) internal {
        try publicResolver.setText(node, key, value) {} catch {}
    }

    function _setAuthorisationBestEffort(uint256 jobId, bytes32 node, address target, bool enabled) internal {
        if (target == address(0)) return;
        try publicResolver.setAuthorisation(node, target, enabled) {
            emit JobENSPermissionsUpdated(jobId, target, enabled);
        } catch {}
    }

    function _hookCreate(uint256 jobId) internal {
        (address employer, , , , , , , , ) = IJobInfoProvider(controller).getJobCore(jobId);
        string memory specURI = IJobURIProvider(controller).getJobSpecURI(jobId);
        _createJobPage(jobId, employer, specURI);
    }

    function _hookAssign(uint256 jobId) internal {
        (, address agent, , , , , , , ) = IJobInfoProvider(controller).getJobCore(jobId);
        _assignAgent(jobId, agent);
    }

    function _hookCompletion(uint256 jobId) internal {
        string memory completionURI = IJobURIProvider(controller).getJobCompletionURI(jobId);
        _setCompletionText(jobId, completionURI);
    }

    function _hookRevoke(uint256 jobId) internal {
        (address employer, address agent, , , , , , , ) = IJobInfoProvider(controller).getJobCore(jobId);
        _revoke(jobId, employer, agent);
    }

    function _assignAgent(uint256 jobId, address agent) internal {
        _requireConfigured();
        bytes32 node = jobEnsNode(jobId);
        publicResolver.setAuthorisation(node, agent, true);
        emit JobENSPermissionsUpdated(jobId, agent, true);
    }

    function _revoke(uint256 jobId, address employer, address agent) internal {
        _requireConfigured();
        bytes32 node = jobEnsNode(jobId);
        _setAuthorisationBestEffort(jobId, node, employer, false);
        if (agent != address(0)) {
            _setAuthorisationBestEffort(jobId, node, agent, false);
        }
    }

    function _lock(uint256 jobId, address employer, address agent, bool burnFuses) internal {
        _requireConfigured();
        bytes32 node = jobEnsNode(jobId);
        _setAuthorisationBestEffort(jobId, node, employer, false);
        if (agent != address(0)) {
            _setAuthorisationBestEffort(jobId, node, agent, false);
        }
        bool fusesBurned;
        if (burnFuses && address(nameWrapper) != address(0)) {
            try nameWrapper.isWrapped(node) returns (bool wrapped) {
                if (wrapped) {
                    try nameWrapper.setFuses(node, type(uint32).max) {
                        fusesBurned = true;
                    } catch {}
                }
            } catch {}
        }
        emit JobENSLocked(jobId, node, fusesBurned);
    }

    function _requireConfigured() internal view {
        if (address(ens) == address(0)) revert InvalidConfiguration();
        if (address(publicResolver) == address(0)) revert InvalidConfiguration();
        if (jobsRootNode == bytes32(0)) revert InvalidConfiguration();
    }

    function _requireWrappedRootPermission() internal view {
        address wrapperOwner = nameWrapper.ownerOf(uint256(jobsRootNode));
        if (wrapperOwner != address(this) && !nameWrapper.isApprovedForAll(wrapperOwner, address(this))) {
            revert NotRootOwner();
        }
    }
}
