// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../libraries/ValidationUtils.sol";

/**
 * @title ValidationUtilsTest
 * @dev Test contract for ValidationUtils library functions
 */
contract ValidationUtilsTest {
    using ValidationUtils for uint256;
    using ValidationUtils for address;
    using ValidationUtils for string;
    
    function testRequireValidAddress(address addr) external pure {
        ValidationUtils.requireValidAddress(addr);
    }
    
    function testRequirePositiveAmount(uint256 amount) external pure {
        ValidationUtils.requirePositiveAmount(amount);
    }
    
    function testRequireAmountInRange(uint256 amount, uint256 min, uint256 max) external pure {
        ValidationUtils.requireAmountInRange(amount, min, max);
    }
    
    function testRequireValidPercentage(uint256 percentage) external pure {
        ValidationUtils.requireValidPercentage(percentage);
    }
    
    function testRequireNonEmptyString(string memory str) external pure {
        ValidationUtils.requireNonEmptyString(str);
    }
    
    function testRequireValidArrayLength(uint256 length, uint256 maxLength) external pure {
        ValidationUtils.requireValidArrayLength(length, maxLength);
    }
    
    function testRequireValidTimeRange(uint256 startTime, uint256 endTime) external view {
        ValidationUtils.requireValidTimeRange(startTime, endTime);
    }
    
    function testIsInPast(uint256 timestamp) external view returns (bool) {
        return ValidationUtils.isInPast(timestamp);
    }
    
    function testIsInFuture(uint256 timestamp) external view returns (bool) {
        return ValidationUtils.isInFuture(timestamp);
    }
    
    function testCalculatePercentage(uint256 value, uint256 percentage) external pure returns (uint256) {
        return ValidationUtils.calculatePercentage(value, percentage);
    }
    
    function testSafeDivision(uint256 dividend, uint256 divisor) external pure returns (uint256) {
        return ValidationUtils.safeDivision(dividend, divisor);
    }
    
    function testStringsEqual(string memory a, string memory b) external pure returns (bool) {
        return ValidationUtils.stringsEqual(a, b);
    }
    
    function testRequireValidPagination(uint256 offset, uint256 limit, uint256 maxLimit) external pure {
        ValidationUtils.requireValidPagination(offset, limit, maxLimit);
    }
}