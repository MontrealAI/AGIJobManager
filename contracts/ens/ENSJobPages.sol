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

    event JobENSPageCreated(uint256 indexed jobId, bytes32 indexed node);
    event JobENSPermissionsUpdated(uint256 indexed jobId, address indexed account, bool isAuthorised);
    event JobENSLocked(uint256 indexed jobId, bytes32 indexed node, bool fusesBurned);

    IENSRegistry public ens;
    INameWrapper public nameWrapper;
    IPublicResolver public publicResolver;
    bytes32 public jobsRootNode;
    string public jobsRootName;
    address public jobManager;

    constructor(
        address ensAddress,
        address nameWrapperAddress,
        address publicResolverAddress,
        bytes32 rootNode,
        string memory rootName
    ) {
        ens = IENSRegistry(ensAddress);
        nameWrapper = INameWrapper(nameWrapperAddress);
        publicResolver = IPublicResolver(publicResolverAddress);
        jobsRootNode = rootNode;
        jobsRootName = rootName;
    }

    function setENSRegistry(address ensAddress) external onlyOwner {
        if (ensAddress == address(0)) revert InvalidParameters();
        ens = IENSRegistry(ensAddress);
    }

    function setNameWrapper(address nameWrapperAddress) external onlyOwner {
        nameWrapper = INameWrapper(nameWrapperAddress);
    }

    function setPublicResolver(address publicResolverAddress) external onlyOwner {
        if (publicResolverAddress == address(0)) revert InvalidParameters();
        publicResolver = IPublicResolver(publicResolverAddress);
    }

    function setJobsRoot(bytes32 rootNode, string calldata rootName) external onlyOwner {
        if (rootNode == bytes32(0)) revert InvalidParameters();
        if (bytes(rootName).length == 0) revert InvalidParameters();
        jobsRootNode = rootNode;
        jobsRootName = rootName;
    }

    function setJobManager(address manager) external onlyOwner {
        if (manager == address(0)) revert InvalidParameters();
        jobManager = manager;
    }

    modifier onlyOwnerOrJobManager() {
        if (msg.sender != owner() && msg.sender != jobManager) revert ENSNotAuthorized();
        _;
    }


    function jobEnsLabel(uint256 jobId) public pure returns (string memory) {
        return string(abi.encodePacked("job-", jobId.toString()));
    }

    function jobEnsName(uint256 jobId) public view returns (string memory) {
        if (bytes(jobsRootName).length == 0) revert ENSNotConfigured();
        return string(abi.encodePacked(jobEnsLabel(jobId), ".", jobsRootName));
    }


    function jobEnsNode(uint256 jobId) public view returns (bytes32) {
        bytes32 labelHash = keccak256(bytes(jobEnsLabel(jobId)));
        return keccak256(abi.encodePacked(jobsRootNode, labelHash));
    }

    function createJobPage(uint256 jobId, address employer, string memory specURI) public onlyOwner {
        if (employer == address(0)) revert InvalidParameters();
        _requireConfigured();
        bytes32 node = _createSubname(jobId);
        emit JobENSPageCreated(jobId, node);
        publicResolver.setAuthorisation(node, employer, true);
        emit JobENSPermissionsUpdated(jobId, employer, true);
        _setTextBestEffort(node, "schema", "agijobmanager/v1");
        _setTextBestEffort(node, "agijobs.spec.public", specURI);
    }

    function handleHook(uint8 hook, uint256 jobId) external onlyOwnerOrJobManager {
        IAGIJobManagerView jobManager = IAGIJobManagerView(msg.sender);
        if (hook == 1) {
            string memory specURI = jobManager.getJobSpecURI(jobId);
            (address employer, , , , , , , , ) = jobManager.getJobCore(jobId);
            createJobPage(jobId, employer, specURI);
            return;
        }
        if (hook == 2) {
            (, address agent, , , , , , , ) = jobManager.getJobCore(jobId);
            onAgentAssigned(jobId, agent);
            return;
        }
        if (hook == 3) {
            string memory completionURI = jobManager.getJobCompletionURI(jobId);
            onCompletionRequested(jobId, completionURI);
            return;
        }
        if (hook == 4) {
            (address employer, address agent, , , , , , , ) = jobManager.getJobCore(jobId);
            revokePermissions(jobId, employer, agent);
            return;
        }
        if (hook == 5) {
            (address employer, address agent, , , , , , , ) = jobManager.getJobCore(jobId);
            lockJobENS(jobId, employer, agent, false);
            return;
        }
    }

    function onAgentAssigned(uint256 jobId, address agent) public onlyOwner {
        if (agent == address(0)) revert InvalidParameters();
        _requireConfigured();
        bytes32 node = jobEnsNode(jobId);
        publicResolver.setAuthorisation(node, agent, true);
        emit JobENSPermissionsUpdated(jobId, agent, true);
    }

    function onCompletionRequested(uint256 jobId, string memory completionURI) public onlyOwner {
        _requireConfigured();
        bytes32 node = jobEnsNode(jobId);
        _setTextBestEffort(node, "agijobs.completion.public", completionURI);
    }

    function revokePermissions(uint256 jobId, address employer, address agent) public onlyOwner {
        _requireConfigured();
        bytes32 node = jobEnsNode(jobId);
        _setAuthorisationBestEffort(jobId, node, employer, false);
        _setAuthorisationBestEffort(jobId, node, agent, false);
    }

    function lockJobENS(uint256 jobId, address employer, address agent, bool burnFuses) public onlyOwner {
        _requireConfigured();
        bytes32 node = jobEnsNode(jobId);
        _setAuthorisationBestEffort(jobId, node, employer, false);
        _setAuthorisationBestEffort(jobId, node, agent, false);

        bool fusesBurned = false;
        if (burnFuses && address(nameWrapper) != address(0)) {
            try nameWrapper.isWrapped(node) returns (bool wrapped) {
                if (wrapped) {
                    try nameWrapper.burnFuses(node, type(uint32).max) returns (uint32) {
                        fusesBurned = true;
                    } catch {
                    }
                }
            } catch {
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
        }
    }

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
        if (jobsRootNode == bytes32(0)) revert ENSNotConfigured();
    }
}
