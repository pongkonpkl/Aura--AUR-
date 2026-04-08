// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AuraEternityToken is ERC20, Ownable {
    constructor() ERC20("Aura Token", "AUR") Ownable(msg.sender) {}

    // Only EternityPool (distributor) can mint!
    address public distributor;
    function setDistributor(address _d) external onlyOwner { distributor = _d; }
    modifier onlyDistributor() { require(msg.sender == distributor, "Only Distributor"); _; }
    function mint(address to, uint256 amt) external onlyDistributor {
        _mint(to, amt);
    }

    // 🔥 Aura Deflationary Protocol: 1% Burn on Transfer 🔥
    function _update(address from, address to, uint256 value) internal virtual override {
        // Apply 1% burn on regular transfers (not mints or direct burns)
        if (from != address(0) && to != address(0)) {
            uint256 burnAmount = value / 100; // 1%
            uint256 sendAmount = value - burnAmount; // 99%

            // Transfer 99% to recipient
            super._update(from, to, sendAmount);
            
            // Burn 1%
            if (burnAmount > 0) {
                super._update(from, address(0), burnAmount);
            }
        } else {
            // Processing mints or direct burns normally
            super._update(from, to, value);
        }
    }
}

// --- Distributor contract: แจก 1 AUR/วัน --- //
contract EternityPool is Ownable {
    AuraEternityToken public aura;
    address public distributor; // Authorized contract to call distribute
    uint256 public lastMintMinute = 0;
    uint256 public constant DAILY_AUR = 1e18; // 1 AUR = 10^18 sparks
    uint256 public constant MINUTES_PER_DAY = 1440;
    uint256 public constant PER_MINUTE_BASE = DAILY_AUR / MINUTES_PER_DAY;
    uint256 public constant PER_MINUTE_REMAINDER = DAILY_AUR % MINUTES_PER_DAY;

    event Distributed(uint256 minuteId, uint count, uint256 emissionAmount);
    event DistributorUpdated(address indexed distributor);

    constructor(address auraToken) Ownable(msg.sender) {
        aura = AuraEternityToken(auraToken);
        lastMintMinute = currentMinute();
    }

    function setDistributor(address _distributor) external onlyOwner {
        distributor = _distributor;
        emit DistributorUpdated(_distributor);
    }

    modifier onlyAuthorized() {
        require(msg.sender == owner() || msg.sender == distributor, "Not authorized");
        _;
    }

    // Only once per minute. Total emission remains exactly 1 AUR/day.
    function distribute(
        address[] calldata recipients,
        uint256[] calldata shares
    ) external onlyAuthorized {
        require(recipients.length == shares.length, "Length mismatch");
        uint256 minuteId = currentMinute();
        require(minuteId > lastMintMinute, "Already this minute");
        require(recipients.length > 0, "No recipients");

        // รวมสัดส่วนทั้งหมด
        uint256 total = 0;
        for (uint i = 0; i < shares.length; i++) {
            total += shares[i];
        }
        require(total > 0, "Total share zero");

        uint256 emissionAmount = _minuteEmission(minuteId);

        // Mint AUR และแจกตามสัดส่วน
        for (uint i = 0; i < recipients.length; i++) {
            uint256 amount = (emissionAmount * shares[i]) / total;
            if (amount > 0) aura.mint(recipients[i], amount);
        }
        lastMintMinute = minuteId;
        emit Distributed(minuteId, recipients.length, emissionAmount);
    }

    function _minuteEmission(uint256 minuteId) internal pure returns (uint256) {
        uint256 minuteOfDay = minuteId % MINUTES_PER_DAY;
        // Spread the 640 wei/day remainder over first 640 minutes.
        return PER_MINUTE_BASE + (minuteOfDay < PER_MINUTE_REMAINDER ? 1 : 0);
    }

    function emissionForCurrentMinute() external view returns (uint256) {
        return _minuteEmission(currentMinute());
    }

    function currentMinute() public view returns (uint256) {
        return block.timestamp / 60;
    }

    // helper - คืนเลขวันแบบ unix days
    function today() public view returns (uint256) {
        return block.timestamp / 1 days;
    }
}
