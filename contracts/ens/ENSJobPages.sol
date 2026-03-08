// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

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

interface IResolverManager {
    function setResolver(bytes32 node, address resolver) external;
}

interface INameWrapperSubnameOwner {
    function setSubnodeOwner(
        bytes32 parentNode,
        string calldata label,
        address owner,
        uint32 fuses,
        uint64 expiry
    ) external returns (bytes32);
}

contract ENSJobPages is Ownable, ERC1155Holder {
    using Strings for uint256;

    error ENSNotConfigured();
    error ENSNotAuthorized();
    error InvalidParameters();
    error ConfigLocked();
    error JobLabelNotSnapshotted();

    uint256 private constant MAX_ROOT_NAME_LENGTH = 240;
    uint256 private constant MAX_JOB_LABEL_PREFIX_LENGTH = 32;
    uint256 private constant MAX_ENS_LABEL_LENGTH = 63;
    uint256 private constant ENS_READ_GAS_LIMIT = 50_000;

    bytes4 private constant ENS_OWNER_SELECTOR = bytes4(keccak256("owner(bytes32)"));
    bytes4 private constant WRAPPER_OWNER_OF_SELECTOR = bytes4(keccak256("ownerOf(uint256)"));
    bytes4 private constant WRAPPER_GET_APPROVED_SELECTOR = bytes4(keccak256("getApproved(uint256)"));
    bytes4 private constant WRAPPER_IS_APPROVED_FOR_ALL_SELECTOR = bytes4(keccak256("isApprovedForAll(address,address)"));

    uint8 private constant HOOK_CREATE = 1;
    uint8 private constant HOOK_ASSIGN = 2;
    uint8 private constant HOOK_COMPLETION = 3;
    uint8 private constant HOOK_REVOKE = 4;
    uint8 private constant HOOK_LOCK = 5;
    uint8 private constant HOOK_LOCK_BURN = 6;

    uint32 private constant CANNOT_UNWRAP = 1;
    uint32 private constant CANNOT_SET_RESOLVER = 1 << 3;
    uint32 private constant CANNOT_SET_TTL = 1 << 4;
    uint32 private constant PARENT_CANNOT_CONTROL = 1 << 16;
    uint32 private constant LOCK_FUSES =
        CANNOT_UNWRAP |
        PARENT_CANNOT_CONTROL |
        CANNOT_SET_RESOLVER |
        CANNOT_SET_TTL;

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
    event ENSHookBestEffortFailure(uint8 indexed hook, uint256 indexed jobId, bytes32 indexed operation);
    event ConfigurationLocked(address indexed locker);
    event JobLabelPrefixUpdated(string oldPrefix, string newPrefix);
    event LegacyJobPageMigrated(
        uint256 indexed jobId,
        bytes32 indexed node,
        string label,
        bool adopted,
        bool created
    );

    IENSRegistry public ens;
    INameWrapper public nameWrapper;
    IPublicResolver public publicResolver;
    bytes32 public jobsRootNode;
    string public jobsRootName;
    address public jobManager;
    bool public useEnsJobTokenURI;
    bool public configLocked;
    /// @notice Prefix used when constructing ENS job labels as prefix + decimal(jobId).
    string public jobLabelPrefix;

    mapping(uint256 => string) private _jobLabelById;
    mapping(uint256 => bool) private _jobLabelIsSet;
    mapping(bytes32 => uint256) private _jobIdPlusOneByLabelHash;

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
        if (hasRootName && !_isValidRootName(rootName)) revert InvalidParameters();

        ens = IENSRegistry(ensAddress);
        nameWrapper = INameWrapper(nameWrapperAddress);
        publicResolver = IPublicResolver(publicResolverAddress);
        jobsRootNode = rootNode;
        jobsRootName = rootName;
        jobLabelPrefix = "agijob";
    }

    /// @notice Updates the default prefix used for unsnapshotted/future job ENS labels.
    /// @dev Existing jobs keep their snapshotted label and are unaffected by later prefix changes.
    /// @dev The prefix is concatenated directly with decimal(jobId), so the final prefix character must be non-numeric.
    function setJobLabelPrefix(string calldata newPrefix) external onlyOwner {
        if (configLocked) revert ConfigLocked();
        if (!_isValidJobLabelPrefix(newPrefix)) revert InvalidParameters();

        string memory oldPrefix = jobLabelPrefix;
        jobLabelPrefix = newPrefix;
        emit JobLabelPrefixUpdated(oldPrefix, newPrefix);
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
        if (!_isValidRootName(rootName)) revert InvalidParameters();
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
        if (configLocked) revert ConfigLocked();
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

    modifier onlySelf() {
        if (msg.sender != address(this)) revert ENSNotAuthorized();
        _;
    }

    /// @notice Returns the effective label for a job, or a preview for unsnapshotted/future jobs.
    /// @dev Prefix changes only affect jobs whose label has not been snapshotted by first creation.
    function jobEnsLabel(uint256 jobId) public view returns (string memory) {
        return _resolvedJobLabel(jobId);
    }

    function jobEnsName(uint256 jobId) public view returns (string memory) {
        if (!_isRootConfigured()) return "";
        return string(abi.encodePacked(_resolvedJobLabel(jobId), ".", jobsRootName));
    }

    function jobLabelSnapshot(uint256 jobId) external view returns (bool isSet, string memory label) {
        return (_jobLabelIsSet[jobId], _jobLabelById[jobId]);
    }

    function jobEnsURI(uint256 jobId) external view returns (string memory) {
        string memory ensName = jobEnsName(jobId);
        if (bytes(ensName).length == 0) return "";
        return string(abi.encodePacked("ens://", ensName));
    }

    function jobEnsNode(uint256 jobId) public view returns (bytes32) {
        if (!_isRootConfigured()) revert ENSNotConfigured();
        bytes32 labelHash = keccak256(bytes(_resolvedJobLabel(jobId)));
        return keccak256(abi.encodePacked(jobsRootNode, labelHash));
    }

    function createJobPage(uint256 jobId, address employer, string memory specURI) public onlyOwner {
        _createJobPage(jobId, employer, specURI);
    }

    function migrateLegacyWrappedJobPage(uint256 jobId, string calldata exactLabel)
        external
        onlyOwner
        returns (bytes32 node)
    {
        // Legacy migration path: import the historically exact label so post-create writes can resolve
        // the correct node even when current prefix settings differ from historical naming.
        _requireConfigured();
        if (jobManager == address(0)) revert ENSNotConfigured();

        _importExactJobLabel(jobId, exactLabel);
        string memory label = _jobLabelById[jobId];

        string memory specURI = IAGIJobManagerView(jobManager).getJobSpecURI(jobId);
        (address employer, address assignedAgent, bool allowAuth) = _jobAuthStateForMigration(jobId);
        if (employer == address(0)) revert InvalidParameters();
        string memory completionURI = IAGIJobManagerView(jobManager).getJobCompletionURI(jobId);

        bytes32 labelHash = keccak256(bytes(label));
        node = keccak256(abi.encodePacked(jobsRootNode, labelHash));

        bool adopted;
        bool created;

        if (_nodeExists(node)) {
            if (!_nodeManagedBySelf(node)) {
                if (!_isWrappedRoot()) revert ENSNotAuthorized();
                _requireWrapperAuthorization();
                INameWrapperSubnameOwner(address(nameWrapper)).setSubnodeOwner(
                    jobsRootNode,
                    label,
                    address(this),
                    0,
                    type(uint64).max
                );

                node = keccak256(abi.encodePacked(jobsRootNode, keccak256(bytes(label))));
                if (!_nodeManagedBySelf(node)) revert ENSNotAuthorized();
                adopted = true;
            }
        } else {
            node = _createSubname(label);
            emit JobENSPageCreated(jobId, node);
            created = true;
        }

        _setResolverBestEffort(HOOK_CREATE, jobId, node, address(publicResolver));
        _setAuthorisationBestEffort(HOOK_CREATE, jobId, node, employer, allowAuth);
        _setAuthorisationBestEffort(HOOK_CREATE, jobId, node, assignedAgent, allowAuth);
        _setTextBestEffort(HOOK_CREATE, jobId, node, "schema", "agijobmanager/v1");
        _setTextBestEffort(HOOK_CREATE, jobId, node, "agijobs.spec.public", specURI);
        _setTextBestEffort(HOOK_CREATE, jobId, node, "agijobs.completion.public", completionURI);

        emit LegacyJobPageMigrated(jobId, node, label, adopted, created);
    }


    function _jobAuthStateForMigration(uint256 jobId)
        internal
        view
        returns (address employer, address assignedAgent, bool allowAuth)
    {
        bool completed;
        bool expired;
        (employer, assignedAgent, , , , completed, , expired, ) = IAGIJobManagerView(jobManager).getJobCore(jobId);
        // Preserve auth for unresolved disputes. Revoke only for terminal completion/expiry states.
        allowAuth = !(completed || expired);
    }

    function _createJobPage(uint256 jobId, address employer, string memory specURI) internal {
        if (employer == address(0)) revert InvalidParameters();
        _requireConfigured();

        string memory label = _resolvedJobLabel(jobId);
        bytes32 labelHash = keccak256(bytes(label));
        bytes32 node = keccak256(abi.encodePacked(jobsRootNode, labelHash));
        if (_nodeExists(node)) {
            if (!_nodeManagedBySelf(node)) revert ENSNotAuthorized();
            if (!_jobLabelIsSet[jobId]) {
                _snapshotJobLabel(jobId, label);
            }
        } else {
            if (_jobLabelIsSet[jobId]) {
                label = _jobLabelById[jobId];
            } else {
                label = _buildJobLabel(jobLabelPrefix, jobId);
                _snapshotJobLabel(jobId, label);
            }
            node = _createSubname(label);
            emit JobENSPageCreated(jobId, node);
        }

        _setResolverBestEffort(HOOK_CREATE, jobId, node, address(publicResolver));
        _setAuthorisationBestEffort(HOOK_CREATE, jobId, node, employer, true);
        _setTextBestEffort(HOOK_CREATE, jobId, node, "schema", "agijobmanager/v1");
        _setTextBestEffort(HOOK_CREATE, jobId, node, "agijobs.spec.public", specURI);
    }

    function handleHook(uint8 hook, uint256 jobId) external onlyJobManager {
        // Hooks are operationally best-effort and must never become a hard dependency for settlement.
        if (!_isFullyConfigured()) {
            emit ENSHookSkipped(hook, jobId, "NOT_CONFIGURED");
            emit ENSHookProcessed(hook, jobId, false, false);
            return;
        }

        bool success;
        IAGIJobManagerView jobManagerView = IAGIJobManagerView(msg.sender);

        if (hook == HOOK_CREATE) {
            try this._handleCreateHook(jobManagerView, jobId) {
                success = true;
            } catch {
                emit ENSHookSkipped(hook, jobId, "HOOK_REVERTED");
            }
            emit ENSHookProcessed(hook, jobId, true, success);
            return;
        }

        if (hook == HOOK_ASSIGN) {
            try this._handleAssignHook(jobManagerView, jobId) {
                success = true;
            } catch {
                emit ENSHookSkipped(hook, jobId, "HOOK_REVERTED");
            }
            emit ENSHookProcessed(hook, jobId, true, success);
            return;
        }

        if (hook == HOOK_COMPLETION) {
            try this._handleCompletionHook(jobManagerView, jobId) {
                success = true;
            } catch {
                emit ENSHookSkipped(hook, jobId, "HOOK_REVERTED");
            }
            emit ENSHookProcessed(hook, jobId, true, success);
            return;
        }

        if (hook == HOOK_REVOKE) {
            try this._handleRevokeHook(jobManagerView, jobId) {
                success = true;
            } catch {
                emit ENSHookSkipped(hook, jobId, "HOOK_REVERTED");
            }
            emit ENSHookProcessed(hook, jobId, true, success);
            return;
        }

        if (hook == HOOK_LOCK || hook == HOOK_LOCK_BURN) {
            bool burnFuses = hook == HOOK_LOCK_BURN;
            try this._handleLockHook(jobManagerView, jobId, burnFuses) {
                success = true;
            } catch {
                emit ENSHookSkipped(hook, jobId, "HOOK_REVERTED");
            }
            emit ENSHookProcessed(hook, jobId, true, success);
            return;
        }

        emit ENSHookSkipped(hook, jobId, "UNKNOWN_HOOK");
        emit ENSHookProcessed(hook, jobId, true, false);
    }

    function _handleCreateHook(IAGIJobManagerView managerView, uint256 jobId) external onlySelf {
        string memory specURI = managerView.getJobSpecURI(jobId);
        (address employer, , , , , , , , ) = managerView.getJobCore(jobId);
        _createJobPage(jobId, employer, specURI);
    }

    function _handleAssignHook(IAGIJobManagerView managerView, uint256 jobId) external onlySelf {
        (, address agent, , , , , , , ) = managerView.getJobCore(jobId);
        _onAgentAssigned(jobId, agent);
    }

    function _handleCompletionHook(IAGIJobManagerView managerView, uint256 jobId) external onlySelf {
        string memory completionURI = managerView.getJobCompletionURI(jobId);
        _onCompletionRequested(jobId, completionURI);
    }

    function _handleRevokeHook(IAGIJobManagerView managerView, uint256 jobId) external onlySelf {
        try managerView.getJobCore(jobId) returns (
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
        } catch {
            _revokePermissions(jobId, address(0), address(0));
        }
    }

    function _handleLockHook(IAGIJobManagerView managerView, uint256 jobId, bool burnFuses) external onlySelf {
        try managerView.getJobCore(jobId) returns (
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
        } catch {
            _lockJobENS(jobId, address(0), address(0), burnFuses);
        }
    }

    function onAgentAssigned(uint256 jobId, address agent) public onlyOwner {
        _onAgentAssigned(jobId, agent);
    }

    function _onAgentAssigned(uint256 jobId, address agent) internal {
        if (agent == address(0)) revert InvalidParameters();
        _requireConfigured();
        bytes32 node = _resolvedJobNodeForWrite(jobId);
        _setAuthorisationBestEffort(HOOK_ASSIGN, jobId, node, agent, true);
    }

    function onCompletionRequested(uint256 jobId, string memory completionURI) public onlyOwner {
        _onCompletionRequested(jobId, completionURI);
    }

    function _onCompletionRequested(uint256 jobId, string memory completionURI) internal {
        _requireConfigured();
        bytes32 node = _resolvedJobNodeForWrite(jobId);
        _setTextBestEffort(HOOK_COMPLETION, jobId, node, "agijobs.completion.public", completionURI);
    }

    function revokePermissions(uint256 jobId, address employer, address agent) public onlyOwner {
        _revokePermissions(jobId, employer, agent);
    }

    function _revokePermissions(uint256 jobId, address employer, address agent) internal {
        _requireConfigured();
        bytes32 node = _resolvedJobNodeForWrite(jobId);
        _setAuthorisationBestEffort(HOOK_REVOKE, jobId, node, employer, false);
        _setAuthorisationBestEffort(HOOK_REVOKE, jobId, node, agent, false);
    }

    function lockJobENS(uint256 jobId, address employer, address agent, bool burnFuses) public onlyOwner {
        _lockJobENS(jobId, employer, agent, burnFuses);
    }

    /* solhint-disable no-empty-blocks */
    function _lockJobENS(uint256 jobId, address employer, address agent, bool burnFuses) internal {
        _requireConfigured();
        bytes32 node = _resolvedJobNodeForWrite(jobId);
        uint8 hook = burnFuses ? HOOK_LOCK_BURN : HOOK_LOCK;

        _setAuthorisationBestEffort(hook, jobId, node, employer, false);
        _setAuthorisationBestEffort(hook, jobId, node, agent, false);

        bool fusesBurned = false;
        if (burnFuses && _isWrappedNode(node)) {
            if (_nodeManagedBySelf(node)) {
                bytes32 labelhash = keccak256(bytes(_jobLabelById[jobId]));
                try nameWrapper.setChildFuses(jobsRootNode, labelhash, LOCK_FUSES, type(uint64).max) {
                    fusesBurned = true;
                } catch {
                    emit ENSHookBestEffortFailure(hook, jobId, "BURN_FUSES");
                }
            } else {
                emit ENSHookBestEffortFailure(hook, jobId, "BURN_FUSES");
            }
        }

        emit JobENSLocked(jobId, node, fusesBurned);
    }

    function _createSubname(string memory label) internal returns (bytes32 node) {
        bytes32 labelHash = keccak256(bytes(label));

        if (_isWrappedRoot()) {
            _requireWrapperAuthorization();
            INameWrapperSubnameOwner(address(nameWrapper)).setSubnodeOwner(
                jobsRootNode,
                label,
                address(this),
                0,
                type(uint64).max
            );
        } else {
            if (ens.owner(jobsRootNode) != address(this)) revert ENSNotAuthorized();
            ens.setSubnodeRecord(jobsRootNode, labelHash, address(this), address(0), 0);
        }

        node = keccak256(abi.encodePacked(jobsRootNode, labelHash));
    }

    function _setResolverBestEffort(uint8 hook, uint256 jobId, bytes32 node, address resolver) internal {
        if (resolver == address(0)) {
            return;
        }

        if (_isWrappedNode(node)) {
            try IResolverManager(address(nameWrapper)).setResolver(node, resolver) {
            } catch {
                emit ENSHookBestEffortFailure(hook, jobId, "SET_RESOLVER");
            }
            return;
        }

        try IResolverManager(address(ens)).setResolver(node, resolver) {
        } catch {
            emit ENSHookBestEffortFailure(hook, jobId, "SET_RESOLVER");
        }
    }

    function _setTextBestEffort(uint8 hook, uint256 jobId, bytes32 node, string memory key, string memory value)
        internal
    {
        if (bytes(value).length == 0) {
            return;
        }

        try publicResolver.setText(node, key, value) {
        } catch {
            emit ENSHookBestEffortFailure(hook, jobId, "SET_TEXT");
        }
    }

    function _setAuthorisationBestEffort(
        uint8 hook,
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
            emit ENSHookBestEffortFailure(hook, jobId, "SET_AUTH");
        }
    }
    /* solhint-enable no-empty-blocks */

    function _nodeExists(bytes32 node) internal view returns (bool) {
        (bool ok, address ownerAddress) = _tryNodeOwner(node);
        return ok && ownerAddress != address(0);
    }

    function _nodeManagedBySelf(bytes32 node) internal view returns (bool) {
        (bool ok, address ownerAddress) = _tryNodeOwner(node);
        if (!ok || ownerAddress == address(0)) {
            return false;
        }

        if (ownerAddress == address(this)) {
            return true;
        }

        if (ownerAddress != address(nameWrapper)) {
            return false;
        }

        (ok, ownerAddress) = _staticcallAddress(
            address(nameWrapper), abi.encodeWithSelector(WRAPPER_OWNER_OF_SELECTOR, uint256(node))
        );
        return ok && ownerAddress == address(this);
    }

    function _isWrappedRoot() internal view returns (bool) {
        if (address(nameWrapper) == address(0)) return false;
        (bool ok, address ownerAddress) = _tryRootOwner();
        return ok && ownerAddress == address(nameWrapper);
    }

    function _isWrappedNode(bytes32 node) internal view returns (bool) {
        if (address(nameWrapper) == address(0)) return false;
        (bool ok, address ownerAddress) = _tryNodeOwner(node);
        return ok && ownerAddress == address(nameWrapper);
    }

    function _requireWrapperAuthorization() internal view {
        // Wrapped-root operations require ENSJobPages to be owner, token-approved, or operator-approved
        // for the wrapped root token ID (uint256(jobsRootNode)).
        uint256 rootTokenId = uint256(jobsRootNode);

        (bool ok, address wrappedOwner) = _staticcallAddress(
            address(nameWrapper), abi.encodeWithSelector(WRAPPER_OWNER_OF_SELECTOR, rootTokenId)
        );
        if (!ok || wrappedOwner == address(0)) revert ENSNotAuthorized();

        if (wrappedOwner == address(this)) {
            return;
        }

        address approved;
        (ok, approved) = _staticcallAddress(
            address(nameWrapper), abi.encodeWithSelector(WRAPPER_GET_APPROVED_SELECTOR, rootTokenId)
        );
        if (ok && approved == address(this)) {
            return;
        }

        bool approvedForAll;
        (ok, approvedForAll) = _staticcallBool(
            address(nameWrapper),
            abi.encodeWithSelector(WRAPPER_IS_APPROVED_FOR_ALL_SELECTOR, wrappedOwner, address(this))
        );
        if (!ok || !approvedForAll) {
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
        if (jobManager == address(0)) return false;

        (bool ok, address rootOwner) = _tryRootOwner();
        if (!ok) return false;

        if (rootOwner == address(this)) {
            return true;
        }

        if (address(nameWrapper) == address(0) || rootOwner != address(nameWrapper)) {
            return false;
        }

        return _isWrapperAuthorizationReady();
    }

    function _isWrapperAuthorizationReady() internal view returns (bool) {
        uint256 rootTokenId = uint256(jobsRootNode);

        (bool ok, address wrappedOwner) = _staticcallAddress(
            address(nameWrapper), abi.encodeWithSelector(WRAPPER_OWNER_OF_SELECTOR, rootTokenId)
        );
        if (!ok) return false;
        if (wrappedOwner == address(0)) return false;
        if (wrappedOwner == address(this)) return true;

        address approved;
        (ok, approved) = _staticcallAddress(
            address(nameWrapper), abi.encodeWithSelector(WRAPPER_GET_APPROVED_SELECTOR, rootTokenId)
        );
        if (ok && approved == address(this)) {
            return true;
        }

        bool approvedForAll;
        (ok, approvedForAll) = _staticcallBool(
            address(nameWrapper),
            abi.encodeWithSelector(WRAPPER_IS_APPROVED_FOR_ALL_SELECTOR, wrappedOwner, address(this))
        );
        return ok && approvedForAll;
    }

    function _isRootConfigured() internal view returns (bool) {
        return jobsRootNode != bytes32(0) && bytes(jobsRootName).length != 0;
    }

    function _isValidRootName(string memory rootName) internal pure returns (bool) {
        uint256 len = bytes(rootName).length;
        return len > 0 && len <= MAX_ROOT_NAME_LENGTH;
    }

    function _isValidJobLabelPrefix(string memory prefix) internal pure returns (bool) {
        bytes memory raw = bytes(prefix);
        uint256 len = raw.length;
        if (len == 0 || len > MAX_JOB_LABEL_PREFIX_LENGTH) return false;
        if (raw[0] == bytes1("-")) return false;
        // Prefix is followed immediately by decimal(jobId), so the suffix boundary must be non-numeric.
        if (raw[len - 1] >= bytes1("0") && raw[len - 1] <= bytes1("9")) return false;

        for (uint256 i = 0; i < len; i++) {
            bytes1 ch = raw[i];
            bool isDigit = ch >= bytes1("0") && ch <= bytes1("9");
            bool isLower = ch >= bytes1("a") && ch <= bytes1("z");
            bool isHyphen = ch == bytes1("-");
            if (!isDigit && !isLower && !isHyphen) return false;
        }

        return true;
    }

    function _buildJobLabel(string memory prefix, uint256 jobId) internal pure returns (string memory) {
        string memory label = string(abi.encodePacked(prefix, jobId.toString()));
        if (bytes(label).length > MAX_ENS_LABEL_LENGTH) revert InvalidParameters();
        return label;
    }

    function _isValidExactJobLabelForJob(uint256 jobId, string memory label) internal pure returns (bool) {
        bytes memory raw = bytes(label);
        uint256 len = raw.length;
        if (len == 0 || len > MAX_ENS_LABEL_LENGTH) return false;
        if (raw[0] == bytes1("-")) return false;

        bytes memory idRaw = bytes(jobId.toString());
        uint256 idLen = idRaw.length;
        if (idLen == 0 || idLen > len) return false;

        for (uint256 i = 0; i < len; i++) {
            bytes1 ch = raw[i];
            bool isDigit = ch >= bytes1("0") && ch <= bytes1("9");
            bool isLower = ch >= bytes1("a") && ch <= bytes1("z");
            bool isHyphen = ch == bytes1("-");
            if (!isDigit && !isLower && !isHyphen) return false;
        }

        uint256 suffixStart = len - idLen;
        for (uint256 i = 0; i < idLen; i++) {
            if (raw[suffixStart + i] != idRaw[i]) return false;
        }
        if (suffixStart > 0) {
            bytes1 prev = raw[suffixStart - 1];
            if (prev >= bytes1("0") && prev <= bytes1("9")) return false;
        }

        bytes memory prefixRaw = new bytes(suffixStart);
        for (uint256 i = 0; i < suffixStart; i++) {
            prefixRaw[i] = raw[i];
        }

        return _isValidJobLabelPrefix(string(prefixRaw));
    }

    function _resolvedJobLabel(uint256 jobId) internal view returns (string memory) {
        if (_jobLabelIsSet[jobId]) {
            return _jobLabelById[jobId];
        }

        string memory label = _buildJobLabel(jobLabelPrefix, jobId);
        bytes32 labelHash = keccak256(bytes(label));
        uint256 existing = _jobIdPlusOneByLabelHash[labelHash];
        if (existing != 0 && existing != jobId + 1) revert InvalidParameters();
        return label;
    }

    /// @dev Post-create write paths must use a snapshotted/imported label.
    ///      Legacy jobs that predate this contract must be migrated before hooks can mutate ENS records.
    function _resolvedJobNodeForWrite(uint256 jobId) internal view returns (bytes32) {
        if (!_jobLabelIsSet[jobId]) revert JobLabelNotSnapshotted();
        return keccak256(abi.encodePacked(jobsRootNode, keccak256(bytes(_jobLabelById[jobId]))));
    }

    function _snapshotJobLabel(uint256 jobId, string memory label) internal {
        bytes32 labelHash = keccak256(bytes(label));
        uint256 existing = _jobIdPlusOneByLabelHash[labelHash];
        if (existing != 0 && existing != jobId + 1) revert InvalidParameters();

        _jobLabelById[jobId] = label;
        _jobLabelIsSet[jobId] = true;
        _jobIdPlusOneByLabelHash[labelHash] = jobId + 1;
    }

    function _importExactJobLabel(uint256 jobId, string memory label) internal {
        if (!_isValidExactJobLabelForJob(jobId, label)) revert InvalidParameters();

        if (_jobLabelIsSet[jobId]) {
            if (keccak256(bytes(_jobLabelById[jobId])) != keccak256(bytes(label))) {
                revert InvalidParameters();
            }
            return;
        }

        _snapshotJobLabel(jobId, label);
    }

    function _tryRootOwner() internal view returns (bool ok, address ownerAddress) {
        return _tryNodeOwner(jobsRootNode);
    }

    function _tryNodeOwner(bytes32 node) internal view returns (bool ok, address ownerAddress) {
        return _staticcallAddress(address(ens), abi.encodeWithSelector(ENS_OWNER_SELECTOR, node));
    }

    function _staticcallAddress(address target, bytes memory payload) internal view returns (bool ok, address result) {
        uint256 decoded;
        (ok, decoded) = _staticcallWord(target, payload);
        if (!ok) return (false, address(0));
        result = address(uint160(decoded));
    }

    function _staticcallBool(address target, bytes memory payload) internal view returns (bool ok, bool result) {
        uint256 decoded;
        (ok, decoded) = _staticcallWord(target, payload);
        if (!ok || decoded > 1) return (false, false);
        result = decoded == 1;
    }

    function _staticcallWord(address target, bytes memory payload) internal view returns (bool ok, uint256 word) {
        assembly {
            ok := staticcall(ENS_READ_GAS_LIMIT, target, add(payload, 0x20), mload(payload), 0x00, 0x20)
            if lt(returndatasize(), 0x20) {
                ok := 0
            }
            if ok {
                returndatacopy(0x00, 0x00, 0x20)
                word := mload(0x00)
            }
        }
    }
}
