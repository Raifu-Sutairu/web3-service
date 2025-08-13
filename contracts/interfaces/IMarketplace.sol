// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IMarketplace
 * @dev Interface for Marketplace contract to enable cross-contract communication
 */
interface IMarketplace {
    // Structs
    struct Listing {
        uint256 listingId;
        uint256 tokenId;
        address seller;
        uint256 price;
        uint256 listedAt;
        bool isActive;
    }
    
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
    
    // Core functions
    function listNFT(uint256 tokenId, uint256 price) external;
    function buyNFT(uint256 listingId) external payable;
    function cancelListing(uint256 listingId) external;
    function updateListingPrice(uint256 listingId, uint256 newPrice) external;
    
    // View functions
    function getActiveListings(uint256 offset, uint256 limit) external view returns (Listing[] memory);
    function getSellerListings(address seller) external view returns (uint256[] memory);
    function getSuggestedPrice(uint256 tokenId) external view returns (uint256);
    function getListing(uint256 listingId) external view returns (Listing memory);
    function getListingByToken(uint256 tokenId) external view returns (Listing memory);
    function isTokenListed(uint256 tokenId) external view returns (bool);
    function getTotalListings() external view returns (uint256);
    function getMarketplaceStats() external view returns (uint256 totalListings, uint256 activeListings, uint256 totalVolume);
    
    // Admin functions
    function setMarketplaceFee(uint256 newFeePercent) external;
    function setRoyaltyPercent(uint256 newRoyaltyPercent) external;
    function withdrawFees() external;
}