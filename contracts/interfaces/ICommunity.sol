// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./ICarbonNFT.sol";

/**
 * @title ICommunity
 * @dev Interface for Community contract to enable cross-contract communication
 */
interface ICommunity {
    // Structs
    struct NFTDisplay {
        uint256 tokenId;
        address owner;
        ICarbonNFT.Grade grade;
        uint256 carbonScore;
        uint256 endorsements;
        string theme;
        bool isPublic;
    }
    
    struct UserRanking {
        address user;
        uint256 totalScore;
        uint256 nftCount;
        ICarbonNFT.Grade averageGrade;
    }
    
    struct CommunityMetrics {
        uint256 totalUsers;
        uint256 totalNFTs;
        uint256 totalCarbonSaved;
        uint256 averageGrade;
    }
    
    // Events
    event NFTVisibilityChanged(uint256 indexed tokenId, address indexed owner, bool isPublic);
    event CommunityStatsUpdated(uint256 totalUsers, uint256 totalNFTs, uint256 totalCarbonSaved);
    
    // Core functions
    function setNFTVisibility(uint256 tokenId, bool isPublic) external;
    function getPublicNFTs(uint256 offset, uint256 limit) external view returns (NFTDisplay[] memory);
    function getLeaderboard(uint256 limit) external view returns (UserRanking[] memory);
    function getCommunityStats() external view returns (CommunityMetrics memory);
    
    // View functions
    function isNFTPublic(uint256 tokenId) external view returns (bool);
    function getNFTDisplay(uint256 tokenId) external view returns (NFTDisplay memory);
    function getPublicNFTCount() external view returns (uint256);
}