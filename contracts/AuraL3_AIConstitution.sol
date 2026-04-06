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

    // ================================================================
    // AuraChainAI Integration — Additive extensions (v2)
    // All original functions remain 100% backward compatible
    // ================================================================

    // --- AI Node Registry ---
    mapping(address => bool) public isAINode;
    event AINodeRegistered(address indexed node);
    event AINodeRemoved(address indexed node);

    function registerAINode(address node) external onlyRegulator {
        isAINode[node] = true;
        // AI nodes are also citizens
        if (!isCitizen[node]) {
            isCitizen[node] = true;
            citizenKarma[node] = 1;
            emit CitizenRegistered(node);
        }
        emit AINodeRegistered(node);
    }

    function removeAINode(address node) external onlyRegulator {
        isAINode[node] = false;
        emit AINodeRemoved(node);
    }

    // --- Enhanced Proposal Creation (with proposerType) ---
    // proposerType: 0=HUMAN, 1=AI_NODE
    event ProposalCreatedV2(uint256 indexed id, address indexed proposer, string title, uint8 proposerType, uint256 deadline);

    function createProposalV2(
        string calldata title,
        string calldata body,
        uint256 deadline,
        uint8 proposerType
    ) external {
        // AI nodes OR citizens can create proposals
        require(isCitizen[msg.sender] || isAINode[msg.sender], "Not authorized");
        require(deadline > block.timestamp, "Bad deadline");

        if (proposerType == 1) {
            require(isAINode[msg.sender], "Not an AI Node");
        }

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
        emit ProposalCreatedV2(nextProposalId, msg.sender, title, proposerType, deadline);
        nextProposalId++;
    }

    // --- AI Node Voting (weighted) ---
    function voteAsAINode(uint256 proposalId, uint8 choice) external {
        require(isAINode[msg.sender], "Not AI node");
        require(proposalId < nextProposalId, "404");
        Proposal storage p = proposals[proposalId];
        require(block.timestamp <= p.deadline, "Voting closed");
        require(!p.voted[msg.sender], "ALREADY_VOTED");

        p.voted[msg.sender] = true;
        // AI nodes get fixed weight of 1 (neutrality principle)
        if (choice == 1) p.yesVotes += 1;
        else if (choice == 2) p.noVotes += 1;
        else if (choice == 3) p.abstainVotes += 1;
        else revert("Bad choice");

        emit Voted(proposalId, msg.sender, choice, 1);
    }

    // --- Quorum-based Execution ---
    uint256 public quorum = 3; // minimum total votes required

    event QuorumUpdated(uint256 oldQuorum, uint256 newQuorum);
    event ProposalAutoExecuted(uint256 indexed id, uint256 totalVotes);

    function setQuorum(uint256 _quorum) external onlyRegulator {
        require(_quorum > 0, "Quorum must be > 0");
        emit QuorumUpdated(quorum, _quorum);
        quorum = _quorum;
    }

    function executeProposalV2(uint256 proposalId) external {
        require(proposalId < nextProposalId, "404");
        Proposal storage p = proposals[proposalId];
        require(p.status == ProposalStatus.APPROVED, "Not approved");

        uint256 totalVotes = p.yesVotes + p.noVotes + p.abstainVotes;
        require(totalVotes >= quorum, "Quorum not reached");
        require(p.yesVotes > p.noVotes, "No majority");

        p.status = ProposalStatus.EXECUTED;
        emit ProposalAutoExecuted(proposalId, totalVotes);
        emit ProposalExecuted(proposalId);
    }

    // --- View Helpers ---
    function getProposalVoteSummary(uint256 proposalId) external view returns (
        uint256 yes, uint256 no, uint256 abstain, uint256 total, bool quorumMet
    ) {
        require(proposalId < nextProposalId, "404");
        Proposal storage p = proposals[proposalId];
        uint256 t = p.yesVotes + p.noVotes + p.abstainVotes;
        return (p.yesVotes, p.noVotes, p.abstainVotes, t, t >= quorum);
    }
}
