// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./IAGIJobManagerView.sol";

interface IENSRegistry {
    function owner(bytes32 node) external view returns (address);
    function resolver(bytes32 node) external view returns (address);
    function setSubnodeRecord(bytes32 node, bytes32 label, address owner, address resolver, uint64 ttl) external;
}

interface IPublicResolver {
    function setAuthorisation(bytes32 node, address target, bool isAuthorised) external;
    function setText(bytes32 node, string calldata key, string calldata value) external;
}

interface INameWrapper {
    function ownerOf(uint256 id) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
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
    function setFuses(bytes32 node, uint16 ownerControlledFuses) external returns (uint32);
}

contract ENSJobPages is Ownable {
    using Strings for uint256;

    error InvalidParameters();
    error NotAuthorized();

    uint8 private constant HOOK_CREATE = 1;
    uint8 private constant HOOK_ASSIGNED = 2;
    uint8 private constant HOOK_TERMINAL = 3;

    IENSRegistry public ens;
    INameWrapper public nameWrapper;
    IPublicResolver public publicResolver;
    bytes32 public jobsRootNode;
    string public jobsRootName;

    event ENSRegistryUpdated(address indexed ensRegistry);
    event NameWrapperUpdated(address indexed nameWrapper);
    event PublicResolverUpdated(address indexed publicResolver);
    event JobsRootNodeUpdated(bytes32 indexed jobsRootNode, string jobsRootName);
    event JobENSPageCreated(uint256 indexed jobId, bytes32 indexed node);
    event JobENSPermissionsUpdated(uint256 indexed jobId, address indexed account, bool enabled);
    event JobENSLocked(uint256 indexed jobId, bytes32 indexed node, bool fusesBurned);

    constructor(
        address ensRegistry,
        address wrapper,
        address resolver,
        bytes32 rootNode,
        string memory rootName
    ) {
        if (ensRegistry == address(0) || resolver == address(0)) revert InvalidParameters();
        ens = IENSRegistry(ensRegistry);
        nameWrapper = INameWrapper(wrapper);
        publicResolver = IPublicResolver(resolver);
        jobsRootNode = rootNode;
        jobsRootName = rootName;
    }

    function setENSRegistry(address ensRegistry) external onlyOwner {
        if (ensRegistry == address(0)) revert InvalidParameters();
        ens = IENSRegistry(ensRegistry);
        emit ENSRegistryUpdated(ensRegistry);
    }

    function setNameWrapper(address wrapper) external onlyOwner {
        nameWrapper = INameWrapper(wrapper);
        emit NameWrapperUpdated(wrapper);
    }

    function setPublicResolver(address resolver) external onlyOwner {
        if (resolver == address(0)) revert InvalidParameters();
        publicResolver = IPublicResolver(resolver);
        emit PublicResolverUpdated(resolver);
    }

    function setJobsRoot(bytes32 rootNode, string calldata rootName) external onlyOwner {
        if (rootNode == bytes32(0)) revert InvalidParameters();
        jobsRootNode = rootNode;
        jobsRootName = rootName;
        emit JobsRootNodeUpdated(rootNode, rootName);
    }

    function jobEnsLabel(uint256 jobId) public pure returns (string memory) {
        return string(abi.encodePacked("job-", jobId.toString()));
    }

    function jobEnsName(uint256 jobId) public view returns (string memory) {
        return string(abi.encodePacked(jobEnsLabel(jobId), ".", jobsRootName));
    }

    function jobEnsUri(uint256 jobId) public view returns (string memory) {
        return string(abi.encodePacked("ens://", jobEnsName(jobId)));
    }

    function jobEnsNode(uint256 jobId) public view returns (bytes32) {
        bytes32 labelHash = keccak256(bytes(jobEnsLabel(jobId)));
        return keccak256(abi.encodePacked(jobsRootNode, labelHash));
    }

    function createJobPage(uint256 jobId, address employer) public onlyOwner {
        if (address(ens) == address(0) || address(publicResolver) == address(0)) revert InvalidParameters();
        if (jobsRootNode == bytes32(0)) revert InvalidParameters();
        bytes32 labelHash = keccak256(bytes(jobEnsLabel(jobId)));
        bytes32 node;
        if (_isWrappedRoot()) {
            _requireWrappedPermission();
            node = nameWrapper.setSubnodeRecord(
                jobsRootNode,
                labelHash,
                address(this),
                address(publicResolver),
                0,
                0,
                type(uint64).max
            );
        } else {
            if (ens.owner(jobsRootNode) != address(this)) revert NotAuthorized();
            ens.setSubnodeRecord(jobsRootNode, labelHash, address(this), address(publicResolver), 0);
            node = keccak256(abi.encodePacked(jobsRootNode, labelHash));
        }

        publicResolver.setAuthorisation(node, employer, true);
        emit JobENSPageCreated(jobId, node);
        emit JobENSPermissionsUpdated(jobId, employer, true);

        string memory specURI = IAGIJobManagerView(msg.sender).getJobSpecURI(jobId);
        _trySetText(node, "schema", "agijobmanager/v1");
        _trySetText(node, "agijobs.spec.public", specURI);
    }

    function onAgentAssigned(uint256 jobId, address agent) public onlyOwner {
        bytes32 node = jobEnsNode(jobId);
        publicResolver.setAuthorisation(node, agent, true);
        emit JobENSPermissionsUpdated(jobId, agent, true);
    }

    function onCompletionRequested(uint256 jobId) public onlyOwner {
        bytes32 node = jobEnsNode(jobId);
        string memory completionURI = IAGIJobManagerView(msg.sender).getJobCompletionURI(jobId);
        _trySetText(node, "agijobs.completion.public", completionURI);
    }

    function onJobEvent(uint256 jobId, uint8 hookType) external onlyOwner {
        (
            address employer,
            address assignedAgent,
            uint256 payout,
            uint256 duration,
            uint256 assignedAt,
            bool completed,
            bool disputed,
            bool expired,
            uint8 agentPayoutPct
        ) = IAGIJobManagerView(msg.sender).getJobCore(jobId);
        payout;
        duration;
        assignedAt;
        completed;
        disputed;
        expired;
        agentPayoutPct;

        if (hookType == HOOK_CREATE) {
            createJobPage(jobId, employer);
        } else if (hookType == HOOK_ASSIGNED) {
            onAgentAssigned(jobId, assignedAgent);
        } else if (hookType == HOOK_TERMINAL) {
            revokePermissions(jobId, employer, assignedAgent);
        } else {
            revert InvalidParameters();
        }
    }

    function revokePermissions(uint256 jobId, address employer, address agent) public onlyOwner {
        bytes32 node = jobEnsNode(jobId);
        _trySetAuthorisation(node, employer, false, jobId);
        _trySetAuthorisation(node, agent, false, jobId);
    }

    function lockJobENS(uint256 jobId, address employer, address agent, bool burnFuses) external onlyOwner {
        bytes32 node = jobEnsNode(jobId);
        revokePermissions(jobId, employer, agent);

        bool fusesBurned;
        if (burnFuses && _isWrapped(node)) {
            try nameWrapper.setFuses(node, type(uint16).max) returns (uint32) {
                fusesBurned = true;
            } catch {}
        }

        emit JobENSLocked(jobId, node, fusesBurned);
    }

    function _trySetText(bytes32 node, string memory key, string memory value) internal {
        if (bytes(value).length == 0) return;
        try publicResolver.setText(node, key, value) {
        } catch {}
    }

    function _trySetAuthorisation(bytes32 node, address account, bool enabled, uint256 jobId) internal {
        if (account == address(0)) return;
        try publicResolver.setAuthorisation(node, account, enabled) {
            emit JobENSPermissionsUpdated(jobId, account, enabled);
        } catch {}
    }

    function _isWrappedRoot() internal view returns (bool) {
        address wrapper = address(nameWrapper);
        return wrapper != address(0) && ens.owner(jobsRootNode) == wrapper;
    }

    function _isWrapped(bytes32 node) internal view returns (bool wrapped) {
        if (address(nameWrapper) == address(0)) {
            return false;
        }
        try nameWrapper.isWrapped(node) returns (bool value) {
            wrapped = value;
        } catch {
            wrapped = false;
        }
    }

    function _requireWrappedPermission() internal view {
        address wrapperOwner = nameWrapper.ownerOf(uint256(jobsRootNode));
        if (wrapperOwner != address(this) && !nameWrapper.isApprovedForAll(wrapperOwner, address(this))) {
            revert NotAuthorized();
        }
    }
}
