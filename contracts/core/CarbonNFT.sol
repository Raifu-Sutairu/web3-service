// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

// Custom errors for gas efficiency
error UnauthorizedAccess(address caller);
error InvalidGrade(uint8 grade);
error InvalidScore(uint256 score);
error InvalidUserType(uint8 userType);
error TokenNotFound(uint256 tokenId);
error UserAlreadyRegistered(address user);
error UserNotRegistered(address user);
error WeeklyLimitExceeded(address user);
error SelfEndorsementNotAllowed(address user);
error AlreadyEndorsed(address user, uint256 tokenId);
error InsufficientNFTBalance(address user);
error InvalidTokenURI(string uri);
error InvalidTheme(string theme);
error ZeroAddress();

contract CarbonNFT is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    
    Counters.Counter private _tokenIdCounter;
    
    // Enums for user types and grades
    enum UserType { Individual, Company }
    enum Grade { F, D, C, B, A }
    
    // Struct to store NFT metadata (removed cached owner/userType to avoid stale data)
    struct NFTData {
        Grade currentGrade;
        uint256 carbonScore;
        uint256 endorsements;
        uint256 mintedAt;
        uint256 lastUpdated;
        string theme;
        bool isActive;
    }
    
    // Mappings
    mapping(uint256 => NFTData) public nftData;
    mapping(address => uint256[]) public userNFTs;
    mapping(address => UserType) public userTypes;
    mapping(address => bool) public isRegistered;
    mapping(uint256 => mapping(address => bool)) public hasEndorsed;
    mapping(address => uint256) public userWeeklyUploads; // Track weekly uploads
    mapping(address => uint256) public lastUploadWeek;
    
    // Events
    event NFTMinted(uint256 indexed tokenId, address indexed owner, Grade initialGrade, string theme);
    event GradeUpdated(uint256 indexed tokenId, Grade oldGrade, Grade newGrade, uint256 newScore);
    event NFTEndorsed(uint256 indexed tokenId, address indexed endorser, uint256 newEndorsementCount);
    event UserRegistered(address indexed user, UserType userType);
    event WeeklyUploadSubmitted(address indexed user, uint256 week, uint256 tokenId);
    
    // Constants
    uint256 public constant MAX_WEEKLY_UPLOADS = 1;
    uint256 public constant ENDORSEMENT_REWARD = 10; // Points for endorsing
    uint256 public constant SECONDS_PER_WEEK = 604800; // 7 days
    
    constructor() ERC721("CarbonNFT", "CNFT") {}
    
    // Modifier to check if user can upload this week - REMOVED (was checking wrong actor)
    
    // Register user with type
    function registerUser(UserType _userType) external {
        if (msg.sender == address(0)) revert ZeroAddress();
        if (isRegistered[msg.sender]) revert UserAlreadyRegistered(msg.sender);
        if (uint8(_userType) > 1) revert InvalidUserType(uint8(_userType));
        
        userTypes[msg.sender] = _userType;
        isRegistered[msg.sender] = true;
        emit UserRegistered(msg.sender, _userType);
    }
    
    // Get current week number
    function getCurrentWeek() public view returns (uint256) {
        return block.timestamp / SECONDS_PER_WEEK;
    }
    
    // Mint NFT with initial grade (called by web3 service after AI generates image)
    function mintCarbonNFT(
        address to,
        string memory tokenURI,
        string memory theme,
        Grade initialGrade,
        uint256 initialScore
    ) external onlyOwner returns (uint256) {
        if (to == address(0)) revert ZeroAddress();
        if (!isRegistered[to]) revert UserNotRegistered(to);
        if (uint8(initialGrade) > 4) revert InvalidGrade(uint8(initialGrade));
        if (initialScore > 10000) revert InvalidScore(initialScore); // Max score limit
        if (bytes(tokenURI).length == 0) revert InvalidTokenURI(tokenURI);
        if (bytes(theme).length == 0) revert InvalidTheme(theme);
        
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        
        // Store NFT data (removed cached owner/userType)
        nftData[tokenId] = NFTData({
            currentGrade: initialGrade,
            carbonScore: initialScore,
            endorsements: 0,
            mintedAt: block.timestamp,
            lastUpdated: block.timestamp,
            theme: theme,
            isActive: true
        });
        
        // Add to user's NFT list
        userNFTs[to].push(tokenId);
        
        emit NFTMinted(tokenId, to, initialGrade, theme);
        return tokenId;
    }
    
    // Update NFT grade after ML analysis (called by web3 service)
    function updateGrade(
        uint256 tokenId,
        Grade newGrade,
        uint256 newScore,
        string memory newTokenURI
    ) external onlyOwner {
        if (!_exists(tokenId)) revert TokenNotFound(tokenId);
        if (uint8(newGrade) > 4) revert InvalidGrade(uint8(newGrade));
        if (newScore > 10000) revert InvalidScore(newScore);
        if (bytes(newTokenURI).length == 0) revert InvalidTokenURI(newTokenURI);
        
        address nftOwner = ownerOf(tokenId);
        uint256 currentWeek = getCurrentWeek();
        
        // Check weekly upload limit for NFT owner (not msg.sender)
        if (lastUploadWeek[nftOwner] >= currentWeek && userWeeklyUploads[nftOwner] >= MAX_WEEKLY_UPLOADS) {
            revert WeeklyLimitExceeded(nftOwner);
        }
        
        Grade oldGrade = nftData[tokenId].currentGrade;
        
        // Update NFT data
        nftData[tokenId].currentGrade = newGrade;
        nftData[tokenId].carbonScore = newScore;
        nftData[tokenId].lastUpdated = block.timestamp;
        
        // Update token URI with new metadata
        _setTokenURI(tokenId, newTokenURI);
        
        // Update weekly upload tracking for NFT owner
        if (lastUploadWeek[nftOwner] < currentWeek) {
            userWeeklyUploads[nftOwner] = 1;
            lastUploadWeek[nftOwner] = currentWeek;
        } else {
            userWeeklyUploads[nftOwner]++;
        }
        
        emit GradeUpdated(tokenId, oldGrade, newGrade, newScore);
        emit WeeklyUploadSubmitted(nftOwner, currentWeek, tokenId);
    }
    
    // Endorse another user's NFT (community feature)
    function endorseNFT(uint256 tokenId) external nonReentrant {
        if (!_exists(tokenId)) revert TokenNotFound(tokenId);
        if (ownerOf(tokenId) == msg.sender) revert SelfEndorsementNotAllowed(msg.sender);
        if (hasEndorsed[tokenId][msg.sender]) revert AlreadyEndorsed(msg.sender, tokenId);
        if (userTypes[msg.sender] == UserType.Individual && balanceOf(msg.sender) == 0) {
            revert InsufficientNFTBalance(msg.sender);
        }
        
        // Mark as endorsed
        hasEndorsed[tokenId][msg.sender] = true;
        nftData[tokenId].endorsements++;
        
        // Small score boost for endorsements (with overflow protection)
        uint256 newScore = nftData[tokenId].carbonScore + ENDORSEMENT_REWARD;
        if (newScore > 10000) newScore = 10000; // Cap at max score
        nftData[tokenId].carbonScore = newScore;
        
        emit NFTEndorsed(tokenId, msg.sender, nftData[tokenId].endorsements);
    }
    
    // Get user's NFTs
    function getUserNFTs(address user) external view returns (uint256[] memory) {
        return userNFTs[user];
    }
    
    // Get NFT details
    function getNFTData(uint256 tokenId) external view returns (NFTData memory) {
        if (!_exists(tokenId)) revert TokenNotFound(tokenId);
        return nftData[tokenId];
    }
    
    // Get user's remaining weekly uploads
    function getRemainingWeeklyUploads(address user) external view returns (uint256) {
        uint256 currentWeek = getCurrentWeek();
        if (lastUploadWeek[user] < currentWeek) {
            return MAX_WEEKLY_UPLOADS;
        }
        return MAX_WEEKLY_UPLOADS - userWeeklyUploads[user];
    }
    
    // Check if user can upload this week
    function canUserUpload(address user) external view returns (bool) {
        uint256 currentWeek = getCurrentWeek();
        return lastUploadWeek[user] < currentWeek || userWeeklyUploads[user] < MAX_WEEKLY_UPLOADS;
    }
    
    // Get total supply of minted tokens
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter.current();
    }
    
    // Get all active NFTs with pagination
    function getActiveNFTs(uint256 offset, uint256 limit) external view returns (uint256[] memory, NFTData[] memory) {
        uint256 totalSupply = _tokenIdCounter.current();
        uint256[] memory activeTokenIds = new uint256[](limit);
        NFTData[] memory activeNFTData = new NFTData[](limit);
        
        uint256 count = 0;
        uint256 current = offset;
        
        while (count < limit && current < totalSupply) {
            if (_exists(current) && nftData[current].isActive) {
                activeTokenIds[count] = current;
                activeNFTData[count] = nftData[current];
                count++;
            }
            current++;
        }
        
        // Resize arrays to actual count
        uint256[] memory resultTokenIds = new uint256[](count);
        NFTData[] memory resultNFTData = new NFTData[](count);
        
        for (uint256 i = 0; i < count; i++) {
            resultTokenIds[i] = activeTokenIds[i];
            resultNFTData[i] = activeNFTData[i];
        }
        
        return (resultTokenIds, resultNFTData);
    }
    
    // Override required functions
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
        nftData[tokenId].isActive = false;
    }
    
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}