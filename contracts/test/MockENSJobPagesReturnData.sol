// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockENSJobPagesReturnData {
    uint8 public mode;

    function setMode(uint8 newMode) external {
        mode = newMode;
    }

    function handleHook(uint8, uint256) external {}

    function jobEnsURI(uint256) external view returns (string memory) {
        if (mode == 2) {
            return "ens://valid-uri";
        }
        assembly {
            let ptr := mload(0x40)
            switch sload(mode.slot)
            case 0 {
                mstore(ptr, 0x1234)
                return(ptr, 32)
            }
            default {
                mstore(ptr, 0x20)
                return(ptr, 32)
            }
        }
    }
}
