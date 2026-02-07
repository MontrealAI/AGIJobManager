// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

interface IENSRegistry {
    function owner(bytes32 node) external view returns (address);
    function setSubnodeRecord(bytes32 node, bytes32 label, address owner, address resolver, uint64 ttl) external;
}

interface IPublicResolver {
    function setAuthorisation(bytes32 node, address target, bool isAuthorized) external;
    function setText(bytes32 node, string calldata key, string calldata value) external;
}

interface INameWrapper {
    function ownerOf(uint256 id) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function setSubnodeRecord(
        bytes32 parentNode,
        string calldata label,
        address owner,
        address resolver,
        uint64 ttl,
        uint32 fuses,
        uint64 expiry
    ) external;
}

interface IAGIJobManagerRead {
    function getJobSpecURI(uint256 jobId) external view returns (string memory);
    function getJobCompletionURI(uint256 jobId) external view returns (string memory);
}

contract ENSJobPages is Ownable {
    using Strings for uint256;

    error Misconfigured();
    error NotAuthorized();

    uint8 internal constant HOOK_CREATE = 1;
    uint8 internal constant HOOK_ASSIGN = 2;
    uint8 internal constant HOOK_REVOKE = 3;
    uint8 internal constant HOOK_LOCK = 4;

    event ENSJobPagesConfigured(
        address indexed ens,
        address indexed nameWrapper,
        address indexed publicResolver,
        bytes32 jobsRootNode,
        string jobsRootName,
        address jobManager
    );
    event JobENSPageCreated(uint256 indexed jobId, bytes32 indexed node);
    event JobENSPermissionsUpdated(uint256 indexed jobId, address indexed operator, bool allowed);
    event JobENSLocked(uint256 indexed jobId, bytes32 indexed node, bool fusesBurned);

    IENSRegistry public ens;
    INameWrapper public nameWrapper;
    IPublicResolver public publicResolver;
    bytes32 public jobsRootNode;
    string public jobsRootName;
    address public jobManager;

    constructor(
        IENSRegistry _ens,
        INameWrapper _nameWrapper,
        IPublicResolver _publicResolver,
        bytes32 _jobsRootNode,
        string memory _jobsRootName,
        address _jobManager
    ) {
        ens = _ens;
        nameWrapper = _nameWrapper;
        publicResolver = _publicResolver;
        jobsRootNode = _jobsRootNode;
        jobsRootName = _jobsRootName;
        jobManager = _jobManager;
        emit ENSJobPagesConfigured(
            address(_ens),
            address(_nameWrapper),
            address(_publicResolver),
            _jobsRootNode,
            _jobsRootName,
            _jobManager
        );
    }

    function setConfig(
        IENSRegistry _ens,
        INameWrapper _nameWrapper,
        IPublicResolver _publicResolver,
        bytes32 _jobsRootNode,
        string calldata _jobsRootName,
        address _jobManager
    ) external onlyOwner {
        ens = _ens;
        nameWrapper = _nameWrapper;
        publicResolver = _publicResolver;
        jobsRootNode = _jobsRootNode;
        jobsRootName = _jobsRootName;
        jobManager = _jobManager;
        emit ENSJobPagesConfigured(
            address(_ens),
            address(_nameWrapper),
            address(_publicResolver),
            _jobsRootNode,
            _jobsRootName,
            _jobManager
        );
    }

    function jobEnsLabel(uint256 jobId) public pure returns (string memory) {
        return string(abi.encodePacked("job-", jobId.toString()));
    }

    function jobEnsName(uint256 jobId) external view returns (string memory) {
        if (bytes(jobsRootName).length == 0) revert Misconfigured();
        return string(abi.encodePacked(jobEnsLabel(jobId), ".", jobsRootName));
    }


    function jobEnsNode(uint256 jobId) public view returns (bytes32) {
        return _jobEnsNode(jobId);
    }

    function createJobPage(uint256 jobId, address employer, string calldata specURI) external onlyOwner {
        _createJobPage(jobId, employer, specURI);
    }

    function onAgentAssigned(uint256 jobId, address agent) external onlyOwner {
        _authorizeAgent(jobId, agent);
    }

    function onCompletionRequested(uint256 jobId, string calldata completionURI) external onlyOwner {
        _completionRequested(jobId, completionURI);
    }

    function revokePermissions(uint256 jobId, address employer, address agent) public onlyOwner {
        _revokePermissions(jobId, employer, agent);
    }

    function lockJobENS(uint256 jobId, address employer, address agent, bool burnFuses) external {
        _lockJobENS(jobId, employer, agent, burnFuses);
    }

    function handleHook(
        uint8 hook,
        uint256 jobId,
        address employer,
        address agent,
        bool burnFuses
    ) external onlyOwner {
        if (hook == HOOK_CREATE) {
            _createJobPage(jobId, employer, _readJobSpecURI(jobId));
        } else if (hook == HOOK_ASSIGN) {
            _authorizeAgent(jobId, agent);
        } else if (hook == HOOK_REVOKE) {
            _revokePermissions(jobId, employer, agent);
        } else if (hook == HOOK_LOCK) {
            _lockJobENS(jobId, employer, agent, burnFuses);
        } else {
            revert Misconfigured();
        }
    }

    function _requireConfigured() internal view {
        if (address(ens) == address(0)) revert Misconfigured();
        if (address(publicResolver) == address(0)) revert Misconfigured();
        if (jobsRootNode == bytes32(0)) revert Misconfigured();
    }

    function _createJobPage(uint256 jobId, address employer, string memory specURI) internal {
        _requireConfigured();
        bytes32 node = _createSubname(jobId);
        publicResolver.setAuthorisation(node, employer, true);
        emit JobENSPageCreated(jobId, node);
        emit JobENSPermissionsUpdated(jobId, employer, true);

        _trySetText(node, "schema", "agijobmanager/v1");
        _trySetText(node, "agijobs.spec.public", specURI);
    }

    function _authorizeAgent(uint256 jobId, address agent) internal {
        bytes32 node = _jobEnsNode(jobId);
        publicResolver.setAuthorisation(node, agent, true);
        emit JobENSPermissionsUpdated(jobId, agent, true);
    }

    function _completionRequested(uint256 jobId, string memory completionURI) internal {
        bytes32 node = _jobEnsNode(jobId);
        _trySetText(node, "agijobs.completion.public", completionURI);
    }

    function _readJobSpecURI(uint256 jobId) internal view returns (string memory) {
        if (jobManager == address(0)) return "";
        try IAGIJobManagerRead(jobManager).getJobSpecURI(jobId) returns (string memory uri) {
            return uri;
        } catch {
            return "";
        }
    }


    function _revokePermissions(uint256 jobId, address employer, address agent) internal {
        bytes32 node = _jobEnsNode(jobId);
        _trySetAuthorisation(node, employer, false, jobId);
        if (agent != address(0)) {
            _trySetAuthorisation(node, agent, false, jobId);
        }
    }

    function _lockJobENS(uint256 jobId, address employer, address agent, bool burnFuses) internal {
        bytes32 node = _jobEnsNode(jobId);
        _revokePermissions(jobId, employer, agent);
        bool fusesBurned = false;
        if (burnFuses) {
            fusesBurned = false;
        }
        emit JobENSLocked(jobId, node, fusesBurned);
    }

    function _jobEnsNode(uint256 jobId) internal view returns (bytes32) {
        bytes32 labelHash = keccak256(bytes(jobEnsLabel(jobId)));
        return keccak256(abi.encodePacked(jobsRootNode, labelHash));
    }

    function _createSubname(uint256 jobId) internal returns (bytes32 node) {
        string memory label = jobEnsLabel(jobId);
        bytes32 labelHash = keccak256(bytes(label));
        address rootOwner = ens.owner(jobsRootNode);
        if (rootOwner == address(nameWrapper)) {
            address wrapperOwner = nameWrapper.ownerOf(uint256(jobsRootNode));
            if (wrapperOwner != address(this) && !nameWrapper.isApprovedForAll(wrapperOwner, address(this))) {
                revert NotAuthorized();
            }
            nameWrapper.setSubnodeRecord(
                jobsRootNode,
                label,
                address(this),
                address(publicResolver),
                0,
                0,
                type(uint64).max
            );
            node = keccak256(abi.encodePacked(jobsRootNode, labelHash));
        } else {
            if (rootOwner != address(this)) revert NotAuthorized();
            ens.setSubnodeRecord(jobsRootNode, labelHash, address(this), address(publicResolver), 0);
            node = keccak256(abi.encodePacked(jobsRootNode, labelHash));
        }
    }

    function _trySetText(bytes32 node, string memory key, string memory value) internal {
        try publicResolver.setText(node, key, value) {} catch {}
    }

    function _trySetAuthorisation(bytes32 node, address operator, bool allowed, uint256 jobId) internal {
        if (operator == address(0)) {
            return;
        }
        try publicResolver.setAuthorisation(node, operator, allowed) {
            emit JobENSPermissionsUpdated(jobId, operator, allowed);
        } catch {}
    }
}
