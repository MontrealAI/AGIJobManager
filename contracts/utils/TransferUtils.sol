// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library TransferUtils {
    error TransferFailed();

    function safeTransfer(address token, address to, uint256 amount) external {
        if (amount == 0) return;
        _callOptionalReturn(token, abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
    }

    function safeTransferFromExact(address token, address from, address to, uint256 amount) external {
        if (amount == 0) return;
        // Mainnet hardening: exact receive semantics reject fee-on-transfer and rebasing side effects.
        uint256 balanceBefore = IERC20(token).balanceOf(to);
        _callOptionalReturn(token, abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
        uint256 balanceAfter = IERC20(token).balanceOf(to);
        if (balanceAfter < balanceBefore || balanceAfter - balanceBefore != amount) revert TransferFailed();
    }

    function _callOptionalReturn(address token, bytes memory data) private {
        (bool success, bytes memory returndata) = token.call(data);
        if (!success) revert TransferFailed();
        if (returndata.length == 0) return;
        if (returndata.length == 32) {
            if (!abi.decode(returndata, (bool))) revert TransferFailed();
            return;
        }
        revert TransferFailed();
    }
}
