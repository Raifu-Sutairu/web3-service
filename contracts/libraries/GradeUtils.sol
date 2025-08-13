// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../interfaces/ICarbonNFT.sol";

/**
 * @title GradeUtils
 * @dev Utility library for grade-related calculations and conversions
 */
library GradeUtils {
    // Grade thresholds (can be overridden by governance)
    uint256 public constant DEFAULT_GRADE_A_THRESHOLD = 900;
    uint256 public constant DEFAULT_GRADE_B_THRESHOLD = 700;
    uint256 public constant DEFAULT_GRADE_C_THRESHOLD = 500;
    uint256 public constant DEFAULT_GRADE_D_THRESHOLD = 300;
    
    // Grade multipliers for pricing (in basis points)
    uint256 public constant GRADE_A_MULTIPLIER = 20000; // 2.0x
    uint256 public constant GRADE_B_MULTIPLIER = 15000; // 1.5x
    uint256 public constant GRADE_C_MULTIPLIER = 10000; // 1.0x
    uint256 public constant GRADE_D_MULTIPLIER = 7500;  // 0.75x
    uint256 public constant GRADE_F_MULTIPLIER = 5000;  // 0.5x
    
    /**
     * @dev Convert score to grade based on thresholds
     * @param score The carbon score to convert
     * @return The corresponding grade
     */
    function scoreToGrade(uint256 score) internal pure returns (ICarbonNFT.Grade) {
        if (score >= DEFAULT_GRADE_A_THRESHOLD) return ICarbonNFT.Grade.A;
        if (score >= DEFAULT_GRADE_B_THRESHOLD) return ICarbonNFT.Grade.B;
        if (score >= DEFAULT_GRADE_C_THRESHOLD) return ICarbonNFT.Grade.C;
        if (score >= DEFAULT_GRADE_D_THRESHOLD) return ICarbonNFT.Grade.D;
        return ICarbonNFT.Grade.F;
    }
    
    /**
     * @dev Convert score to grade with custom thresholds
     * @param score The carbon score to convert
     * @param thresholdA Custom threshold for grade A
     * @param thresholdB Custom threshold for grade B
     * @param thresholdC Custom threshold for grade C
     * @param thresholdD Custom threshold for grade D
     * @return The corresponding grade
     */
    function scoreToGradeWithThresholds(
        uint256 score,
        uint256 thresholdA,
        uint256 thresholdB,
        uint256 thresholdC,
        uint256 thresholdD
    ) internal pure returns (ICarbonNFT.Grade) {
        if (score >= thresholdA) return ICarbonNFT.Grade.A;
        if (score >= thresholdB) return ICarbonNFT.Grade.B;
        if (score >= thresholdC) return ICarbonNFT.Grade.C;
        if (score >= thresholdD) return ICarbonNFT.Grade.D;
        return ICarbonNFT.Grade.F;
    }
    
    /**
     * @dev Get grade multiplier for pricing calculations
     * @param grade The grade to get multiplier for
     * @return The multiplier in basis points
     */
    function getGradeMultiplier(ICarbonNFT.Grade grade) internal pure returns (uint256) {
        if (grade == ICarbonNFT.Grade.A) return GRADE_A_MULTIPLIER;
        if (grade == ICarbonNFT.Grade.B) return GRADE_B_MULTIPLIER;
        if (grade == ICarbonNFT.Grade.C) return GRADE_C_MULTIPLIER;
        if (grade == ICarbonNFT.Grade.D) return GRADE_D_MULTIPLIER;
        return GRADE_F_MULTIPLIER; // Grade F
    }
    
    /**
     * @dev Calculate suggested price based on grade
     * @param basePrice The base price in wei
     * @param grade The NFT grade
     * @return The suggested price with grade multiplier applied
     */
    function calculateGradeBasedPrice(uint256 basePrice, ICarbonNFT.Grade grade) internal pure returns (uint256) {
        uint256 multiplier = getGradeMultiplier(grade);
        return (basePrice * multiplier) / 10000; // Divide by basis points
    }
    
    /**
     * @dev Get grade as string for display purposes
     * @param grade The grade enum value
     * @return The grade as a string
     */
    function gradeToString(ICarbonNFT.Grade grade) internal pure returns (string memory) {
        if (grade == ICarbonNFT.Grade.A) return "A";
        if (grade == ICarbonNFT.Grade.B) return "B";
        if (grade == ICarbonNFT.Grade.C) return "C";
        if (grade == ICarbonNFT.Grade.D) return "D";
        return "F";
    }
    
    /**
     * @dev Get grade numeric value for calculations
     * @param grade The grade enum value
     * @return The numeric value (A=4, B=3, C=2, D=1, F=0)
     */
    function gradeToNumeric(ICarbonNFT.Grade grade) internal pure returns (uint256) {
        return uint256(grade);
    }
    
    /**
     * @dev Calculate average grade from multiple grades
     * @param grades Array of grades
     * @return The average grade
     */
    function calculateAverageGrade(ICarbonNFT.Grade[] memory grades) internal pure returns (ICarbonNFT.Grade) {
        if (grades.length == 0) return ICarbonNFT.Grade.F;
        
        uint256 sum = 0;
        for (uint256 i = 0; i < grades.length; i++) {
            sum += gradeToNumeric(grades[i]);
        }
        
        uint256 average = sum / grades.length;
        return ICarbonNFT.Grade(average);
    }
    
    /**
     * @dev Check if grade is valid
     * @param gradeValue The grade value to validate
     * @return True if valid grade (0-4)
     */
    function isValidGrade(uint256 gradeValue) internal pure returns (bool) {
        return gradeValue <= 4;
    }
}