// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AuraL3_AIConstitution
/// @notice ต้นแบบบูรณาการหลักการ 18,000 ขันธ์ Constitution ใน L3 จริง (AI-Regulated & Democracy enforced)
contract AuraL3_AIConstitution {
    // --- L5 Citizen Layer ---
    mapping(address => bool) public isCitizen;
    mapping(address => uint256) public citizenKarma; // reputation/karma-score
    event CitizenRegistered(address indexed who);

    function registerCitizen() external {
        require(!isCitizen[msg.sender], "Already registered");
        isCitizen[msg.sender] = true;
        citizenKarma[msg.sender] = 1;
        emit CitizenRegistered(msg.sender);
    }

    modifier onlyCitizen() {
        require(isCitizen[msg.sender], "Only citizen");
        _;
    }

    // --- L3 Democracy & Proposal ---
    enum ProposalStatus { OPEN, APPROVED, EXECUTED, REJECTED }
    struct Proposal {
        uint256 id;
        address proposer;
        string title;
        string body;
        uint256 deadline;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 abstainVotes;
        ProposalStatus status;
        bytes32 policyHash;      // AI Regulator hash binding
        mapping(address => bool) voted;
    }
    uint256 public nextProposalId;
    mapping(uint256 => Proposal) public proposals;
    mapping(bytes32 => bool) public aiPolicyApproved; // L4 AI audit
    event ProposalCreated(uint256 indexed id, address indexed proposer, string title, uint256 deadline);
    event Voted(uint256 indexed id, address indexed voter, uint8 choice, uint256 karma);
    event ProposalApproved(uint256 indexed id, bytes32 policyHash);
    event ProposalExecuted(uint256 indexed id);

    function createProposal(string calldata title, string calldata body, uint256 deadline) external onlyCitizen {
        require(deadline > block.timestamp, "Bad deadline");
        proposals[nextProposalId] = Proposal({
            id: nextProposalId,
            proposer: msg.sender,
            title: title,
            body: body,
            deadline: deadline,
            yesVotes: 0,
            noVotes: 0,
            abstainVotes: 0,
            status: ProposalStatus.OPEN,
            policyHash: bytes32(0)
        });
        emit ProposalCreated(nextProposalId, msg.sender, title, deadline);
        nextProposalId++;
    }

    function vote(uint256 proposalId, uint8 choice) external onlyCitizen {
        // choice: 1=YES, 2=NO, 3=ABSTAIN
        require(proposalId < nextProposalId, "404");
        Proposal storage p = proposals[proposalId];
        require(block.timestamp <= p.deadline, "Voting closed");
        require(!p.voted[msg.sender], "ALREADY_VOTED");
        p.voted[msg.sender] = true;
        uint256 weight = citizenKarma[msg.sender] > 0 ? citizenKarma[msg.sender] : 1;
        if (choice == 1) p.yesVotes += weight;
        else if (choice == 2) p.noVotes += weight;
        else if (choice == 3) p.abstainVotes += weight;
        else revert("Bad choice");
        emit Voted(proposalId, msg.sender, choice, weight);
    }

    // --- AI Regulator L4 ---
    function aiApproveProposal(uint256 proposalId, bytes32 policyHash) external onlyRegulator {
        require(proposalId < nextProposalId, "404");
        Proposal storage p = proposals[proposalId];
        require(p.status == ProposalStatus.OPEN, "Not open");
        require(policyHash != bytes32(0), "Invalid hash");
        p.policyHash = policyHash;
        p.status = ProposalStatus.APPROVED;
        aiPolicyApproved[policyHash] = true;
        emit ProposalApproved(proposalId, policyHash);
    }

    function executeProposal(uint256 proposalId, bytes32 policyHash) external onlyRegulator {
        require(proposalId < nextProposalId, "404");
        Proposal storage p = proposals[proposalId];
        require(p.policyHash == policyHash, "PolicyHash mismatch");
        require(aiPolicyApproved[policyHash], "No AI approval");
        require(p.status == ProposalStatus.APPROVED, "Not approved");
        require(p.yesVotes > p.noVotes, "No majority");
        p.status = ProposalStatus.EXECUTED;
        emit ProposalExecuted(proposalId);
    }

    // --- RBAC ---
    address public regulator;
    constructor() { regulator = msg.sender; }
    modifier onlyRegulator() { require(msg.sender == regulator, "OnlyRegulator"); _; }
    function setRegulator(address who) external onlyRegulator { regulator = who; }
}
