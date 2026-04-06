// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AuraReputationNFT
 * @notice Soulbound reputation badge system with exp-driven progression
 * @dev Bronze(1)=100exp/+5%, Silver(2)=500exp/+10%, Gold(3)=2000exp/+15%
 *
 * - Badges are soulbound (non-transferable)
 * - Only oracle/owner can add exp
 * - Badge level auto-upgrades when exp threshold is crossed
 * - Multiplier is consumed by AuraRewardDistributor for reward boost
 */
contract AuraReputationNFT is ERC721, Ownable {

    // ─── Badge Tiers ──────────────────────────────────────
    uint8 public constant BADGE_NONE   = 0;
    uint8 public constant BADGE_BRONZE = 1;
    uint8 public constant BADGE_SILVER = 2;
    uint8 public constant BADGE_GOLD   = 3;

    uint256 public constant BRONZE_THRESHOLD = 100;
    uint256 public constant SILVER_THRESHOLD = 500;
    uint256 public constant GOLD_THRESHOLD   = 2000;

    // Multiplier in basis points (10000 = 1.00x)
    uint256 public constant MULT_NONE   = 10000;   // 1.00x
    uint256 public constant MULT_BRONZE = 10500;   // 1.05x
    uint256 public constant MULT_SILVER = 11000;   // 1.10x
    uint256 public constant MULT_GOLD   = 11500;   // 1.15x

    // ─── State ────────────────────────────────────────────
    uint256 private _nextTokenId;

    struct UserReputation {
        uint256 totalExp;
        uint8 badgeLevel;
        uint256 tokenId;        // 0 = no badge minted yet
        uint256 lastExpAt;
    }

    mapping(address => UserReputation) public userReputation;
    mapping(address => bool) public isOracle;

    // ─── Events ───────────────────────────────────────────
    event ExpAdded(address indexed user, uint256 points, string source, uint256 newTotal);
    event BadgeUpgraded(address indexed user, uint8 oldLevel, uint8 newLevel);
    event OracleUpdated(address indexed oracle, bool active);

    // ─── Modifiers ────────────────────────────────────────
    modifier onlyOracle() {
        require(isOracle[msg.sender] || msg.sender == owner(), "Not oracle");
        _;
    }

    // ─── Constructor ──────────────────────────────────────
    constructor() ERC721("Aura Reputation Badge", "AURA-REP") Ownable(msg.sender) {
        _nextTokenId = 1;
        isOracle[msg.sender] = true;
    }

    // ─── Oracle Management ────────────────────────────────
    function setOracle(address oracle, bool active) external onlyOwner {
        isOracle[oracle] = active;
        emit OracleUpdated(oracle, active);
    }

    // ─── Core: Add Experience Points ──────────────────────
    function addExp(address user, uint256 points, string calldata source) external onlyOracle {
        require(user != address(0), "Zero address");
        require(points > 0, "Zero points");

        UserReputation storage rep = userReputation[user];
        rep.totalExp += points;
        rep.lastExpAt = block.timestamp;

        emit ExpAdded(user, points, source, rep.totalExp);

        // Check for badge upgrade
        _checkUpgrade(user);
    }

    // ─── Core: Batch Add Exp ──────────────────────────────
    function addExpBatch(
        address[] calldata users,
        uint256[] calldata points,
        string calldata source
    ) external onlyOracle {
        require(users.length == points.length, "Length mismatch");
        for (uint256 i = 0; i < users.length; i++) {
            if (users[i] != address(0) && points[i] > 0) {
                UserReputation storage rep = userReputation[users[i]];
                rep.totalExp += points[i];
                rep.lastExpAt = block.timestamp;
                emit ExpAdded(users[i], points[i], source, rep.totalExp);
                _checkUpgrade(users[i]);
            }
        }
    }

    // ─── Internal: Check & Perform Badge Upgrade ──────────
    function _checkUpgrade(address user) internal {
        UserReputation storage rep = userReputation[user];
        uint8 newLevel = _calculateLevel(rep.totalExp);

        if (newLevel > rep.badgeLevel) {
            uint8 oldLevel = rep.badgeLevel;

            // Mint badge NFT if first time
            if (rep.tokenId == 0) {
                uint256 tokenId = _nextTokenId++;
                _safeMint(user, tokenId);
                rep.tokenId = tokenId;
            }

            rep.badgeLevel = newLevel;
            emit BadgeUpgraded(user, oldLevel, newLevel);
        }
    }

    function _calculateLevel(uint256 exp) internal pure returns (uint8) {
        if (exp >= GOLD_THRESHOLD)   return BADGE_GOLD;
        if (exp >= SILVER_THRESHOLD) return BADGE_SILVER;
        if (exp >= BRONZE_THRESHOLD) return BADGE_BRONZE;
        return BADGE_NONE;
    }

    // ─── View: Get Badge Level ────────────────────────────
    function getBadgeLevel(address user) external view returns (uint8) {
        return userReputation[user].badgeLevel;
    }

    // ─── View: Get Multiplier (consumed by Distributor) ───
    function getMultiplier(address user) external view returns (uint256) {
        uint8 level = userReputation[user].badgeLevel;
        if (level == BADGE_GOLD)   return MULT_GOLD;
        if (level == BADGE_SILVER) return MULT_SILVER;
        if (level == BADGE_BRONZE) return MULT_BRONZE;
        return MULT_NONE;
    }

    // ─── View: Get User Full Status ───────────────────────
    function getUserStatus(address user) external view returns (
        uint256 totalExp,
        uint8 badgeLevel,
        uint256 multiplier,
        uint256 expToNextLevel
    ) {
        UserReputation storage rep = userReputation[user];
        uint256 mult;
        uint256 nextThresh;

        if (rep.badgeLevel == BADGE_GOLD) {
            mult = MULT_GOLD;
            nextThresh = 0; // max level
        } else if (rep.badgeLevel == BADGE_SILVER) {
            mult = MULT_SILVER;
            nextThresh = GOLD_THRESHOLD > rep.totalExp ? GOLD_THRESHOLD - rep.totalExp : 0;
        } else if (rep.badgeLevel == BADGE_BRONZE) {
            mult = MULT_BRONZE;
            nextThresh = SILVER_THRESHOLD > rep.totalExp ? SILVER_THRESHOLD - rep.totalExp : 0;
        } else {
            mult = MULT_NONE;
            nextThresh = BRONZE_THRESHOLD > rep.totalExp ? BRONZE_THRESHOLD - rep.totalExp : 0;
        }

        return (rep.totalExp, rep.badgeLevel, mult, nextThresh);
    }

    // ─── Soulbound: Prevent Transfers ─────────────────────
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        // Allow minting (from == address(0)), block transfers
        require(from == address(0), "Soulbound: non-transferable");
        return super._update(to, tokenId, auth);
    }
}
