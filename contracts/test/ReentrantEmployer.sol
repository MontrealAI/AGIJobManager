// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IJobManager {
    function nextJobId() external view returns (uint256);
    function createJob(string memory _jobSpecURI, uint256 _payout, uint256 _duration, string memory _details) external;
}

interface IERC20Like {
    function approve(address spender, uint256 amount) external returns (bool);
}

contract ReentrantEmployer {
    IJobManager public immutable jobManager;
    uint256 public jobId;
    bool public attempted;
    bool public reentered;

    constructor(address manager) {
        jobManager = IJobManager(manager);
    }

    function approveToken(address token, address spender, uint256 amount) external {
        IERC20Like(token).approve(spender, amount);
    }

    function createJob(string memory jobSpecURI, uint256 payout, uint256 duration, string memory details) external returns (uint256) {
        uint256 nextId = jobManager.nextJobId();
        jobManager.createJob(jobSpecURI, payout, duration, details);
        jobId = nextId;
        return nextId;
    }

    function onTokenTransfer(address, uint256) external {
        if (attempted) {
            return;
        }
        attempted = true;
        (bool success, ) = address(jobManager).call(abi.encodeWithSignature("cancelJob(uint256)", jobId));
        reentered = success;
    }
}
