// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./CarbonNFT.sol";

/**
 * @title Marketplace
 * @dev NFT marketplace with escrow, royalties, and grade-based pricing
 */
contract Marketplace is ReentrancyGuard, Ownable, IERC721Receiver {
    using Counters for Counters.Counter;
    
    CarbonNFT public immutable carbonNFT;
    Counters.Counter private _listingIdCounter;
    
    // Marketplace configuration
    uint256 public marketplaceFeePercent = 250; // 2.5% in basis points
    uint256 public royaltyPercent = 500; // 5% in basis points
    uint256 public constant BASIS_POINTS = 10000;
    
    // Grade-based pricing multipliers (in basis points)
    mapping(CarbonNFT.Grade => uint256) public gradeMultipliers;
    
    struct Listing {
        uint256 listingId;
        uint256 tokenId;
        address seller;
        uint256 price;
        uint256 listedAt;
        bool isActive;
    }
    
    // Mappings
    mapping(uint256 => Listing) public listings; // listingId => Listing
    mapping(uint256 => uint256) public tokenToListing; // tokenId => listingId
    mapping(address => uint256[]) public sellerListings; // seller => listingId[]
    
    // Events
    event NFTListed(
        uint256 indexed listingId,
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price
    );
    
    event NFTSold(
        uint256 indexed listingId,
        uint256 indexed tokenId,
        address indexed seller,
        address buyer,
        uint256 price,
        uint256 marketplaceFee,
        uint256 royalty
    );
    
    event ListingCancelled(
        uint256 indexed listingId,
        uint256 indexed tokenId,
        address indexed seller
    );
    
    event PriceUpdated(
        uint256 indexed listingId,
        uint256 indexed tokenId,
        uint256 oldPrice,
        uint256 newPrice
    );
    
    event MarketplaceFeeUpdated(uint256 oldFee, uint256 newFee);
    event RoyaltyUpdated(uint256 oldRoyalty, uint256 newRoyalty);
    event GradeMultiplierUpdated(CarbonNFT.Grade grade, uint256 multiplier);
    
    // Custom errors for gas efficiency
    error UnauthorizedAccess(address caller);
    error InvalidPrice(uint256 price);
    error TokenNotFound(uint256 tokenId);
    error ListingNotFound(uint256 listingId);
    error ListingNotActive(uint256 listingId);
    error InsufficientFunds(uint256 required, uint256 provided);
    error InvalidFeePercent(uint256 percent);
    error TokenAlreadyListed(uint256 tokenId);
    error NotTokenOwner(address caller, uint256 tokenId);
    error ZeroAddress();
    error TransferFailed(address to, uint256 amount);
    error InvalidLimit(uint256 limit);
    error InvalidOffset(uint256 offset);
    error ContractCallFailed(string reason);
    error ReentrancyDetected();
    
    constructor(address _carbonNFT) {
        if (_carbonNFT == address(0)) revert ZeroAddress();
        carbonNFT = CarbonNFT(_carbonNFT);
        
        // Initialize grade multipliers (higher grades get higher suggested prices)
        gradeMultipliers[CarbonNFT.Grade.F] = 5000;  // 0.5x
        gradeMultipliers[CarbonNFT.Grade.D] = 7500;  // 0.75x
        gradeMultipliers[CarbonNFT.Grade.C] = 10000; // 1.0x (base)
        gradeMultipliers[CarbonNFT.Grade.B] = 15000; // 1.5x
        gradeMultipliers[CarbonNFT.Grade.A] = 20000; // 2.0x
    }
    
    /**
     * @dev List an NFT for sale
     * @param tokenId The ID of the NFT to list
     * @param price The listing price in wei
     */
    function listNFT(uint256 tokenId, uint256 price) external nonReentrant {
        if (price == 0 || price > 1000 ether) revert InvalidPrice(price); // Add upper bound
        
        address tokenOwner;
        try carbonNFT.ownerOf(tokenId) returns (address _owner) {
            tokenOwner = _owner;
        } catch {
            revert TokenNotFound(tokenId);
        }
        
        if (tokenOwner != msg.sender) revert NotTokenOwner(msg.sender, tokenId);
        if (tokenToListing[tokenId] != 0 && listings[tokenToListing[tokenId]].isActive) {
            revert TokenAlreadyListed(tokenId);
        }
        
        // Transfer NFT to marketplace for escrow
        carbonNFT.safeTransferFrom(msg.sender, address(this), tokenId);
        
        // Create listing
        _listingIdCounter.increment();
        uint256 listingId = _listingIdCounter.current();
        
        listings[listingId] = Listing({
            listingId: listingId,
            tokenId: tokenId,
            seller: msg.sender,
            price: price,
            listedAt: block.timestamp,
            isActive: true
        });
        
        tokenToListing[tokenId] = listingId;
        sellerListings[msg.sender].push(listingId);
        
        emit NFTListed(listingId, tokenId, msg.sender, price);
    }
    
    /**
     * @dev Purchase a listed NFT
     * @param listingId The ID of the listing to purchase
     */
    function buyNFT(uint256 listingId) external payable nonReentrant {
        Listing storage listing = listings[listingId];
        
        if (listing.listingId == 0) revert ListingNotFound(listingId);
        if (!listing.isActive) revert ListingNotActive(listingId);
        if (msg.value < listing.price) revert InsufficientFunds(listing.price, msg.value);
        
        // Calculate fees
        uint256 marketplaceFee = (listing.price * marketplaceFeePercent) / BASIS_POINTS;
        uint256 royalty = (listing.price * royaltyPercent) / BASIS_POINTS;
        uint256 sellerAmount = listing.price - marketplaceFee - royalty;
        
        // Mark listing as inactive
        listing.isActive = false;
        tokenToListing[listing.tokenId] = 0;
        
        // Transfer NFT to buyer
        carbonNFT.safeTransferFrom(address(this), msg.sender, listing.tokenId);
        
        // Distribute payments with error handling
        (bool sellerSuccess, ) = payable(listing.seller).call{value: sellerAmount}("");
        if (!sellerSuccess) revert TransferFailed(listing.seller, sellerAmount);
        
        (bool feeSuccess, ) = payable(owner()).call{value: marketplaceFee}("");
        if (!feeSuccess) revert TransferFailed(owner(), marketplaceFee);
        
        // Send royalty to original creator (NFT contract owner for now)
        (bool royaltySuccess, ) = payable(carbonNFT.owner()).call{value: royalty}("");
        if (!royaltySuccess) revert TransferFailed(carbonNFT.owner(), royalty);
        
        // Refund excess payment
        if (msg.value > listing.price) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - listing.price}("");
            if (!refundSuccess) revert TransferFailed(msg.sender, msg.value - listing.price);
        }
        
        emit NFTSold(
            listingId,
            listing.tokenId,
            listing.seller,
            msg.sender,
            listing.price,
            marketplaceFee,
            royalty
        );
    }
    
    /**
     * @dev Cancel a listing and return NFT to seller
     * @param listingId The ID of the listing to cancel
     */
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        
        if (listing.listingId == 0) revert ListingNotFound(listingId);
        if (!listing.isActive) revert ListingNotActive(listingId);
        if (listing.seller != msg.sender) revert UnauthorizedAccess(msg.sender);
        
        // Mark listing as inactive
        listing.isActive = false;
        tokenToListing[listing.tokenId] = 0;
        
        // Return NFT to seller
        carbonNFT.safeTransferFrom(address(this), msg.sender, listing.tokenId);
        
        emit ListingCancelled(listingId, listing.tokenId, msg.sender);
    }
    
    /**
     * @dev Update the price of an active listing
     * @param listingId The ID of the listing to update
     * @param newPrice The new price in wei
     */
    function updateListingPrice(uint256 listingId, uint256 newPrice) external {
        if (newPrice == 0 || newPrice > 1000 ether) revert InvalidPrice(newPrice);
        
        Listing storage listing = listings[listingId];
        
        if (listing.listingId == 0) revert ListingNotFound(listingId);
        if (!listing.isActive) revert ListingNotActive(listingId);
        if (listing.seller != msg.sender) revert UnauthorizedAccess(msg.sender);
        
        uint256 oldPrice = listing.price;
        listing.price = newPrice;
        
        emit PriceUpdated(listingId, listing.tokenId, oldPrice, newPrice);
    }
    
    /**
     * @dev Get active listings with pagination
     * @param offset Starting index
     * @param limit Maximum number of listings to return
     * @return Array of active listings
     */
    function getActiveListings(uint256 offset, uint256 limit) 
        external 
        view 
        returns (Listing[] memory) 
    {
        uint256 totalListings = _listingIdCounter.current();
        uint256[] memory activeIds = new uint256[](limit);
        uint256 count = 0;
        uint256 current = offset + 1; // listingId starts from 1
        
        // Find active listings
        while (count < limit && current <= totalListings) {
            if (listings[current].isActive) {
                activeIds[count] = current;
                count++;
            }
            current++;
        }
        
        // Create result array with actual count
        Listing[] memory result = new Listing[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = listings[activeIds[i]];
        }
        
        return result;
    }
    
    /**
     * @dev Get listings by seller
     * @param seller The seller address
     * @return Array of listing IDs for the seller
     */
    function getSellerListings(address seller) external view returns (uint256[] memory) {
        return sellerListings[seller];
    }
    
    /**
     * @dev Get suggested price for an NFT based on its grade
     * @param tokenId The NFT token ID
     * @return Suggested price in wei (base price * grade multiplier)
     */
    function getSuggestedPrice(uint256 tokenId) external view returns (uint256) {
        CarbonNFT.NFTData memory nftData;
        try carbonNFT.getNFTData(tokenId) returns (CarbonNFT.NFTData memory _nftData) {
            nftData = _nftData;
        } catch {
            revert TokenNotFound(tokenId);
        }
        
        uint256 basePrice = 0.01 ether; // Base price of 0.01 ETH
        return (basePrice * gradeMultipliers[nftData.currentGrade]) / BASIS_POINTS;
    }
    
    /**
     * @dev Get listing details by listing ID
     * @param listingId The listing ID
     * @return The listing details
     */
    function getListing(uint256 listingId) external view returns (Listing memory) {
        if (listings[listingId].listingId == 0) revert ListingNotFound(listingId);
        return listings[listingId];
    }
    
    /**
     * @dev Get listing by token ID
     * @param tokenId The NFT token ID
     * @return The listing details (if active)
     */
    function getListingByToken(uint256 tokenId) external view returns (Listing memory) {
        uint256 listingId = tokenToListing[tokenId];
        if (listingId == 0 || !listings[listingId].isActive) revert ListingNotFound(listingId);
        return listings[listingId];
    }
    
    /**
     * @dev Check if a token is currently listed
     * @param tokenId The NFT token ID
     * @return True if the token is actively listed
     */
    function isTokenListed(uint256 tokenId) external view returns (bool) {
        uint256 listingId = tokenToListing[tokenId];
        return listingId != 0 && listings[listingId].isActive;
    }
    
    // Admin functions
    
    /**
     * @dev Update marketplace fee percentage (only owner)
     * @param newFeePercent New fee percentage in basis points
     */
    function setMarketplaceFee(uint256 newFeePercent) external onlyOwner {
        if (newFeePercent > 1000) revert InvalidFeePercent(newFeePercent); // Max 10%
        
        uint256 oldFee = marketplaceFeePercent;
        marketplaceFeePercent = newFeePercent;
        
        emit MarketplaceFeeUpdated(oldFee, newFeePercent);
    }
    
    /**
     * @dev Update royalty percentage (only owner)
     * @param newRoyaltyPercent New royalty percentage in basis points
     */
    function setRoyaltyPercent(uint256 newRoyaltyPercent) external onlyOwner {
        if (newRoyaltyPercent > 1000) revert InvalidFeePercent(newRoyaltyPercent); // Max 10%
        
        uint256 oldRoyalty = royaltyPercent;
        royaltyPercent = newRoyaltyPercent;
        
        emit RoyaltyUpdated(oldRoyalty, newRoyaltyPercent);
    }
    
    /**
     * @dev Update grade multiplier for pricing suggestions (only owner)
     * @param grade The grade to update
     * @param multiplier The new multiplier in basis points
     */
    function setGradeMultiplier(CarbonNFT.Grade grade, uint256 multiplier) external onlyOwner {
        gradeMultipliers[grade] = multiplier;
        emit GradeMultiplierUpdated(grade, multiplier);
    }
    
    /**
     * @dev Withdraw accumulated marketplace fees (only owner)
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool success, ) = payable(owner()).call{value: balance}("");
            if (!success) revert TransferFailed(owner(), balance);
        }
    }
    
    /**
     * @dev Emergency function to return NFT to seller if needed (only owner)
     * @param listingId The listing ID to emergency cancel
     */
    function emergencyCancelListing(uint256 listingId) external onlyOwner {
        Listing storage listing = listings[listingId];
        
        if (listing.listingId == 0) revert ListingNotFound(listingId);
        if (!listing.isActive) revert ListingNotActive(listingId);
        
        // Mark listing as inactive
        listing.isActive = false;
        tokenToListing[listing.tokenId] = 0;
        
        // Return NFT to seller
        carbonNFT.safeTransferFrom(address(this), listing.seller, listing.tokenId);
        
        emit ListingCancelled(listingId, listing.tokenId, listing.seller);
    }
    
    /**
     * @dev Handle the receipt of an NFT
     */
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
    
    /**
     * @dev Get total number of listings created
     */
    function getTotalListings() external view returns (uint256) {
        return _listingIdCounter.current();
    }
    
    /**
     * @dev Get marketplace statistics
     * @return totalListings Total number of listings created
     * @return activeListings Number of currently active listings
     * @return totalVolume Total trading volume (not tracked in this version)
     */
    function getMarketplaceStats() external view returns (
        uint256 totalListings,
        uint256 activeListings,
        uint256 totalVolume
    ) {
        totalListings = _listingIdCounter.current();
        
        // Count active listings
        for (uint256 i = 1; i <= totalListings; i++) {
            if (listings[i].isActive) {
                activeListings++;
            }
        }
        
        // totalVolume would require additional tracking - set to 0 for now
        totalVolume = 0;
    }
}