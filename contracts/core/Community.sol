// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./CarbonNFT.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title Community
 * @dev Manages community features, public galleries, and social interactions for CarbonNFT platform
 */
contract Community is Ownable, ReentrancyGuard {
    
    // Reference to the CarbonNFT contract
    CarbonNFT public immutable carbonNFT;
    
    // Struct for NFT display in public gallery
    struct NFTDisplay {
        uint256 tokenId;
        address owner;
        CarbonNFT.Grade grade;
        uint256 carbonScore;
        uint256 endorsements;
        string theme;
        bool isPublic;
    }
    
    // Struct for user ranking in leaderboard
    struct UserRanking {
        address user;
        uint256 totalScore;
        uint256 nftCount;
        CarbonNFT.Grade averageGrade;
    }
    
    // Struct for community-wide statistics
    struct CommunityMetrics {
        uint256 totalUsers;
        uint256 totalNFTs;
        uint256 totalCarbonSaved;
        uint256 averageGrade;
    }
    
    // Mappings
    mapping(uint256 => bool) public nftVisibility; // tokenId => isPublic
    mapping(address => bool) public hasSetVisibility; // Track if user has set any visibility
    
    // Events
    event NFTVisibilityChanged(uint256 indexed tokenId, address indexed owner, bool isPublic);
    event CommunityStatsUpdated(uint256 totalUsers, uint256 totalNFTs, uint256 totalCarbonSaved);
    
    // Custom errors for gas efficiency
    error UnauthorizedAccess(address caller);
    error TokenNotFound(uint256 tokenId);
    error InvalidParameters(string reason);
    error ZeroAddress();
    error InvalidLimit(uint256 limit);
    error InvalidOffset(uint256 offset);
    error ContractCallFailed(string reason);
    
    constructor(address _carbonNFTAddress) {
        if (_carbonNFTAddress == address(0)) revert ZeroAddress();
        carbonNFT = CarbonNFT(_carbonNFTAddress);
    }
    
    /**
     * @dev Modifier to check if caller owns the NFT
     */
    modifier onlyNFTOwner(uint256 tokenId) {
        if (carbonNFT.ownerOf(tokenId) != msg.sender) {
            revert UnauthorizedAccess(msg.sender);
        }
        _;
    }
    
    /**
     * @dev Set NFT visibility (public/private) for community gallery
     * @param tokenId The ID of the NFT
     * @param isPublic Whether the NFT should be visible in public gallery
     */
    function setNFTVisibility(uint256 tokenId, bool isPublic) external onlyNFTOwner(tokenId) {
        // Check if token exists by trying to get its data
        try carbonNFT.getNFTData(tokenId) returns (CarbonNFT.NFTData memory) {
            nftVisibility[tokenId] = isPublic;
            hasSetVisibility[msg.sender] = true;
            emit NFTVisibilityChanged(tokenId, msg.sender, isPublic);
        } catch {
            revert TokenNotFound(tokenId);
        }
    }
    
    /**
     * @dev Get public NFTs for community gallery with pagination
     * @param offset Starting index for pagination
     * @param limit Maximum number of NFTs to return
     * @return Array of NFTDisplay structs for public NFTs
     */
    function getPublicNFTs(uint256 offset, uint256 limit) external view returns (NFTDisplay[] memory) {
        if (limit == 0 || limit > 100) revert InvalidLimit(limit);
        if (offset > 10000) revert InvalidOffset(offset); // Reasonable upper bound
        
        // Get active NFTs from CarbonNFT contract with error handling
        (uint256[] memory tokenIds, CarbonNFT.NFTData[] memory nftDataArray);
        try carbonNFT.getActiveNFTs(0, 1000) returns (uint256[] memory _tokenIds, CarbonNFT.NFTData[] memory _nftDataArray) {
            tokenIds = _tokenIds;
            nftDataArray = _nftDataArray;
        } catch {
            revert ContractCallFailed("Failed to fetch active NFTs");
        }
        
        // Count public NFTs first
        uint256 publicCount = 0;
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (tokenIds[i] != 0 && nftVisibility[tokenIds[i]]) {
                publicCount++;
            }
        }
        
        // Create result array with appropriate size
        uint256 resultSize = publicCount > offset ? (publicCount - offset > limit ? limit : publicCount - offset) : 0;
        NFTDisplay[] memory publicNFTs = new NFTDisplay[](resultSize);
        
        uint256 currentIndex = 0;
        uint256 resultIndex = 0;
        
        for (uint256 i = 0; i < tokenIds.length && resultIndex < resultSize; i++) {
            if (tokenIds[i] != 0 && nftVisibility[tokenIds[i]]) {
                if (currentIndex >= offset) {
                    address owner;
                    try carbonNFT.ownerOf(tokenIds[i]) returns (address _owner) {
                        owner = _owner;
                    } catch {
                        continue; // Skip if owner lookup fails
                    }
                    
                    publicNFTs[resultIndex] = NFTDisplay({
                        tokenId: tokenIds[i],
                        owner: owner,
                        grade: nftDataArray[i].currentGrade,
                        carbonScore: nftDataArray[i].carbonScore,
                        endorsements: nftDataArray[i].endorsements,
                        theme: nftDataArray[i].theme,
                        isPublic: true
                    });
                    resultIndex++;
                }
                currentIndex++;
            }
        }
        
        return publicNFTs;
    }    
 
   /**
     * @dev Get leaderboard of top users based on NFT grades and scores
     * @param limit Maximum number of users to return
     * @return Array of UserRanking structs sorted by performance
     */
    function getLeaderboard(uint256 limit) external view returns (UserRanking[] memory) {
        if (limit == 0 || limit > 50) revert InvalidLimit(limit);
        
        // Get all active NFTs with error handling
        (uint256[] memory tokenIds, CarbonNFT.NFTData[] memory nftDataArray);
        try carbonNFT.getActiveNFTs(0, 1000) returns (uint256[] memory _tokenIds, CarbonNFT.NFTData[] memory _nftDataArray) {
            tokenIds = _tokenIds;
            nftDataArray = _nftDataArray;
        } catch {
            revert ContractCallFailed("Failed to fetch active NFTs for leaderboard");
        }
        
        // Create temporary mapping to aggregate user data
        address[] memory uniqueUsers = new address[](1000);
        uint256[] memory userTotalScores = new uint256[](1000);
        uint256[] memory userNFTCounts = new uint256[](1000);
        uint256[] memory userGradeSums = new uint256[](1000);
        uint256 uniqueUserCount = 0;
        
        // Aggregate data for each user
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (tokenIds[i] != 0) {
                address owner;
                try carbonNFT.ownerOf(tokenIds[i]) returns (address _owner) {
                    owner = _owner;
                } catch {
                    continue; // Skip if owner lookup fails
                }
                
                // Find or create user entry
                uint256 userIndex = uniqueUserCount;
                for (uint256 j = 0; j < uniqueUserCount; j++) {
                    if (uniqueUsers[j] == owner) {
                        userIndex = j;
                        break;
                    }
                }
                
                // If new user, add to array
                if (userIndex == uniqueUserCount) {
                    uniqueUsers[uniqueUserCount] = owner;
                    uniqueUserCount++;
                }
                
                // Aggregate scores and counts
                userTotalScores[userIndex] += nftDataArray[i].carbonScore;
                userNFTCounts[userIndex]++;
                userGradeSums[userIndex] += uint256(nftDataArray[i].currentGrade);
            }
        }
        
        // Create leaderboard array
        uint256 resultSize = uniqueUserCount > limit ? limit : uniqueUserCount;
        UserRanking[] memory leaderboard = new UserRanking[](resultSize);
        
        // Simple selection sort for top performers (good enough for small datasets)
        for (uint256 i = 0; i < resultSize; i++) {
            uint256 maxScore = 0;
            uint256 maxIndex = 0;
            
            for (uint256 j = 0; j < uniqueUserCount; j++) {
                if (userTotalScores[j] > maxScore) {
                    maxScore = userTotalScores[j];
                    maxIndex = j;
                }
            }
            
            // Calculate average grade
            CarbonNFT.Grade avgGrade = userNFTCounts[maxIndex] > 0 
                ? CarbonNFT.Grade(userGradeSums[maxIndex] / userNFTCounts[maxIndex])
                : CarbonNFT.Grade.F;
            
            leaderboard[i] = UserRanking({
                user: uniqueUsers[maxIndex],
                totalScore: userTotalScores[maxIndex],
                nftCount: userNFTCounts[maxIndex],
                averageGrade: avgGrade
            });
            
            // Mark this user as processed by setting score to 0
            userTotalScores[maxIndex] = 0;
        }
        
        return leaderboard;
    }
    
    /**
     * @dev Get community-wide statistics
     * @return CommunityMetrics struct with aggregated platform data
     */
    function getCommunityStats() external view returns (CommunityMetrics memory) {
        // Get all active NFTs
        (uint256[] memory tokenIds, CarbonNFT.NFTData[] memory nftDataArray) = carbonNFT.getActiveNFTs(0, 1000);
        
        uint256 totalNFTs = 0;
        uint256 totalCarbonSaved = 0;
        uint256 gradeSum = 0;
        address[] memory uniqueUsers = new address[](1000);
        uint256 uniqueUserCount = 0;
        
        // Aggregate statistics
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (tokenIds[i] != 0) {
                totalNFTs++;
                totalCarbonSaved += nftDataArray[i].carbonScore;
                gradeSum += uint256(nftDataArray[i].currentGrade);
                
                // Track unique users
                address owner = carbonNFT.ownerOf(tokenIds[i]);
                bool isNewUser = true;
                for (uint256 j = 0; j < uniqueUserCount; j++) {
                    if (uniqueUsers[j] == owner) {
                        isNewUser = false;
                        break;
                    }
                }
                if (isNewUser) {
                    uniqueUsers[uniqueUserCount] = owner;
                    uniqueUserCount++;
                }
            }
        }
        
        uint256 averageGrade = totalNFTs > 0 ? gradeSum / totalNFTs : 0;
        
        return CommunityMetrics({
            totalUsers: uniqueUserCount,
            totalNFTs: totalNFTs,
            totalCarbonSaved: totalCarbonSaved,
            averageGrade: averageGrade
        });
    }
    
    /**
     * @dev Check if an NFT is set to public visibility
     * @param tokenId The ID of the NFT to check
     * @return Whether the NFT is public
     */
    function isNFTPublic(uint256 tokenId) external view returns (bool) {
        return nftVisibility[tokenId];
    }
    
    /**
     * @dev Get NFT display data for a specific token (respects privacy settings)
     * @param tokenId The ID of the NFT
     * @return NFTDisplay struct if public, reverts if private or non-existent
     */
    function getNFTDisplay(uint256 tokenId) external view returns (NFTDisplay memory) {
        // Check if token exists
        CarbonNFT.NFTData memory nftData;
        try carbonNFT.getNFTData(tokenId) returns (CarbonNFT.NFTData memory data) {
            nftData = data;
        } catch {
            revert TokenNotFound(tokenId);
        }
        
        // Check if NFT is public or caller is owner
        address owner = carbonNFT.ownerOf(tokenId);
        if (!nftVisibility[tokenId] && msg.sender != owner) {
            revert UnauthorizedAccess(msg.sender);
        }
        
        return NFTDisplay({
            tokenId: tokenId,
            owner: owner,
            grade: nftData.currentGrade,
            carbonScore: nftData.carbonScore,
            endorsements: nftData.endorsements,
            theme: nftData.theme,
            isPublic: nftVisibility[tokenId]
        });
    }
    
    /**
     * @dev Get total count of public NFTs
     * @return Number of NFTs set to public visibility
     */
    function getPublicNFTCount() external view returns (uint256) {
        (uint256[] memory tokenIds,) = carbonNFT.getActiveNFTs(0, 1000);
        
        uint256 publicCount = 0;
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (tokenIds[i] != 0 && nftVisibility[tokenIds[i]]) {
                publicCount++;
            }
        }
        
        return publicCount;
    }
}