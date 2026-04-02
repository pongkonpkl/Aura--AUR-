// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract GuardianOracle {
    address public admin;
    mapping(bytes32 => bool) public approvedConfigs;
    event AuditRequest(address indexed submitter, bytes32 configHash);
    event AuditResult(bytes32 configHash, bool approved);

    constructor() { admin = msg.sender; }

    function submitAudit(bytes32 configHash) external {
        emit AuditRequest(msg.sender, configHash);
    }

    // Backend AI Guardian calls this
    function postAuditResult(bytes32 configHash, bool approved) external {
        require(msg.sender == admin, "Not admin");
        approvedConfigs[configHash] = approved;
        emit AuditResult(configHash, approved);
    }

    function setAdmin(address newAdmin) external {
        require(msg.sender == admin);
        admin = newAdmin;
    }
}
