// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../libraries/ArrayUtils.sol";

/**
 * @title ArrayUtilsTest
 * @dev Test contract for ArrayUtils library functions
 */
contract ArrayUtilsTest {
    function testRemoveUint256(uint256[] memory array, uint256 value) external pure returns (uint256[] memory) {
        return ArrayUtils.removeUint256(array, value);
    }
    
    function testRemoveAddress(address[] memory array, address value) external pure returns (address[] memory) {
        return ArrayUtils.removeAddress(array, value);
    }
    
    function testContainsUint256(uint256[] memory array, uint256 value) external pure returns (bool) {
        return ArrayUtils.containsUint256(array, value);
    }
    
    function testContainsAddress(address[] memory array, address value) external pure returns (bool) {
        return ArrayUtils.containsAddress(array, value);
    }
    
    function testUniqueAddresses(address[] memory array) external pure returns (address[] memory) {
        return ArrayUtils.uniqueAddresses(array);
    }
    
    function testUniqueUint256(uint256[] memory array) external pure returns (uint256[] memory) {
        return ArrayUtils.uniqueUint256(array);
    }
    
    function testSortUint256Ascending(uint256[] memory array) external pure returns (uint256[] memory) {
        return ArrayUtils.sortUint256Ascending(array);
    }
    
    function testSortUint256Descending(uint256[] memory array) external pure returns (uint256[] memory) {
        return ArrayUtils.sortUint256Descending(array);
    }
    
    function testSliceUint256(
        uint256[] memory array,
        uint256 start,
        uint256 end
    ) external pure returns (uint256[] memory) {
        return ArrayUtils.sliceUint256(array, start, end);
    }
    
    function testConcatUint256(
        uint256[] memory array1,
        uint256[] memory array2
    ) external pure returns (uint256[] memory) {
        return ArrayUtils.concatUint256(array1, array2);
    }
    
    function testMaxUint256(uint256[] memory array) external pure returns (uint256) {
        return ArrayUtils.maxUint256(array);
    }
    
    function testMinUint256(uint256[] memory array) external pure returns (uint256) {
        return ArrayUtils.minUint256(array);
    }
    
    function testSumUint256(uint256[] memory array) external pure returns (uint256) {
        return ArrayUtils.sumUint256(array);
    }
}