// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IGovernance
 * @dev Interface for Governance contract to enable cross-contract communication
 */
interface IGovernance {
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
    
    // Core functions
    function createProposal(
        string memory description,
        ProposalType proposalType,
        bytes memory data
    ) external returns (uint256);
    function vote(uint256 proposalId, bool support) external;
    function executeProposal(uint256 proposalId) external;
    
    // View functions
    function getProposal(uint256 proposalId) external view returns (Proposal memory);
    function getProposalStatus(uint256 proposalId) external view returns (ProposalStatus);
    function getVotingPower(address voter) external view returns (uint256);
    function hasUserVoted(uint256 proposalId, address voter) external view returns (bool);
    function getUserVote(uint256 proposalId, address voter) external view returns (bool);
    function getActiveProposals() external view returns (uint256[] memory);
    function getTotalProposals() external view returns (uint256);
    
    // Admin functions
    function updateQuorumPercentage(uint256 newQuorum) external;
}