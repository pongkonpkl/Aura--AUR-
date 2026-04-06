// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract KarmaGuardian {
    address public aiRegulator;
    mapping(address => uint256) public karmaScore;

    constructor(address _aiRegulator) {
        aiRegulator = _aiRegulator;
    }

    modifier onlyAIRegulator() {
        require(msg.sender == aiRegulator, "Only AI Regulator");
        _;
    }

    function updateKarma(address citizen, int256 delta) public onlyAIRegulator {
        int256 base = int256(karmaScore[citizen]);
        karmaScore[citizen] = uint256(base + delta > 0 ? base + delta : int256(0));
    }

    function eligibleToVote(address citizen) public view returns(bool) {
        return karmaScore[citizen] > 10;
    }
}
