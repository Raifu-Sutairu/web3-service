// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../libraries/PricingUtils.sol";
import "../interfaces/ICarbonNFT.sol";

/**
 * @title PricingUtilsTest
 * @dev Test contract for PricingUtils library functions
 */
contract PricingUtilsTest {
    function testCalculateSuggestedPrice(
        ICarbonNFT.NFTData memory nftData,
        uint256 basePrice
    ) external view returns (uint256) {
        return PricingUtils.calculateSuggestedPrice(nftData, basePrice);
    }
    
    function testCalculateFees(
        uint256 price,
        uint256 marketplaceFeePercent,
        uint256 royaltyPercent
    ) external pure returns (uint256, uint256, uint256) {
        return PricingUtils.calculateFees(price, marketplaceFeePercent, royaltyPercent);
    }
    
    function testCalculateEndorsementBonus(uint256 endorsements) external pure returns (uint256) {
        return PricingUtils.calculateEndorsementBonus(endorsements);
    }
    
    function testCalculateAgeMultiplier(uint256 mintedAt) external view returns (uint256) {
        return PricingUtils.calculateAgeMultiplier(mintedAt);
    }
    
    function testCalculateThemeMultiplier(string memory theme) external pure returns (uint256) {
        return PricingUtils.calculateThemeMultiplier(theme);
    }
    
    function testCalculatePriceRange(
        uint256 suggestedPrice,
        uint256 volatilityPercent
    ) external pure returns (uint256, uint256) {
        return PricingUtils.calculatePriceRange(suggestedPrice, volatilityPercent);
    }
    
    function testIsPriceReasonable(
        uint256 actualPrice,
        uint256 suggestedPrice,
        uint256 maxDeviationPercent
    ) external pure returns (bool) {
        return PricingUtils.isPriceReasonable(actualPrice, suggestedPrice, maxDeviationPercent);
    }
    
    function testCalculateBulkDiscount(uint256 totalPrice, uint256 quantity) external pure returns (uint256) {
        return PricingUtils.calculateBulkDiscount(totalPrice, quantity);
    }
}