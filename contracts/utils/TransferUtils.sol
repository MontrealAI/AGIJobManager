// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library TransferUtils {
    error TransferFailed();

    /// @dev Strict ERC20 call wrapper: only contract targets are accepted and return data must be
    /// either empty (non-standard tokens) or ABI-encoded bool(true).
    function safeTransfer(address token, address to, uint256 amount) external {
        if (amount == 0) return;
        if (token.code.length == 0) revert TransferFailed();
        _callOptionalReturn(token, abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
    }

    /// @dev Enforces exact transfer semantics by measuring recipient balance deltas.
    /// Fee-on-transfer / deflationary transfers intentionally revert.
    function safeTransferFromExact(address token, address from, address to, uint256 amount) external {
        if (amount == 0) return;
        if (token.code.length == 0) revert TransferFailed();
        uint256 balanceBefore = _safeBalanceOf(token, to);
        _callOptionalReturn(token, abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
        uint256 balanceAfter = _safeBalanceOf(token, to);
        if (balanceAfter < balanceBefore || balanceAfter - balanceBefore != amount) revert TransferFailed();
    }

    function _safeBalanceOf(address token, address account) private view returns (uint256 balance) {
        (bool success, bytes memory returndata) = token.staticcall(
            abi.encodeWithSelector(IERC20.balanceOf.selector, account)
        );
        if (!success || returndata.length != 32) revert TransferFailed();
        balance = abi.decode(returndata, (uint256));
    }

    function _callOptionalReturn(address token, bytes memory data) private {
        (bool success, bytes memory returndata) = token.call(data);
        if (!success) revert TransferFailed();
        if (returndata.length == 0) return;
        if (returndata.length == 32) {
            uint256 word;
            assembly {
                word := mload(add(returndata, 0x20))
            }
            if (word > 1 || word == 0) revert TransferFailed();
            return;
        }
        revert TransferFailed();
    }
}
