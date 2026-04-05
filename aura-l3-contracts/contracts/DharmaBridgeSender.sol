// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DharmaBridgeSender {
    event CrossChainSend(bytes32 payloadHash, string dstChain);

    modifier onlyCitizen() {
        // Here we could integrate KarmaGuardian eligibility
        _;
    }

    function sendKarmaToChain(address citizen, string memory dstChain, uint256 karma) public onlyCitizen {
        emit CrossChainSend(keccak256(abi.encodePacked(citizen, dstChain, karma)), dstChain);
    }
}
