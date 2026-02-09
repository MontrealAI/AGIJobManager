// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IAGIJobManager {
    function createJob(string memory _jobSpecURI, uint256 _payout, uint256 _duration, string memory _details) external;
    function cancelJob(uint256 _jobId) external;
    function nextJobId() external view returns (uint256);
}

contract ReenteringEmployer {
    IAGIJobManager public jobManager;
    uint256 public jobId;
    bool public attempted;
    bool public reentered;

    constructor(address manager) {
        jobManager = IAGIJobManager(manager);
    }

    function approveToken(address token, address spender, uint256 amount) external {
        IERC20(token).approve(spender, amount);
    }

    function createJob(
        string memory jobSpecURI,
        uint256 payout,
        uint256 duration,
        string memory details
    ) external {
        jobId = jobManager.nextJobId();
        jobManager.createJob(jobSpecURI, payout, duration, details);
    }

    function onTokenTransfer(address, uint256) external {
        if (attempted) {
            return;
        }
        attempted = true;
        (bool ok, ) = address(jobManager).call(abi.encodeWithSignature("cancelJob(uint256)", jobId));
        reentered = ok;
    }
}
