// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "./IENSRegistry.sol";
import "./INameWrapper.sol";
import "./IPublicResolver.sol";

interface IAGIJobManagerView {
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

    function getJobSpecURI(uint256 jobId) external view returns (string memory);
    function getJobCompletionURI(uint256 jobId) external view returns (string memory);
}

contract ENSJobPages is Ownable {
    using Strings for uint256;

    error ENSNotConfigured();
    error ENSNotAuthorized();
    error InvalidParameters();
    error ConfigLocked();

    // NameWrapper fuses (ENSIP-10).
    uint32 private constant CANNOT_SET_RESOLVER = 1 << 3;
    uint32 private constant CANNOT_SET_TTL = 1 << 4;
    uint32 private constant LOCK_FUSES = CANNOT_SET_RESOLVER | CANNOT_SET_TTL;

    event JobENSPageCreated(uint256 indexed jobId, bytes32 indexed node);
    event JobENSPermissionsUpdated(uint256 indexed jobId, address indexed account, bool isAuthorised);
    event JobENSLocked(uint256 indexed jobId, bytes32 indexed node, bool fusesBurned);
    event ENSRegistryUpdated(address indexed oldEns, address indexed newEns);
    event NameWrapperUpdated(address indexed oldNameWrapper, address indexed newNameWrapper);
    event PublicResolverUpdated(address indexed oldResolver, address indexed newResolver);
    event JobsRootUpdated(
        bytes32 indexed oldRootNode,
        bytes32 indexed newRootNode,
        string oldRootName,
        string newRootName
    );
    event JobManagerUpdated(address indexed oldJobManager, address indexed newJobManager);
    event UseEnsJobTokenURIUpdated(bool oldValue, bool newValue);
    event ENSHookProcessed(uint8 indexed hook, uint256 indexed jobId, bool configured, bool success);
    event ENSHookSkipped(uint8 indexed hook, uint256 indexed jobId, bytes32 indexed reason);
    event ConfigurationLocked(address indexed locker);

    IENSRegistry public ens;
    INameWrapper public nameWrapper;
    IPublicResolver public publicResolver;
    bytes32 public jobsRootNode;
    string public jobsRootName;
    address public jobManager;
    bool public useEnsJobTokenURI;
    bool public configLocked;

    constructor(
        address ensAddress,
        address nameWrapperAddress,
        address publicResolverAddress,
        bytes32 rootNode,
        string memory rootName
    ) {
        if (ensAddress == address(0) || ensAddress.code.length == 0) revert InvalidParameters();
        if (publicResolverAddress == address(0) || publicResolverAddress.code.length == 0) revert InvalidParameters();
        if (nameWrapperAddress != address(0) && nameWrapperAddress.code.length == 0) revert InvalidParameters();
        bool hasRootNode = rootNode != bytes32(0);
        bool hasRootName = bytes(rootName).length != 0;
        if (hasRootNode != hasRootName) revert InvalidParameters();
        ens = IENSRegistry(ensAddress);
        nameWrapper = INameWrapper(nameWrapperAddress);
        publicResolver = IPublicResolver(publicResolverAddress);
        jobsRootNode = rootNode;
        jobsRootName = rootName;
    }

    function setENSRegistry(address ensAddress) external onlyOwner {
        if (configLocked) revert ConfigLocked();
        address old = address(ens);
        if (ensAddress == address(0) || ensAddress.code.length == 0) revert InvalidParameters();
        ens = IENSRegistry(ensAddress);
        emit ENSRegistryUpdated(old, ensAddress);
    }

    function setNameWrapper(address nameWrapperAddress) external onlyOwner {
        if (configLocked) revert ConfigLocked();
        address old = address(nameWrapper);
        if (nameWrapperAddress != address(0) && nameWrapperAddress.code.length == 0) revert InvalidParameters();
        nameWrapper = INameWrapper(nameWrapperAddress);
        emit NameWrapperUpdated(old, nameWrapperAddress);
    }

    function setPublicResolver(address publicResolverAddress) external onlyOwner {
        if (configLocked) revert ConfigLocked();
        address old = address(publicResolver);
        if (publicResolverAddress == address(0) || publicResolverAddress.code.length == 0) revert InvalidParameters();
        publicResolver = IPublicResolver(publicResolverAddress);
        emit PublicResolverUpdated(old, publicResolverAddress);
    }

    function setJobsRoot(bytes32 rootNode, string calldata rootName) external onlyOwner {
        if (configLocked) revert ConfigLocked();
        bytes32 oldNode = jobsRootNode;
        string memory oldName = jobsRootName;
        if (rootNode == bytes32(0)) revert InvalidParameters();
        if (bytes(rootName).length == 0) revert InvalidParameters();
        jobsRootNode = rootNode;
        jobsRootName = rootName;
        emit JobsRootUpdated(oldNode, rootNode, oldName, rootName);
    }

    function setJobManager(address manager) external onlyOwner {
        if (configLocked) revert ConfigLocked();
        address old = jobManager;
        if (manager == address(0) || manager.code.length == 0) revert InvalidParameters();
        jobManager = manager;
        emit JobManagerUpdated(old, manager);
    }

    function setUseEnsJobTokenURI(bool enabled) external onlyOwner {
        bool old = useEnsJobTokenURI;
        useEnsJobTokenURI = enabled;
        emit UseEnsJobTokenURIUpdated(old, enabled);
    }

    function lockConfiguration() external onlyOwner {
        if (!_isFullyConfigured()) revert ENSNotConfigured();
        configLocked = true;
        emit ConfigurationLocked(msg.sender);
    }

    modifier onlyJobManager() {
        if (msg.sender != jobManager) revert ENSNotAuthorized();
        _;
    }


    function jobEnsLabel(uint256 jobId) public pure returns (string memory) {
        return string(abi.encodePacked("job-", jobId.toString()));
    }

    function jobEnsName(uint256 jobId) public view returns (string memory) {
        if (!_isRootConfigured()) return "";
        return string(abi.encodePacked(jobEnsLabel(jobId), ".", jobsRootName));
    }

    function jobEnsURI(uint256 jobId) public view returns (string memory) {
        string memory ensName = jobEnsName(jobId);
        if (bytes(ensName).length == 0) return "";
        return string(abi.encodePacked("ens://", ensName));
    }


    function jobEnsNode(uint256 jobId) public view returns (bytes32) {
        if (!_isRootConfigured()) revert ENSNotConfigured();
        bytes32 labelHash = keccak256(bytes(jobEnsLabel(jobId)));
        return keccak256(abi.encodePacked(jobsRootNode, labelHash));
    }

    function createJobPage(uint256 jobId, address employer, string memory specURI) public onlyOwner {
        _createJobPage(jobId, employer, specURI);
    }

    function _createJobPage(uint256 jobId, address employer, string memory specURI) internal {
        if (employer == address(0)) revert InvalidParameters();
        _requireConfigured();
        bytes32 node = _createSubname(jobId);
        emit JobENSPageCreated(jobId, node);
        _setAuthorisationBestEffort(jobId, node, employer, true);
        _setTextBestEffort(node, "schema", "agijobmanager/v1");
        _setTextBestEffort(node, "agijobs.spec.public", specURI);
    }

    function handleHook(uint8 hook, uint256 jobId) external onlyJobManager {
        if (!_isFullyConfigured()) {
            emit ENSHookSkipped(hook, jobId, "NOT_CONFIGURED");
            emit ENSHookProcessed(hook, jobId, false, false);
            return;
        }

        bool success;
        IAGIJobManagerView jobManagerView = IAGIJobManagerView(msg.sender);
        if (hook == 1) {
            string memory specURI = jobManagerView.getJobSpecURI(jobId);
            (address employer, , , , , , , , ) = jobManagerView.getJobCore(jobId);
            _createJobPage(jobId, employer, specURI);
            success = true;
            emit ENSHookProcessed(hook, jobId, true, success);
            return;
        }
        if (hook == 2) {
            (, address agent, , , , , , , ) = jobManagerView.getJobCore(jobId);
            _onAgentAssigned(jobId, agent);
            success = true;
            emit ENSHookProcessed(hook, jobId, true, success);
            return;
        }
        if (hook == 3) {
            string memory completionURI = jobManagerView.getJobCompletionURI(jobId);
            _onCompletionRequested(jobId, completionURI);
            success = true;
            emit ENSHookProcessed(hook, jobId, true, success);
            return;
        }
        if (hook == 4) {
            try jobManagerView.getJobCore(jobId) returns (
                address employer,
                address agent,
                uint256,
                uint256,
                uint256,
                bool,
                bool,
                bool,
                uint8
            ) {
                _revokePermissions(jobId, employer, agent);
                success = true;
            } catch {
                _revokePermissions(jobId, address(0), address(0));
                success = true;
            }
            emit ENSHookProcessed(hook, jobId, true, success);
            return;
        }
        if (hook == 5 || hook == 6) {
            bool burnFuses = hook == 6;
            try jobManagerView.getJobCore(jobId) returns (
                address employer,
                address agent,
                uint256,
                uint256,
                uint256,
                bool,
                bool,
                bool,
                uint8
            ) {
                _lockJobENS(jobId, employer, agent, burnFuses);
                success = true;
            } catch {
                _lockJobENS(jobId, address(0), address(0), burnFuses);
                success = true;
            }
            emit ENSHookProcessed(hook, jobId, true, success);
            return;
        }
        emit ENSHookSkipped(hook, jobId, "UNKNOWN_HOOK");
        emit ENSHookProcessed(hook, jobId, true, false);
    }

    function onAgentAssigned(uint256 jobId, address agent) public onlyOwner {
        _onAgentAssigned(jobId, agent);
    }

    function _onAgentAssigned(uint256 jobId, address agent) internal {
        if (agent == address(0)) revert InvalidParameters();
        _requireConfigured();
        bytes32 node = jobEnsNode(jobId);
        _setAuthorisationBestEffort(jobId, node, agent, true);
    }

    function onCompletionRequested(uint256 jobId, string memory completionURI) public onlyOwner {
        _onCompletionRequested(jobId, completionURI);
    }

    function _onCompletionRequested(uint256 jobId, string memory completionURI) internal {
        _requireConfigured();
        bytes32 node = jobEnsNode(jobId);
        _setTextBestEffort(node, "agijobs.completion.public", completionURI);
    }

    function revokePermissions(uint256 jobId, address employer, address agent) public onlyOwner {
        _revokePermissions(jobId, employer, agent);
    }

    function _revokePermissions(uint256 jobId, address employer, address agent) internal {
        _requireConfigured();
        bytes32 node = jobEnsNode(jobId);
        _setAuthorisationBestEffort(jobId, node, employer, false);
        _setAuthorisationBestEffort(jobId, node, agent, false);
    }

    function lockJobENS(uint256 jobId, address employer, address agent, bool burnFuses) public onlyOwner {
        _lockJobENS(jobId, employer, agent, burnFuses);
    }

    /* solhint-disable no-empty-blocks */
    function _lockJobENS(uint256 jobId, address employer, address agent, bool burnFuses) internal {
        _requireConfigured();
        bytes32 node = jobEnsNode(jobId);
        _setAuthorisationBestEffort(jobId, node, employer, false);
        _setAuthorisationBestEffort(jobId, node, agent, false);

        bool fusesBurned = false;
        if (burnFuses && _isWrappedRoot()) {
            bytes32 labelhash = keccak256(bytes(jobEnsLabel(jobId)));
            try nameWrapper.setChildFuses(jobsRootNode, labelhash, LOCK_FUSES, type(uint64).max) {
                fusesBurned = true;
            } catch {
                // solhint-disable-next-line no-empty-blocks
            }
        }
        emit JobENSLocked(jobId, node, fusesBurned);
    }

    function _createSubname(uint256 jobId) internal returns (bytes32 node) {
        string memory label = jobEnsLabel(jobId);
        bytes32 labelHash = keccak256(bytes(label));
        if (_isWrappedRoot()) {
            _requireWrapperAuthorization();
            nameWrapper.setSubnodeRecord(
                jobsRootNode,
                label,
                address(this),
                address(publicResolver),
                0,
                0,
                type(uint64).max
            );
        } else {
            if (ens.owner(jobsRootNode) != address(this)) revert ENSNotAuthorized();
            ens.setSubnodeRecord(jobsRootNode, labelHash, address(this), address(publicResolver), 0);
        }
        node = keccak256(abi.encodePacked(jobsRootNode, labelHash));
    }

    function _setTextBestEffort(bytes32 node, string memory key, string memory value) internal {
        if (bytes(value).length == 0) {
            return;
        }
        try publicResolver.setText(node, key, value) {
        } catch {
            // solhint-disable-next-line no-empty-blocks
        }
    }

    function _setAuthorisationBestEffort(
        uint256 jobId,
        bytes32 node,
        address account,
        bool authorised
    ) internal {
        if (account == address(0)) {
            return;
        }
        try publicResolver.setAuthorisation(node, account, authorised) {
            emit JobENSPermissionsUpdated(jobId, account, authorised);
        } catch {
            // solhint-disable-next-line no-empty-blocks
        }
    }
    /* solhint-enable no-empty-blocks */

    function _isWrappedRoot() internal view returns (bool) {
        return address(nameWrapper) != address(0) && ens.owner(jobsRootNode) == address(nameWrapper);
    }

    function _requireWrapperAuthorization() internal view {
        address wrappedOwner = nameWrapper.ownerOf(uint256(jobsRootNode));
        if (wrappedOwner == address(0)) revert ENSNotAuthorized();
        if (wrappedOwner != address(this) && !nameWrapper.isApprovedForAll(wrappedOwner, address(this))) {
            revert ENSNotAuthorized();
        }
    }

    function _requireConfigured() internal view {
        if (address(ens) == address(0)) revert ENSNotConfigured();
        if (address(publicResolver) == address(0)) revert ENSNotConfigured();
        if (!_isRootConfigured()) revert ENSNotConfigured();
    }

    function _isFullyConfigured() internal view returns (bool) {
        if (address(ens) == address(0)) return false;
        if (address(publicResolver) == address(0)) return false;
        if (!_isRootConfigured()) return false;
        if (jobManager == address(0) || jobManager.code.length == 0) return false;

        address rootOwner;
        try ens.owner(jobsRootNode) returns (address owner_) {
            rootOwner = owner_;
        } catch {
            return false;
        }

        if (rootOwner == address(this)) {
            return true;
        }

        address wrapperAddress = address(nameWrapper);
        if (wrapperAddress == address(0)) {
            return false;
        }

        return rootOwner == wrapperAddress;
    }

    function _isRootConfigured() internal view returns (bool) {
        return jobsRootNode != bytes32(0) && bytes(jobsRootName).length != 0;
    }
}
