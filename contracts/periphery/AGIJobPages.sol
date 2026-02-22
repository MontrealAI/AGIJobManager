// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract AGIJobPages is Ownable {
    using Strings for uint256;

    error InvalidParameters();
    error NotJobManager();

    event HookObserved(uint8 indexed hook, uint256 indexed jobId, address indexed caller);
    event BaseMetadataURIUpdated(string oldValue, string newValue);
    event DefaultImageURIUpdated(string oldValue, string newValue);
    event ExternalUrlBaseUpdated(string oldValue, string newValue);
    event UseJobIdJsonSuffixUpdated(bool oldValue, bool newValue);
    event JobManagerUpdated(address indexed oldValue, address indexed newValue);

    string public baseMetadataURI;
    string public defaultImageURI;
    string public externalUrlBase;
    bool public useJobIdJsonSuffix;
    address public jobManager;

    constructor(string memory baseMetadataURI_, string memory externalUrlBase_) {
        baseMetadataURI = baseMetadataURI_;
        externalUrlBase = externalUrlBase_;
        defaultImageURI = "ipfs://Qmc13BByj8xKnpgQtwBereGJpEXtosLMLq6BCUjK3TtAd1";
        useJobIdJsonSuffix = true;
    }

    function setBaseMetadataURI(string calldata newValue) external onlyOwner {
        string memory oldValue = baseMetadataURI;
        baseMetadataURI = newValue;
        emit BaseMetadataURIUpdated(oldValue, newValue);
    }

    function setDefaultImageURI(string calldata newValue) external onlyOwner {
        if (bytes(newValue).length == 0) revert InvalidParameters();
        string memory oldValue = defaultImageURI;
        defaultImageURI = newValue;
        emit DefaultImageURIUpdated(oldValue, newValue);
    }

    function setExternalUrlBase(string calldata newValue) external onlyOwner {
        string memory oldValue = externalUrlBase;
        externalUrlBase = newValue;
        emit ExternalUrlBaseUpdated(oldValue, newValue);
    }

    function setUseJobIdJsonSuffix(bool enabled) external onlyOwner {
        bool oldValue = useJobIdJsonSuffix;
        useJobIdJsonSuffix = enabled;
        emit UseJobIdJsonSuffixUpdated(oldValue, enabled);
    }

    function setJobManager(address newValue) external onlyOwner {
        if (newValue != address(0) && newValue.code.length == 0) revert InvalidParameters();
        address oldValue = jobManager;
        jobManager = newValue;
        emit JobManagerUpdated(oldValue, newValue);
    }

    function handleHook(uint8 hook, uint256 jobId) external {
        if (msg.sender != jobManager) revert NotJobManager();
        emit HookObserved(hook, jobId, msg.sender);
    }

    function previewTokenURI(uint256 jobId) external view returns (string memory) {
        return _resolveTokenURI(jobId);
    }
    function jobEnsURI(uint256 jobId) external view returns (string memory) {
        return _resolveTokenURI(jobId);
    }


    fallback() external {
        bytes4 selector;
        assembly {
            selector := shr(224, calldataload(0))
        }
        if (selector != 0x751809b4) {
            return;
        }

        uint256 jobId;
        assembly {
            if lt(calldatasize(), 0x24) {
                revert(0, 0)
            }
            jobId := calldataload(4)
        }
        string memory uri = _resolveTokenURI(jobId);
        bytes memory payload = abi.encode(uri);
        assembly {
            return(add(payload, 32), mload(payload))
        }
    }

    function _resolveTokenURI(uint256 jobId) internal view returns (string memory) {
        if (bytes(baseMetadataURI).length == 0) {
            return "";
        }
        if (!useJobIdJsonSuffix) {
            return string(abi.encodePacked(baseMetadataURI, jobId.toString()));
        }
        return string(abi.encodePacked(baseMetadataURI, jobId.toString(), ".json"));
    }
}
