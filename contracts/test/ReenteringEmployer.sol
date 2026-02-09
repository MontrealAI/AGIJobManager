// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface AGIJobManagerLike {
    function createJob(string memory _jobSpecURI, uint256 _payout, uint256 _duration, string memory _details) external;
}

contract ReenteringEmployer {
    AGIJobManagerLike public jobManager;
    IERC20 public token;
    uint256 public jobId;
    bool public attempted;
    bool public reentered;

    constructor(address manager, address agiToken) {
        jobManager = AGIJobManagerLike(manager);
        token = IERC20(agiToken);
    }

    function setJobId(uint256 _jobId) external {
        jobId = _jobId;
    }

    function createJob(string memory spec, uint256 payout, uint256 duration, string memory details) external {
        token.approve(address(jobManager), payout);
        jobManager.createJob(spec, payout, duration, details);
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
