// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AuraRewardDistributor
 * @notice 2-phase distribution: propose → AI approve/freeze → mint
 * @dev Wraps EternityPool. Existing distribute() on EternityPool is still valid
 *      but this contract adds an AI Guardian gate before calling it.
 *
 *      FLOW:
 *      1. Owner calls proposeDistribution() with addresses + weights
 *      2. AI Guardian node listens for DistributionProposed event
 *      3. AI runs anomaly/sybil check off-chain
 *      4. Guardian calls approveDistribution() or freezeDistribution()
 *      5. If approved → executeDistribution() mints via EternityPool
 */

interface IEternityPool {
    function distribute(address[] calldata recipients, uint256[] calldata shares) external;
}

interface IReputationNFT {
    function getMultiplier(address user) external view returns (uint256);
}

contract AuraRewardDistributor is Ownable {
    // ─── State ────────────────────────────────────────────
    IEternityPool public eternityPool;
    IReputationNFT public reputationNFT;

    mapping(address => bool) public isGuardian;
    uint256 public guardianCount;

    enum Status { NONE, PENDING, APPROVED, FROZEN, DISTRIBUTED }

    struct Distribution {
        uint256 dayId;
        address[] users;
        uint256[] weights;
        Status status;
        address proposedBy;
        address reviewedBy;
        string freezeReason;
        uint256 proposedAt;
        uint256 reviewedAt;
    }

    mapping(uint256 => Distribution) public distributions;
    uint256 public currentSlotId;

    // ─── Events (audit trail) ─────────────────────────────
    event DistributionProposed(uint256 indexed slotId, uint256 recipientCount, uint256 totalWeight);
    event DistributionApproved(uint256 indexed slotId, address indexed guardian);
    event DistributionFrozen(uint256 indexed slotId, address indexed guardian, string reason);
    event DistributionExecuted(uint256 indexed slotId, uint256 recipientCount);
    event GuardianAdded(address indexed guardian);
    event GuardianRemoved(address indexed guardian);

    // ─── Modifiers ────────────────────────────────────────
    modifier onlyGuardian() {
        require(isGuardian[msg.sender], "AuraDistributor: not guardian");
        _;
    }

    // ─── Constructor ──────────────────────────────────────
    constructor(address _eternityPool) Ownable(msg.sender) {
        eternityPool = IEternityPool(_eternityPool);
        // Owner is the first guardian
        isGuardian[msg.sender] = true;
        guardianCount = 1;
        emit GuardianAdded(msg.sender);
    }

    // ─── Guardian Management ──────────────────────────────
    function addGuardian(address _guardian) external onlyOwner {
        require(!isGuardian[_guardian], "Already guardian");
        isGuardian[_guardian] = true;
        guardianCount++;
        emit GuardianAdded(_guardian);
    }

    function removeGuardian(address _guardian) external onlyOwner {
        require(isGuardian[_guardian], "Not guardian");
        require(guardianCount > 1, "Cannot remove last guardian");
        isGuardian[_guardian] = false;
        guardianCount--;
        emit GuardianRemoved(_guardian);
    }

    // ─── Configuration ────────────────────────────────────
    function setReputationNFT(address _nft) external onlyOwner {
        reputationNFT = IReputationNFT(_nft);
    }

    function setEternityPool(address _pool) external onlyOwner {
        eternityPool = IEternityPool(_pool);
    }

    // ─── §1 Phase 1: Propose Distribution ─────────────────
    function proposeDistribution(
        address[] calldata users,
        uint256[] calldata weights
    ) external onlyOwner {
        require(users.length == weights.length, "Length mismatch");
        require(users.length > 0, "Empty distribution");

        uint256 slotId = block.timestamp / 60;
        require(
            distributions[slotId].status == Status.NONE ||
            distributions[slotId].status == Status.FROZEN,
            "Distribution already active for current minute"
        );

        uint256 totalWeight = 0;
        for (uint256 i = 0; i < weights.length; i++) {
            totalWeight += weights[i];
        }
        require(totalWeight > 0, "Zero total weight");

        Distribution storage d = distributions[slotId];
        d.dayId = slotId;
        d.users = users;
        d.weights = weights;
        d.status = Status.PENDING;
        d.proposedBy = msg.sender;
        d.proposedAt = block.timestamp;
        d.freezeReason = "";
        d.reviewedBy = address(0);
        d.reviewedAt = 0;

        currentSlotId = slotId;

        emit DistributionProposed(slotId, users.length, totalWeight);
    }

    // ─── §1 Phase 2a: AI Approve ──────────────────────────
    function approveDistribution(uint256 dayId) external onlyGuardian {
        Distribution storage d = distributions[dayId];
        require(d.status == Status.PENDING, "Not pending");

        d.status = Status.APPROVED;
        d.reviewedBy = msg.sender;
        d.reviewedAt = block.timestamp;

        emit DistributionApproved(dayId, msg.sender);
    }

    // ─── §1 Phase 2b: AI Freeze ──────────────────────────
    function freezeDistribution(
        uint256 dayId,
        string calldata reason
    ) external onlyGuardian {
        Distribution storage d = distributions[dayId];
        require(d.status == Status.PENDING, "Not pending");

        d.status = Status.FROZEN;
        d.reviewedBy = msg.sender;
        d.reviewedAt = block.timestamp;
        d.freezeReason = reason;

        emit DistributionFrozen(dayId, msg.sender, reason);
    }

    // ─── §1 Phase 3: Execute (mint & distribute) ──────────
    function executeDistribution(uint256 dayId) external onlyOwner {
        Distribution storage d = distributions[dayId];
        require(d.status == Status.APPROVED, "Not approved by guardian");

        // Apply NFT multipliers if reputationNFT is set
        uint256[] memory adjustedWeights = new uint256[](d.weights.length);
        for (uint256 i = 0; i < d.weights.length; i++) {
            uint256 multiplier = 10000; // default 1.0x (basis points)
            if (address(reputationNFT) != address(0)) {
                multiplier = reputationNFT.getMultiplier(d.users[i]);
                if (multiplier == 0) multiplier = 10000;
            }
            adjustedWeights[i] = (d.weights[i] * multiplier) / 10000;
        }

        // Call EternityPool.distribute() — existing mint logic preserved
        eternityPool.distribute(d.users, adjustedWeights);

        d.status = Status.DISTRIBUTED;

        emit DistributionExecuted(dayId, d.users.length);
    }

    // ─── View Helpers ─────────────────────────────────────
    function getDistributionStatus(uint256 dayId) external view returns (
        Status status,
        uint256 recipientCount,
        address reviewedBy,
        string memory freezeReason
    ) {
        Distribution storage d = distributions[dayId];
        return (d.status, d.users.length, d.reviewedBy, d.freezeReason);
    }

    function getUserMultiplier(address user) external view returns (uint256) {
        if (address(reputationNFT) == address(0)) return 10000;
        uint256 m = reputationNFT.getMultiplier(user);
        return m == 0 ? 10000 : m;
    }

    function currentMinute() external view returns (uint256) {
        return block.timestamp / 60;
    }

    // Backward-compatible alias for existing bot integrations.
    function currentDay() external view returns (uint256) {
        return block.timestamp / 60;
    }

    // Lightweight status getter for scripts that only need enum state.
    function getDistributionState(uint256 slotId) external view returns (uint8) {
        return uint8(distributions[slotId].status);
    }
}
