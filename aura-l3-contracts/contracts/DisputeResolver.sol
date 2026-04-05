// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DisputeResolver {
    event DisputeRaised(address indexed who, uint256 proposalId, string reason);

    modifier onlyCitizen() {
        // Check governance voting eligibility
        _;
    }

    function raiseDispute(uint256 proposalId, string calldata reason) external onlyCitizen {
        emit DisputeRaised(msg.sender, proposalId, reason);
        // AI/Moderator node listens to this event and proposes a resolution offchain
    }
}
