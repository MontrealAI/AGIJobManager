// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract BoundedReturndataENS {
    uint8 public mode;
    address public resolverAddress;

    function setMode(uint8 value) external {
        mode = value;
    }

    function setResolverAddress(address value) external {
        resolverAddress = value;
    }

    function resolver(bytes32) external view returns (address) {
        _maybeGrief();
        if (mode == 1) revert();
        if (mode == 2) {
            assembly {
                mstore(0x0, 0x1234)
                return(0x1e, 0x02)
            }
        }
        if (mode == 3) {
            bytes memory huge = new bytes(4096);
            huge[31] = 0x20;
            assembly {
                return(add(huge, 32), 4096)
            }
        }
        return resolverAddress;
    }

    function _maybeGrief() private view {
        if (mode == 4) {
            while (gasleft() > 0) {
                // solhint-disable-previous-line no-empty-blocks
            }
        }
    }
}

contract BoundedReturndataNameWrapper {
    uint8 public mode;
    address public ownerValue;

    function setMode(uint8 value) external {
        mode = value;
    }

    function setOwnerValue(address value) external {
        ownerValue = value;
    }

    function ownerOf(uint256) external view returns (address) {
        _maybeGrief();
        if (mode == 1) revert();
        if (mode == 2) {
            assembly {
                mstore(0x0, 0x1234)
                return(0x1e, 0x02)
            }
        }
        if (mode == 3) {
            bytes memory huge = new bytes(4096);
            huge[31] = 0x20;
            assembly {
                return(add(huge, 32), 4096)
            }
        }
        return ownerValue;
    }

    function getApproved(uint256) external pure returns (address) {
        return address(0);
    }

    function isApprovedForAll(address, address) external pure returns (bool) {
        return false;
    }

    function _maybeGrief() private view {
        if (mode == 4) {
            while (gasleft() > 0) {
                // solhint-disable-previous-line no-empty-blocks
            }
        }
    }
}

contract BoundedReturndataResolver {
    uint8 public mode;
    address public addrValue;

    function setMode(uint8 value) external {
        mode = value;
    }

    function setAddrValue(address value) external {
        addrValue = value;
    }

    function addr(bytes32) external view returns (address) {
        _maybeGrief();
        if (mode == 1) revert();
        if (mode == 2) {
            assembly {
                mstore(0x0, 0x1234)
                return(0x1e, 0x02)
            }
        }
        if (mode == 3) {
            bytes memory huge = new bytes(4096);
            huge[31] = 0x20;
            assembly {
                return(add(huge, 32), 4096)
            }
        }
        return addrValue;
    }

    function _maybeGrief() private view {
        if (mode == 4) {
            while (gasleft() > 0) {
                // solhint-disable-previous-line no-empty-blocks
            }
        }
    }
}
