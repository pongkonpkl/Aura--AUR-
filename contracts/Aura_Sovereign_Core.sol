// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Aura_Sovereign_Core {
    // ข้อมูลพื้นฐาน
    string public name = "Aura";
    string public symbol = "AUR";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    bool public isSystemPaused = false; // ระบบแช่แข็ง

    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public stakedAmount;
    mapping(address => uint256) public lastClaimTime;
    uint256 public totalStaked;
    address public fahsaiAI; // AI Guardian / Admin

    // สำหรับรังรองระบบ Hybrid: PoP (20%) + PoS (80%)
    uint256 public dailyPoSRewardPool = 800000000000000000; // 0.8 AUR
    
    constructor() { 
        fahsaiAI = msg.sender; 
        // Initial setup for existing users or ecosystem could happen here
    }

    modifier onlyAI() { require(msg.sender == fahsaiAI, "Only Fahsai AI"); _; }
    modifier whenNotPaused() { require(!isSystemPaused, "Aura System is Frozen!"); _; }

    // --- 🛡️ ระบบความปลอดภัย (Security) ---
    function setPause(bool _state) external onlyAI {
        isSystemPaused = _state; // ปุ่ม Freeze 
    }

    // --- 🔥 ระบบโอนและเผาทิ้ง 1% (Anti-Inflation) ---
    function transfer(address to, uint256 amount) external whenNotPaused returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Inadequate balance");
        uint256 burnAmount = amount / 100; // หัก 1%
        uint256 sendAmount = amount - burnAmount;

        balanceOf[msg.sender] -= amount;
        balanceOf[to] += sendAmount;
        totalSupply -= burnAmount; // เผาทิ้งถาวร
        return true;
    }

    // --- 🧘 ระบบ Stake & Reward (Incentive & Hybrid Core) ---
    function stake(uint256 amount) external whenNotPaused {
        require(amount >= 1, "Min stake 18 decimal point (1 wei)");
        require(balanceOf[msg.sender] >= amount, "Insufficient liquid balance to stake");

        balanceOf[msg.sender] -= amount;
        stakedAmount[msg.sender] += amount;
        totalStaked += amount;
    }

    function unstake(uint256 amount) external whenNotPaused {
        require(stakedAmount[msg.sender] >= amount, "Amount exceeds staked balance");
        
        stakedAmount[msg.sender] -= amount;
        totalStaked -= amount;
        balanceOf[msg.sender] += amount;
    }

    function claimReward() external whenNotPaused {
        require(block.timestamp >= lastClaimTime[msg.sender] + 1 days, "Not time yet");
        require(stakedAmount[msg.sender] > 0, "No contribution found");
        require(totalStaked > 0, "Total staked is zero");

        // ให้ผลตอบแทนจากพูล 80% ตามสัดส่วน
        uint256 reward = (dailyPoSRewardPool * stakedAmount[msg.sender]) / totalStaked;
        
        balanceOf[msg.sender] += reward;
        totalSupply += reward;
        lastClaimTime[msg.sender] = block.timestamp;
    }

    // --- 💧 ระบบ Hybrid Drop: ให้โหนด Fashsai AI ยืนยันการออนครบ 24 ชม เพื่อจ่ายส่วนที่เหลือ (20%) ---
    function distributeHeartbeatDrops(address[] calldata participants, uint256 dropAmountPerUser) external onlyAI whenNotPaused {
        uint256 totalAmount = participants.length * dropAmountPerUser;
        totalSupply += totalAmount;

        for(uint256 i = 0; i < participants.length; i++) {
            balanceOf[participants[i]] += dropAmountPerUser;
        }
    }
}
