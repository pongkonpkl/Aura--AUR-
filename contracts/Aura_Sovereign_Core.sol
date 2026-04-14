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
    mapping(address => uint256) public rewardDebt; // หนี้รางวัล (Reward Debt) สำหรับ Scalable Distribution
    
    uint256 public totalStaked;
    uint256 public accRewardPerShare; // ดัชนีรางวัลสะสม (Scaled by 1e12)
    uint256 public lastRewardBlock;
    uint256 public rewardPerBlock = 11574074074074; // ตัวอย่าง: 1 AUR ต่อวัน หารด้วยจำนวนบล็อก (สมมติ 1 บล็อก/วิ = 1/86400)
    
    address public fahsaiAI; // AI Guardian / Admin
    
    uint256 public constant PRECISION = 1e12;
    
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

    // --- 🧘 ระบบ Scalable Stake & Reward (MasterChef Model) ---
    
    function updatePool() public whenNotPaused {
        if (block.number <= lastRewardBlock) return;
        if (totalStaked == 0) {
            lastRewardBlock = block.number;
            return;
        }
        
        uint256 multiplier = block.number - lastRewardBlock;
        uint256 auraReward = multiplier * rewardPerBlock;
        
        accRewardPerShare = accRewardPerShare + (auraReward * PRECISION / totalStaked);
        lastRewardBlock = block.number;
    }

    function stake(uint256 amount) external whenNotPaused {
        require(amount >= 1, "Min stake 1 wei");
        require(balanceOf[msg.sender] >= amount, "Insufficient liquid balance");

        updatePool();
        
        // จ่ายรางวัลค้างจ่าย (Harvest Pending)
        if (stakedAmount[msg.sender] > 0) {
            uint256 pending = (stakedAmount[msg.sender] * accRewardPerShare / PRECISION) - rewardDebt[msg.sender];
            if (pending > 0) {
                balanceOf[msg.sender] += pending;
                totalSupply += pending;
            }
        }

        balanceOf[msg.sender] -= amount;
        stakedAmount[msg.sender] += amount;
        totalStaked += amount;
        
        // อัปเดตหนี้รางวัล
        rewardDebt[msg.sender] = stakedAmount[msg.sender] * accRewardPerShare / PRECISION;
    }

    function unstake(uint256 amount) external whenNotPaused {
        require(stakedAmount[msg.sender] >= amount, "Amount exceeds staked balance");
        
        updatePool();
        
        // จ่ายรางวัลค้างจ่ายก่อนถอน
        uint256 pending = (stakedAmount[msg.sender] * accRewardPerShare / PRECISION) - rewardDebt[msg.sender];
        if (pending > 0) {
            balanceOf[msg.sender] += pending;
            totalSupply += pending;
        }

        if (amount > 0) {
            stakedAmount[msg.sender] -= amount;
            totalStaked -= amount;
            balanceOf[msg.sender] += amount;
        }
        
        // อัปเดตหนี้รางวัล
        rewardDebt[msg.sender] = stakedAmount[msg.sender] * accRewardPerShare / PRECISION;
    }

    function claimReward() external whenNotPaused {
        updatePool();
        uint256 pending = (stakedAmount[msg.sender] * accRewardPerShare / PRECISION) - rewardDebt[msg.sender];
        require(pending > 0, "No rewards to claim");

        rewardDebt[msg.sender] = stakedAmount[msg.sender] * accRewardPerShare / PRECISION;
        balanceOf[msg.sender] += pending;
        totalSupply += pending;
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
