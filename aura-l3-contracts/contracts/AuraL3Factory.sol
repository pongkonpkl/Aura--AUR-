// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./GuardianOracle.sol";

contract AuraL3Factory {
    address public guardianOracle;
    event RequestL3Deploy(address indexed requester, bytes32 configHash, uint256 salt);
    event L3Deployed(address indexed l3, address indexed owner, bytes32 configHash, uint256 salt);

    mapping(bytes32 => bool) public isApproved;

    constructor(address _oracle) {
        guardianOracle = _oracle;
    }

    function requestL3Deploy(bytes32 configHash, uint256 salt) external {
        emit RequestL3Deploy(msg.sender, configHash, salt);
    }

    // Called by backend/oracle when config passed
    function approveAndDeploy(bytes32 configHash, uint256 salt, bytes memory l3Bytecode) external {
        require(msg.sender == guardianOracle, "Not authorized");
        require(!isApproved[configHash], "Already approved");
        isApproved[configHash] = true;

        address l3;
        // Deploy L3 chain (minimal Create2 or proxy for POC)
        assembly {
            l3 := create2(0, add(l3Bytecode, 0x20), mload(l3Bytecode), salt)
            if iszero(extcodesize(l3)) {
                revert(0, 0)
            }
        }
        emit L3Deployed(l3, tx.origin, configHash, salt);
    }

    function setGuardianOracle(address _oracle) external {
        // Add onlyOwner for production!
        guardianOracle = _oracle;
    }
}
