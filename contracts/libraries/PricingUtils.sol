// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../interfaces/ICarbonNFT.sol";
import "./GradeUtils.sol";
import "./ValidationUtils.sol";

/**
 * @title PricingUtils
 * @dev Utility library for pricing calculations across marketplace and other contracts
 */
library PricingUtils {
    using GradeUtils for ICarbonNFT.Grade;
    using ValidationUtils for uint256;
    
    // Constants
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant DEFAULT_BASE_PRICE = 0.01 ether; // 0.01 ETH
    uint256 public constant MAX_FEE_PERCENTAGE = 1000; // 10% max fee
    
    // Pricing factors
    struct PricingFactors {
        uint256 basePrice;
        uint256 gradeMultiplier;
        uint256 endorsementBonus;
        uint256 ageMultiplier;
        uint256 themeMultiplier;
    }
    
    /**
     * @dev Calculate suggested price for an NFT based on multiple factors
     * @param nftData The NFT data containing grade, endorsements, etc.
     * @param basePrice The base price to start calculations from
     * @return The suggested price in wei
     */
    function calculateSuggestedPrice(
        ICarbonNFT.NFTData memory nftData,
        uint256 basePrice
    ) internal view returns (uint256) {
        if (basePrice == 0) basePrice = DEFAULT_BASE_PRICE;
        
        PricingFactors memory factors = PricingFactors({
            basePrice: basePrice,
            gradeMultiplier: GradeUtils.getGradeMultiplier(nftData.currentGrade),
            endorsementBonus: calculateEndorsementBonus(nftData.endorsements),
            ageMultiplier: calculateAgeMultiplier(nftData.mintedAt),
            themeMultiplier: calculateThemeMultiplier(nftData.theme)
        });
        
        return _applyPricingFactors(factors);
    }
    
    /**
     * @dev Calculate marketplace fees for a transaction
     * @param price The sale price
     * @param marketplaceFeePercent The marketplace fee percentage in basis points
     * @param royaltyPercent The royalty percentage in basis points
     * @return marketplaceFee The marketplace fee amount
     * @return royalty The royalty amount
     * @return sellerAmount The amount seller receives
     */
    function calculateFees(
        uint256 price,
        uint256 marketplaceFeePercent,
        uint256 royaltyPercent
    ) internal pure returns (
        uint256 marketplaceFee,
        uint256 royalty,
        uint256 sellerAmount
    ) {
        marketplaceFeePercent.requireValidPercentage();
        royaltyPercent.requireValidPercentage();
        
        marketplaceFee = ValidationUtils.calculatePercentage(price, marketplaceFeePercent);
        royalty = ValidationUtils.calculatePercentage(price, royaltyPercent);
        sellerAmount = price - marketplaceFee - royalty;
        
        return (marketplaceFee, royalty, sellerAmount);
    }
    
    /**
     * @dev Calculate endorsement bonus multiplier
     * @param endorsements Number of endorsements
     * @return Bonus multiplier in basis points
     */
    function calculateEndorsementBonus(uint256 endorsements) internal pure returns (uint256) {
        // Each endorsement adds 1% bonus, capped at 50%
        uint256 bonus = endorsements * 100; // 100 basis points = 1%
        return bonus > 5000 ? 5000 : bonus; // Cap at 50%
    }
    
    /**
     * @dev Calculate age-based multiplier (older NFTs may be more valuable)
     * @param mintedAt The timestamp when NFT was minted
     * @return Age multiplier in basis points
     */
    function calculateAgeMultiplier(uint256 mintedAt) internal view returns (uint256) {
        uint256 age = block.timestamp - mintedAt;
        uint256 ageInDays = age / 86400; // Convert to days
        
        // Older NFTs get slight premium, capped at 20%
        uint256 ageBonus = ageInDays * 10; // 0.1% per day
        return ageBonus > 2000 ? 2000 : ageBonus; // Cap at 20%
    }
    
    /**
     * @dev Calculate theme-based multiplier (some themes may be more popular)
     * @param theme The NFT theme
     * @return Theme multiplier in basis points
     */
    function calculateThemeMultiplier(string memory theme) internal pure returns (uint256) {
        bytes32 themeHash = keccak256(abi.encodePacked(theme));
        
        // Premium themes get higher multipliers
        if (themeHash == keccak256(abi.encodePacked("renewable-energy"))) return 1500; // 15% bonus
        if (themeHash == keccak256(abi.encodePacked("carbon-neutral"))) return 1200; // 12% bonus
        if (themeHash == keccak256(abi.encodePacked("sustainability"))) return 1000; // 10% bonus
        if (themeHash == keccak256(abi.encodePacked("eco-friendly"))) return 800; // 8% bonus
        
        return 0; // No bonus for other themes
    }
    
    /**
     * @dev Apply all pricing factors to calculate final price
     * @param factors The pricing factors struct
     * @return The calculated price
     */
    function _applyPricingFactors(PricingFactors memory factors) private pure returns (uint256) {
        uint256 price = factors.basePrice;
        
        // Apply grade multiplier
        price = (price * factors.gradeMultiplier) / BASIS_POINTS;
        
        // Apply bonuses additively
        uint256 totalBonus = factors.endorsementBonus + factors.ageMultiplier + factors.themeMultiplier;
        price = price + ((price * totalBonus) / BASIS_POINTS);
        
        return price;
    }
    
    /**
     * @dev Calculate price range for an NFT (min/max based on market conditions)
     * @param suggestedPrice The base suggested price
     * @param volatilityPercent Market volatility percentage in basis points
     * @return minPrice The minimum suggested price
     * @return maxPrice The maximum suggested price
     */
    function calculatePriceRange(
        uint256 suggestedPrice,
        uint256 volatilityPercent
    ) internal pure returns (uint256 minPrice, uint256 maxPrice) {
        volatilityPercent.requireValidPercentage();
        
        uint256 volatilityAmount = ValidationUtils.calculatePercentage(suggestedPrice, volatilityPercent);
        
        minPrice = suggestedPrice > volatilityAmount ? suggestedPrice - volatilityAmount : suggestedPrice / 2;
        maxPrice = suggestedPrice + volatilityAmount;
        
        return (minPrice, maxPrice);
    }
    
    /**
     * @dev Validate that a price is reasonable compared to suggested price
     * @param actualPrice The actual listing price
     * @param suggestedPrice The suggested price
     * @param maxDeviationPercent Maximum allowed deviation in basis points
     * @return True if price is within acceptable range
     */
    function isPriceReasonable(
        uint256 actualPrice,
        uint256 suggestedPrice,
        uint256 maxDeviationPercent
    ) internal pure returns (bool) {
        if (suggestedPrice == 0) return actualPrice > 0;
        
        uint256 deviation = actualPrice > suggestedPrice 
            ? ((actualPrice - suggestedPrice) * BASIS_POINTS) / suggestedPrice
            : ((suggestedPrice - actualPrice) * BASIS_POINTS) / suggestedPrice;
            
        return deviation <= maxDeviationPercent;
    }
    
    /**
     * @dev Calculate bulk discount for multiple NFT purchases
     * @param totalPrice The total price of all NFTs
     * @param quantity The number of NFTs being purchased
     * @return The discounted price
     */
    function calculateBulkDiscount(uint256 totalPrice, uint256 quantity) internal pure returns (uint256) {
        if (quantity < 2) return totalPrice;
        
        uint256 discountPercent = 0;
        if (quantity >= 10) discountPercent = 1000; // 10% for 10+
        else if (quantity >= 5) discountPercent = 500; // 5% for 5-9
        else if (quantity >= 2) discountPercent = 200; // 2% for 2-4
        
        uint256 discount = ValidationUtils.calculatePercentage(totalPrice, discountPercent);
        return totalPrice - discount;
    }
}