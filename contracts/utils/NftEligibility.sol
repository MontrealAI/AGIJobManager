// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @notice Bounded ERC-721 eligibility registry. Scores never determine USDC payouts.
/// @dev Linked library: writes operate on the manager-supplied registry. The manager
/// enforces ownership and empty reserves before every registry mutation.
library NftEligibility {
    struct AGIType {
        address nftAddress;
        uint256 payoutPercentage;
    }

    error InvalidParameters();
    event AGITypeUpdated(address indexed nftAddress, uint256 indexed payoutPercentage);

    uint256 internal constant MAX_AGI_TYPES = 32;
    uint256 internal constant NFT_BALANCE_OF_GAS_LIMIT = 100_000;
    uint256 internal constant ERC165_GAS_LIMIT = 50_000;

    function add(AGIType[] storage agiTypes, address nftAddress, uint256 payoutPercentage) external {
        if (!(nftAddress != address(0) && payoutPercentage > 0 && payoutPercentage <= 100)) revert InvalidParameters();
        if (!_supportsERC721(nftAddress)) {
            revert InvalidParameters();
        }

        if (!_updateAgiTypePayout(agiTypes, nftAddress, payoutPercentage)) {
            uint256 length = agiTypes.length;
            if (length < MAX_AGI_TYPES) {
                agiTypes.push(AGIType({ nftAddress: nftAddress, payoutPercentage: payoutPercentage }));
            } else {
                for (uint256 i = 0; i < length; ) {
                    AGIType storage agiType = agiTypes[i];
                    if (agiType.payoutPercentage == 0) {
                        agiType.nftAddress = nftAddress;
                        agiType.payoutPercentage = payoutPercentage;
                        emit AGITypeUpdated(nftAddress, payoutPercentage);
                        return;
                    }
                    unchecked {
                        ++i;
                    }
                }
                revert InvalidParameters();
            }
        }
        emit AGITypeUpdated(nftAddress, payoutPercentage);
    }

    function disable(AGIType[] storage agiTypes, address nftAddress) external {
        if (!_updateAgiTypePayout(agiTypes, nftAddress, 0)) revert InvalidParameters();
        emit AGITypeUpdated(nftAddress, 0);
    }

    function _updateAgiTypePayout(AGIType[] storage agiTypes, address nftAddress, uint256 payoutPercentage) internal returns (bool) {
        for (uint256 i = 0; i < agiTypes.length; ) {
            AGIType storage agiType = agiTypes[i];
            if (agiType.nftAddress == nftAddress) {
                agiType.payoutPercentage = payoutPercentage;
                return true;
            }
            unchecked {
                ++i;
            }
        }
        return false;
    }

    function _supportsERC721(address nftAddress) internal view returns (bool isSupported) {
        assembly {
            if gt(extcodesize(nftAddress), 0) {
                let ptr := mload(0x40)
                mstore(ptr, 0x01ffc9a700000000000000000000000000000000000000000000000000000000)
                mstore(add(ptr, 0x04), shl(224, 0x01ffc9a7))
                isSupported := staticcall(ERC165_GAS_LIMIT, nftAddress, ptr, 0x24, ptr, 0x20)
                isSupported := and(isSupported, gt(returndatasize(), 0x1f))
                isSupported := and(isSupported, eq(mload(ptr), 1))
                if isSupported {
                    mstore(ptr, 0x01ffc9a700000000000000000000000000000000000000000000000000000000)
                    mstore(add(ptr, 0x04), shl(224, 0x80ac58cd))
                    isSupported := staticcall(ERC165_GAS_LIMIT, nftAddress, ptr, 0x24, ptr, 0x20)
                    isSupported := and(isSupported, gt(returndatasize(), 0x1f))
                    isSupported := and(isSupported, eq(mload(ptr), 1))
                }
                if isSupported {
                    // ERC-165 requires the invalid interface to return exactly false.
                    mstore(ptr, 0x01ffc9a700000000000000000000000000000000000000000000000000000000)
                    mstore(add(ptr, 0x04), shl(224, 0xffffffff))
                    isSupported := staticcall(ERC165_GAS_LIMIT, nftAddress, ptr, 0x24, ptr, 0x20)
                    isSupported := and(isSupported, gt(returndatasize(), 0x1f))
                    isSupported := and(isSupported, iszero(mload(ptr)))
                }
            }
        }
    }


    function highestScore(AGIType[] storage agiTypes, address agent) external view returns (uint256) {
        uint256 highestPercentage = 0;
        for (uint256 i = 0; i < agiTypes.length; ) {
            AGIType storage agiType = agiTypes[i];
            uint256 payoutPercentage = agiType.payoutPercentage;
            if (payoutPercentage > highestPercentage) {
                uint256 tokenBalance;
                address nftAddress = agiType.nftAddress;
                assembly {
                    let ptr := mload(0x40)
                    mstore(ptr, 0x70a0823100000000000000000000000000000000000000000000000000000000)
                    mstore(add(ptr, 0x04), agent)
                    let success := staticcall(NFT_BALANCE_OF_GAS_LIMIT, nftAddress, ptr, 0x24, ptr, 0x20)
                    if and(success, gt(returndatasize(), 0x1f)) {
                        tokenBalance := mload(ptr)
                    }
                }
                if (tokenBalance > 0) {
                    highestPercentage = payoutPercentage;
                }
            }
            unchecked {
                ++i;
            }
        }
        return highestPercentage;
    }
}
