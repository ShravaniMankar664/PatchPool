// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPatchPoolActions {
    function fundBounty(uint256 bountyId) external payable;
    function refundExpired(uint256 bountyId) external;
    function releaseReward(uint256 bountyId) external;
}

/// @dev Test helper that attempts to repeat the active settlement call on receipt.
contract ReentrantActor {
    IPatchPoolActions public immutable POOL;
    uint256 private activeBountyId;
    uint8 private activeAction;

    bool public reentryAttempted;
    bool public reentrySucceeded;

    constructor(address poolAddress) {
        POOL = IPatchPoolActions(poolAddress);
    }

    function contribute(uint256 bountyId) external payable {
        POOL.fundBounty{value: msg.value}(bountyId);
    }

    function claimRefund(uint256 bountyId) external {
        activeBountyId = bountyId;
        activeAction = 1;
        POOL.refundExpired(bountyId);
        activeAction = 0;
    }

    function claimReward(uint256 bountyId) external {
        activeBountyId = bountyId;
        activeAction = 2;
        POOL.releaseReward(bountyId);
        activeAction = 0;
    }

    receive() external payable {
        _attemptReentry();
    }

    function _attemptReentry() private {
        if (activeAction == 0) return;
        reentryAttempted = true;
        bytes4 selector = activeAction == 1
            ? IPatchPoolActions.refundExpired.selector
            : IPatchPoolActions.releaseReward.selector;
        // solhint-disable avoid-low-level-calls
        (reentrySucceeded, ) = address(POOL).call(
            abi.encodeWithSelector(selector, activeBountyId)
        );
        // solhint-enable avoid-low-level-calls
    }
}
