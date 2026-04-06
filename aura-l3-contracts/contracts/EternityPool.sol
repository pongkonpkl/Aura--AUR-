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
}

// --- Distributor contract: แจก 1 AUR/วัน --- //
contract EternityPool is Ownable {
    AuraEternityToken public aura;
    address public distributor; // Authorized contract to call distribute
    uint256 public lastMintDay = 0;
    uint256 public constant DAILY_AUR = 1e18; // 1 AUR = 10^18 sparks

    event Distributed(uint256 day, uint count);
    event DistributorUpdated(address indexed distributor);

    constructor(address auraToken) Ownable(msg.sender) {
        aura = AuraEternityToken(auraToken);
        lastMintDay = today();
    }

    function setDistributor(address _distributor) external onlyOwner {
        distributor = _distributor;
        emit DistributorUpdated(_distributor);
    }

    modifier onlyAuthorized() {
        require(msg.sender == owner() || msg.sender == distributor, "Not authorized");
        _;
    }

    // Only once per day! dayKey = today() (unix days)
    function distribute(
        address[] calldata recipients,
        uint256[] calldata shares
    ) external onlyAuthorized {
        require(recipients.length == shares.length, "Length mismatch");
        require(today() > lastMintDay, "Already this day");
        require(recipients.length > 0, "No recipients");

        // รวมสัดส่วนทั้งหมด
        uint256 total = 0;
        for (uint i = 0; i < shares.length; i++) {
            total += shares[i];
        }
        require(total > 0, "Total share zero");

        // Mint AUR และแจกตามสัดส่วน
        for (uint i = 0; i < recipients.length; i++) {
            uint256 amount = (DAILY_AUR * shares[i]) / total; // แจกตาม weight/เวลาคนๆ นั้น
            if (amount > 0) aura.mint(recipients[i], amount);
        }
        lastMintDay = today();
        emit Distributed(lastMintDay, recipients.length);
    }

    // helper - คืนเลขวันแบบ unix days
    function today() public view returns (uint256) {
        return block.timestamp / 1 days;
    }
}
