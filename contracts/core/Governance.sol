// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./CarbonNFT.sol";

contract Governance is Ownable, ReentrancyGuard {
    CarbonNFT public immutable carbonNFT;
    
    // Enums
    enum ProposalType { MARKETPLACE_FEE, GRADE_THRESHOLD, PLATFORM_PARAMETER }
    enum ProposalStatus { Active, Passed, Failed, Executed }
    
    // Structs
    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 startTime;
        uint256 endTime;
        bool executed;
        ProposalType proposalType;
        bytes data;
        ProposalStatus status;
    }
    
    // State variables
    uint256 private _proposalIdCounter;
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant MIN_VOTING_POWER = 1; // Must own at least 1 NFT
    uint256 public quorumPercentage = 10; // 10% of total NFT holders must vote
    
    // Mappings
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => bool)) public votes; // true = for, false = against
    
    // Platform parameters that can be governed
    uint256 public marketplaceFeePercentage = 250; // 2.5% (basis points)
    uint256 public gradeThresholdA = 900; // Score needed for grade A
    uint256 public gradeThresholdB = 700; // Score needed for grade B
    uint256 public gradeThresholdC = 500; // Score needed for grade C
    uint256 public gradeThresholdD = 300; // Score needed for grade D
    
    // Events
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string description,
        ProposalType proposalType,
        uint256 endTime
    );
    
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 votingPower
    );
    
    event ProposalExecuted(
        uint256 indexed proposalId,
        bool success
    );
    
    event ProposalStatusChanged(
        uint256 indexed proposalId,
        ProposalStatus newStatus
    );
    
    event ParameterUpdated(
        string parameterName,
        uint256 oldValue,
        uint256 newValue
    );
    
    // Custom errors
    error UnauthorizedProposer(address proposer);
    error InvalidProposal(string reason);
    error ProposalNotActive(uint256 proposalId);
    error AlreadyVoted(uint256 proposalId, address voter);
    error ProposalNotExecutable(uint256 proposalId);
    error ExecutionFailed(uint256 proposalId);
    error InsufficientVotingPower(address voter, uint256 required);
    error ZeroAddress();
    error InvalidProposalType(uint8 proposalType);
    error InvalidQuorum(uint256 quorum);
    error InvalidThreshold(uint256 threshold);
    error ProposalExpired(uint256 proposalId);
    error ContractCallFailed(string reason);
    
    constructor(address _carbonNFT) {
        if (_carbonNFT == address(0)) revert ZeroAddress();
        carbonNFT = CarbonNFT(_carbonNFT);
    }
    
    // Modifiers
    modifier onlyNFTHolder() {
        uint256 balance;
        try carbonNFT.balanceOf(msg.sender) returns (uint256 _balance) {
            balance = _balance;
        } catch {
            revert ContractCallFailed("Failed to check NFT balance");
        }
        
        if (balance < MIN_VOTING_POWER) {
            revert InsufficientVotingPower(msg.sender, MIN_VOTING_POWER);
        }
        _;
    }
    
    modifier validProposal(uint256 proposalId) {
        if (proposalId >= _proposalIdCounter) {
            revert InvalidProposal("Proposal does not exist");
        }
        _;
    }
    
    // Create a new proposal
    function createProposal(
        string memory description,
        ProposalType proposalType,
        bytes memory data
    ) external onlyNFTHolder returns (uint256) {
        if (bytes(description).length == 0 || bytes(description).length > 1000) {
            revert InvalidProposal("Description must be between 1 and 1000 characters");
        }
        if (uint8(proposalType) > 2) revert InvalidProposalType(uint8(proposalType));
        
        uint256 proposalId = _proposalIdCounter++;
        uint256 endTime = block.timestamp + VOTING_PERIOD;
        
        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            description: description,
            votesFor: 0,
            votesAgainst: 0,
            startTime: block.timestamp,
            endTime: endTime,
            executed: false,
            proposalType: proposalType,
            data: data,
            status: ProposalStatus.Active
        });
        
        emit ProposalCreated(proposalId, msg.sender, description, proposalType, endTime);
        
        return proposalId;
    }
    
    // Vote on a proposal
    function vote(uint256 proposalId, bool support) external onlyNFTHolder validProposal(proposalId) nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.status != ProposalStatus.Active) {
            revert ProposalNotActive(proposalId);
        }
        
        if (block.timestamp >= proposal.endTime) {
            revert ProposalNotActive(proposalId);
        }
        
        if (hasVoted[proposalId][msg.sender]) {
            revert AlreadyVoted(proposalId, msg.sender);
        }
        
        // Voting power is based on number of NFTs owned
        uint256 votingPower;
        try carbonNFT.balanceOf(msg.sender) returns (uint256 _balance) {
            votingPower = _balance;
        } catch {
            revert ContractCallFailed("Failed to get voting power");
        }
        
        hasVoted[proposalId][msg.sender] = true;
        votes[proposalId][msg.sender] = support;
        
        if (support) {
            proposal.votesFor += votingPower;
        } else {
            proposal.votesAgainst += votingPower;
        }
        
        emit VoteCast(proposalId, msg.sender, support, votingPower);
    }
    
    // Execute a proposal after voting period ends
    function executeProposal(uint256 proposalId) external validProposal(proposalId) nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.executed) {
            revert ProposalNotExecutable(proposalId);
        }
        
        if (block.timestamp < proposal.endTime) {
            revert ProposalNotExecutable(proposalId);
        }
        
        if (proposal.status != ProposalStatus.Active) {
            revert ProposalNotExecutable(proposalId);
        }
        
        // Update proposal status based on voting results
        _updateProposalStatus(proposalId);
        
        if (proposal.status == ProposalStatus.Passed) {
            bool success = _executeProposalAction(proposalId);
            proposal.executed = true;
            
            emit ProposalExecuted(proposalId, success);
            
            if (!success) {
                revert ExecutionFailed(proposalId);
            }
        }
    }
    
    // Internal function to update proposal status
    function _updateProposalStatus(uint256 proposalId) internal {
        Proposal storage proposal = proposals[proposalId];
        
        uint256 totalVotes = proposal.votesFor + proposal.votesAgainst;
        uint256 totalNFTHolders = _getTotalNFTHolders();
        uint256 requiredQuorum = (totalNFTHolders * quorumPercentage) / 100;
        
        ProposalStatus newStatus;
        
        if (totalVotes < requiredQuorum) {
            newStatus = ProposalStatus.Failed;
        } else if (proposal.votesFor > proposal.votesAgainst) {
            newStatus = ProposalStatus.Passed;
        } else {
            newStatus = ProposalStatus.Failed;
        }
        
        proposal.status = newStatus;
        emit ProposalStatusChanged(proposalId, newStatus);
    }
    
    // Internal function to execute proposal actions
    function _executeProposalAction(uint256 proposalId) internal returns (bool) {
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.proposalType == ProposalType.MARKETPLACE_FEE) {
            uint256 newFee = abi.decode(proposal.data, (uint256));
            if (newFee <= 1000) { // Max 10% fee
                uint256 oldFee = marketplaceFeePercentage;
                marketplaceFeePercentage = newFee;
                emit ParameterUpdated("marketplaceFeePercentage", oldFee, newFee);
                return true;
            }
        } else if (proposal.proposalType == ProposalType.GRADE_THRESHOLD) {
            (string memory grade, uint256 newThreshold) = abi.decode(proposal.data, (string, uint256));
            return _updateGradeThreshold(grade, newThreshold);
        } else if (proposal.proposalType == ProposalType.PLATFORM_PARAMETER) {
            (string memory paramName, uint256 newValue) = abi.decode(proposal.data, (string, uint256));
            return _updatePlatformParameter(paramName, newValue);
        }
        
        return false;
    }
    
    // Internal function to update grade thresholds
    function _updateGradeThreshold(string memory grade, uint256 newThreshold) internal returns (bool) {
        bytes32 gradeHash = keccak256(abi.encodePacked(grade));
        uint256 oldValue;
        
        if (gradeHash == keccak256(abi.encodePacked("A"))) {
            oldValue = gradeThresholdA;
            gradeThresholdA = newThreshold;
        } else if (gradeHash == keccak256(abi.encodePacked("B"))) {
            oldValue = gradeThresholdB;
            gradeThresholdB = newThreshold;
        } else if (gradeHash == keccak256(abi.encodePacked("C"))) {
            oldValue = gradeThresholdC;
            gradeThresholdC = newThreshold;
        } else if (gradeHash == keccak256(abi.encodePacked("D"))) {
            oldValue = gradeThresholdD;
            gradeThresholdD = newThreshold;
        } else {
            return false;
        }
        
        emit ParameterUpdated(string(abi.encodePacked("gradeThreshold", grade)), oldValue, newThreshold);
        return true;
    }
    
    // Internal function to update platform parameters
    function _updatePlatformParameter(string memory paramName, uint256 newValue) internal returns (bool) {
        bytes32 paramHash = keccak256(abi.encodePacked(paramName));
        
        if (paramHash == keccak256(abi.encodePacked("quorumPercentage"))) {
            if (newValue > 0 && newValue <= 50) { // Max 50% quorum
                uint256 oldValue = quorumPercentage;
                quorumPercentage = newValue;
                emit ParameterUpdated("quorumPercentage", oldValue, newValue);
                return true;
            }
        }
        
        return false;
    }
    
    // Get total number of unique NFT holders (approximation)
    function _getTotalNFTHolders() internal view returns (uint256) {
        // This is a simplified approach - in a real implementation,
        // you might want to maintain a separate counter for unique holders
        uint256 totalSupply = carbonNFT.totalSupply();
        return totalSupply > 0 ? totalSupply : 1; // Avoid division by zero
    }
    
    // View functions
    function getProposal(uint256 proposalId) external view validProposal(proposalId) returns (Proposal memory) {
        return proposals[proposalId];
    }
    
    function getProposalStatus(uint256 proposalId) external view validProposal(proposalId) returns (ProposalStatus) {
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.status != ProposalStatus.Active) {
            return proposal.status;
        }
        
        if (block.timestamp < proposal.endTime) {
            return ProposalStatus.Active;
        }
        
        // Calculate status for ended but not yet executed proposals
        uint256 totalVotes = proposal.votesFor + proposal.votesAgainst;
        uint256 totalNFTHolders = _getTotalNFTHolders();
        uint256 requiredQuorum = (totalNFTHolders * quorumPercentage) / 100;
        
        if (totalVotes < requiredQuorum) {
            return ProposalStatus.Failed;
        } else if (proposal.votesFor > proposal.votesAgainst) {
            return ProposalStatus.Passed;
        } else {
            return ProposalStatus.Failed;
        }
    }
    
    function getVotingPower(address voter) external view returns (uint256) {
        return carbonNFT.balanceOf(voter);
    }
    
    function hasUserVoted(uint256 proposalId, address voter) external view returns (bool) {
        return hasVoted[proposalId][voter];
    }
    
    function getUserVote(uint256 proposalId, address voter) external view returns (bool) {
        require(hasVoted[proposalId][voter], "User has not voted");
        return votes[proposalId][voter];
    }
    
    function getActiveProposals() external view returns (uint256[] memory) {
        uint256[] memory activeProposals = new uint256[](_proposalIdCounter);
        uint256 count = 0;
        
        for (uint256 i = 0; i < _proposalIdCounter; i++) {
            if (proposals[i].status == ProposalStatus.Active && block.timestamp < proposals[i].endTime) {
                activeProposals[count] = i;
                count++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = activeProposals[i];
        }
        
        return result;
    }
    
    function getTotalProposals() external view returns (uint256) {
        return _proposalIdCounter;
    }
    
    // Admin functions
    function updateQuorumPercentage(uint256 newQuorum) external onlyOwner {
        if (newQuorum == 0 || newQuorum > 50) revert InvalidQuorum(newQuorum);
        uint256 oldQuorum = quorumPercentage;
        quorumPercentage = newQuorum;
        emit ParameterUpdated("quorumPercentage", oldQuorum, newQuorum);
    }
}