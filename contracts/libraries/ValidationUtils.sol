// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title ValidationUtils
 * @dev Utility library for common validation functions across contracts
 */
library ValidationUtils {
    // Custom errors
    error InvalidAddress(address addr);
    error InvalidAmount(uint256 amount);
    error InvalidPercentage(uint256 percentage);
    error InvalidString(string str);
    error InvalidArrayLength(uint256 length);
    error InvalidTimeRange(uint256 start, uint256 end);
    
    /**
     * @dev Validate that an address is not zero
     * @param addr The address to validate
     */
    function requireValidAddress(address addr) internal pure {
        if (addr == address(0)) {
            revert InvalidAddress(addr);
        }
    }
    
    /**
     * @dev Validate that an amount is greater than zero
     * @param amount The amount to validate
     */
    function requirePositiveAmount(uint256 amount) internal pure {
        if (amount == 0) {
            revert InvalidAmount(amount);
        }
    }
    
    /**
     * @dev Validate that an amount is within a range
     * @param amount The amount to validate
     * @param min Minimum allowed value
     * @param max Maximum allowed value
     */
    function requireAmountInRange(uint256 amount, uint256 min, uint256 max) internal pure {
        if (amount < min || amount > max) {
            revert InvalidAmount(amount);
        }
    }
    
    /**
     * @dev Validate percentage (0-10000 basis points = 0-100%)
     * @param percentage The percentage in basis points to validate
     */
    function requireValidPercentage(uint256 percentage) internal pure {
        if (percentage > 10000) {
            revert InvalidPercentage(percentage);
        }
    }
    
    /**
     * @dev Validate that a string is not empty
     * @param str The string to validate
     */
    function requireNonEmptyString(string memory str) internal pure {
        if (bytes(str).length == 0) {
            revert InvalidString(str);
        }
    }
    
    /**
     * @dev Validate array length is within bounds
     * @param length The array length to validate
     * @param maxLength Maximum allowed length
     */
    function requireValidArrayLength(uint256 length, uint256 maxLength) internal pure {
        if (length == 0 || length > maxLength) {
            revert InvalidArrayLength(length);
        }
    }
    
    /**
     * @dev Validate time range (start < end, both in future)
     * @param startTime The start timestamp
     * @param endTime The end timestamp
     */
    function requireValidTimeRange(uint256 startTime, uint256 endTime) internal view {
        if (startTime >= endTime || startTime < block.timestamp) {
            revert InvalidTimeRange(startTime, endTime);
        }
    }
    
    /**
     * @dev Check if a timestamp is in the past
     * @param timestamp The timestamp to check
     * @return True if timestamp is in the past
     */
    function isInPast(uint256 timestamp) internal view returns (bool) {
        return timestamp < block.timestamp;
    }
    
    /**
     * @dev Check if a timestamp is in the future
     * @param timestamp The timestamp to check
     * @return True if timestamp is in the future
     */
    function isInFuture(uint256 timestamp) internal view returns (bool) {
        return timestamp > block.timestamp;
    }
    
    /**
     * @dev Calculate percentage of a value
     * @param value The base value
     * @param percentage The percentage in basis points (100 = 1%)
     * @return The calculated percentage amount
     */
    function calculatePercentage(uint256 value, uint256 percentage) internal pure returns (uint256) {
        return (value * percentage) / 10000;
    }
    
    /**
     * @dev Safe division with zero check
     * @param dividend The dividend
     * @param divisor The divisor
     * @return The result of division, or 0 if divisor is 0
     */
    function safeDivision(uint256 dividend, uint256 divisor) internal pure returns (uint256) {
        if (divisor == 0) return 0;
        return dividend / divisor;
    }
    
    /**
     * @dev Check if two strings are equal
     * @param a First string
     * @param b Second string
     * @return True if strings are equal
     */
    function stringsEqual(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }
    
    /**
     * @dev Validate pagination parameters
     * @param offset The starting index
     * @param limit The maximum number of items
     * @param maxLimit The maximum allowed limit
     */
    function requireValidPagination(uint256 offset, uint256 limit, uint256 maxLimit) internal pure {
        requirePositiveAmount(limit);
        requireAmountInRange(limit, 1, maxLimit);
    }
}