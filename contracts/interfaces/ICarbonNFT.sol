// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title ICarbonNFT
 * @dev Interface for CarbonNFT contract to enable cross-contract communication
 */
interface ICarbonNFT {
    // Enums
    enum UserType { Individual, Company }
    enum Grade { F, D, C, B, A }
    
    // Structs
    struct NFTData {
        Grade currentGrade;
        uint256 carbonScore;
        uint256 endorsements;
        uint256 mintedAt;
        uint256 lastUpdated;
        string theme;
        bool isActive;
    }
    
    // Events
    event NFTMinted(uint256 indexed tokenId, address indexed owner, Grade initialGrade, string theme);
    event GradeUpdated(uint256 indexed tokenId, Grade oldGrade, Grade newGrade, uint256 newScore);
    event NFTEndorsed(uint256 indexed tokenId, address indexed endorser, uint256 newEndorsementCount);
    event UserRegistered(address indexed user, UserType userType);
    
    // Core functions
    function registerUser(UserType _userType) external;
    function mintCarbonNFT(
        address to,
        string memory tokenURI,
        string memory theme,
        Grade initialGrade,
        uint256 initialScore
    ) external returns (uint256);
    function updateGrade(
        uint256 tokenId,
        Grade newGrade,
        uint256 newScore,
        string memory newTokenURI
    ) external;
    function endorseNFT(uint256 tokenId) external;
    
    // View functions
    function getUserNFTs(address user) external view returns (uint256[] memory);
    function getNFTData(uint256 tokenId) external view returns (NFTData memory);
    function getRemainingWeeklyUploads(address user) external view returns (uint256);
    function canUserUpload(address user) external view returns (bool);
    function totalSupply() external view returns (uint256);
    function getActiveNFTs(uint256 offset, uint256 limit) external view returns (uint256[] memory, NFTData[] memory);
    
    // ERC721 functions
    function ownerOf(uint256 tokenId) external view returns (address);
    function balanceOf(address owner) external view returns (uint256);
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    
    // State variables
    function userTypes(address user) external view returns (UserType);
    function isRegistered(address user) external view returns (bool);
    function nftData(uint256 tokenId) external view returns (NFTData memory);
}