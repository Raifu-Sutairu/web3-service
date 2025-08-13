// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../libraries/GradeUtils.sol";
import "../interfaces/ICarbonNFT.sol";

/**
 * @title GradeUtilsTest
 * @dev Test contract for GradeUtils library functions
 */
contract GradeUtilsTest {
    using GradeUtils for ICarbonNFT.Grade;
    
    function testScoreToGrade(uint256 score) external pure returns (ICarbonNFT.Grade) {
        return GradeUtils.scoreToGrade(score);
    }
    
    function testScoreToGradeWithThresholds(
        uint256 score,
        uint256 thresholdA,
        uint256 thresholdB,
        uint256 thresholdC,
        uint256 thresholdD
    ) external pure returns (ICarbonNFT.Grade) {
        return GradeUtils.scoreToGradeWithThresholds(score, thresholdA, thresholdB, thresholdC, thresholdD);
    }
    
    function testGetGradeMultiplier(ICarbonNFT.Grade grade) external pure returns (uint256) {
        return GradeUtils.getGradeMultiplier(grade);
    }
    
    function testCalculateGradeBasedPrice(uint256 basePrice, ICarbonNFT.Grade grade) external pure returns (uint256) {
        return GradeUtils.calculateGradeBasedPrice(basePrice, grade);
    }
    
    function testGradeToString(ICarbonNFT.Grade grade) external pure returns (string memory) {
        return GradeUtils.gradeToString(grade);
    }
    
    function testGradeToNumeric(ICarbonNFT.Grade grade) external pure returns (uint256) {
        return GradeUtils.gradeToNumeric(grade);
    }
    
    function testCalculateAverageGrade(ICarbonNFT.Grade[] memory grades) external pure returns (ICarbonNFT.Grade) {
        return GradeUtils.calculateAverageGrade(grades);
    }
    
    function testIsValidGrade(uint256 gradeValue) external pure returns (bool) {
        return GradeUtils.isValidGrade(gradeValue);
    }
}