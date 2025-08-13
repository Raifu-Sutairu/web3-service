// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title ArrayUtils
 * @dev Utility library for array operations and manipulations
 */
library ArrayUtils {
    /**
     * @dev Remove an element from uint256 array by value
     * @param array The array to modify
     * @param value The value to remove
     * @return The modified array
     */
    function removeUint256(uint256[] memory array, uint256 value) internal pure returns (uint256[] memory) {
        uint256 length = array.length;
        uint256[] memory result = new uint256[](length);
        uint256 resultIndex = 0;
        
        for (uint256 i = 0; i < length; i++) {
            if (array[i] != value) {
                result[resultIndex] = array[i];
                resultIndex++;
            }
        }
        
        // Resize result array to actual length
        uint256[] memory finalResult = new uint256[](resultIndex);
        for (uint256 i = 0; i < resultIndex; i++) {
            finalResult[i] = result[i];
        }
        
        return finalResult;
    }
    
    /**
     * @dev Remove an element from address array by value
     * @param array The array to modify
     * @param value The value to remove
     * @return The modified array
     */
    function removeAddress(address[] memory array, address value) internal pure returns (address[] memory) {
        uint256 length = array.length;
        address[] memory result = new address[](length);
        uint256 resultIndex = 0;
        
        for (uint256 i = 0; i < length; i++) {
            if (array[i] != value) {
                result[resultIndex] = array[i];
                resultIndex++;
            }
        }
        
        // Resize result array to actual length
        address[] memory finalResult = new address[](resultIndex);
        for (uint256 i = 0; i < resultIndex; i++) {
            finalResult[i] = result[i];
        }
        
        return finalResult;
    }
    
    /**
     * @dev Check if uint256 array contains a value
     * @param array The array to search
     * @param value The value to find
     * @return True if value is found
     */
    function containsUint256(uint256[] memory array, uint256 value) internal pure returns (bool) {
        for (uint256 i = 0; i < array.length; i++) {
            if (array[i] == value) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @dev Check if address array contains a value
     * @param array The array to search
     * @param value The value to find
     * @return True if value is found
     */
    function containsAddress(address[] memory array, address value) internal pure returns (bool) {
        for (uint256 i = 0; i < array.length; i++) {
            if (array[i] == value) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @dev Get unique addresses from an array (removes duplicates)
     * @param array The array to process
     * @return The array with unique addresses only
     */
    function uniqueAddresses(address[] memory array) internal pure returns (address[] memory) {
        if (array.length == 0) return array;
        
        address[] memory temp = new address[](array.length);
        uint256 uniqueCount = 0;
        
        for (uint256 i = 0; i < array.length; i++) {
            bool isUnique = true;
            for (uint256 j = 0; j < uniqueCount; j++) {
                if (temp[j] == array[i]) {
                    isUnique = false;
                    break;
                }
            }
            if (isUnique) {
                temp[uniqueCount] = array[i];
                uniqueCount++;
            }
        }
        
        // Create result array with correct size
        address[] memory result = new address[](uniqueCount);
        for (uint256 i = 0; i < uniqueCount; i++) {
            result[i] = temp[i];
        }
        
        return result;
    }
    
    /**
     * @dev Get unique uint256 values from an array (removes duplicates)
     * @param array The array to process
     * @return The array with unique values only
     */
    function uniqueUint256(uint256[] memory array) internal pure returns (uint256[] memory) {
        if (array.length == 0) return array;
        
        uint256[] memory temp = new uint256[](array.length);
        uint256 uniqueCount = 0;
        
        for (uint256 i = 0; i < array.length; i++) {
            bool isUnique = true;
            for (uint256 j = 0; j < uniqueCount; j++) {
                if (temp[j] == array[i]) {
                    isUnique = false;
                    break;
                }
            }
            if (isUnique) {
                temp[uniqueCount] = array[i];
                uniqueCount++;
            }
        }
        
        // Create result array with correct size
        uint256[] memory result = new uint256[](uniqueCount);
        for (uint256 i = 0; i < uniqueCount; i++) {
            result[i] = temp[i];
        }
        
        return result;
    }
    
    /**
     * @dev Sort uint256 array in ascending order (bubble sort - suitable for small arrays)
     * @param array The array to sort
     * @return The sorted array
     */
    function sortUint256Ascending(uint256[] memory array) internal pure returns (uint256[] memory) {
        uint256 length = array.length;
        uint256[] memory result = new uint256[](length);
        
        // Copy array
        for (uint256 i = 0; i < length; i++) {
            result[i] = array[i];
        }
        
        // Bubble sort
        for (uint256 i = 0; i < length; i++) {
            for (uint256 j = 0; j < length - i - 1; j++) {
                if (result[j] > result[j + 1]) {
                    uint256 temp = result[j];
                    result[j] = result[j + 1];
                    result[j + 1] = temp;
                }
            }
        }
        
        return result;
    }
    
    /**
     * @dev Sort uint256 array in descending order
     * @param array The array to sort
     * @return The sorted array
     */
    function sortUint256Descending(uint256[] memory array) internal pure returns (uint256[] memory) {
        uint256 length = array.length;
        uint256[] memory result = new uint256[](length);
        
        // Copy array
        for (uint256 i = 0; i < length; i++) {
            result[i] = array[i];
        }
        
        // Bubble sort (descending)
        for (uint256 i = 0; i < length; i++) {
            for (uint256 j = 0; j < length - i - 1; j++) {
                if (result[j] < result[j + 1]) {
                    uint256 temp = result[j];
                    result[j] = result[j + 1];
                    result[j + 1] = temp;
                }
            }
        }
        
        return result;
    }
    
    /**
     * @dev Slice an array to get a subset
     * @param array The source array
     * @param start Starting index (inclusive)
     * @param end Ending index (exclusive)
     * @return The sliced array
     */
    function sliceUint256(
        uint256[] memory array,
        uint256 start,
        uint256 end
    ) internal pure returns (uint256[] memory) {
        require(start <= end && end <= array.length, "Invalid slice parameters");
        
        uint256 length = end - start;
        uint256[] memory result = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            result[i] = array[start + i];
        }
        
        return result;
    }
    
    /**
     * @dev Concatenate two uint256 arrays
     * @param array1 First array
     * @param array2 Second array
     * @return The concatenated array
     */
    function concatUint256(
        uint256[] memory array1,
        uint256[] memory array2
    ) internal pure returns (uint256[] memory) {
        uint256 totalLength = array1.length + array2.length;
        uint256[] memory result = new uint256[](totalLength);
        
        for (uint256 i = 0; i < array1.length; i++) {
            result[i] = array1[i];
        }
        
        for (uint256 i = 0; i < array2.length; i++) {
            result[array1.length + i] = array2[i];
        }
        
        return result;
    }
    
    /**
     * @dev Find the maximum value in a uint256 array
     * @param array The array to search
     * @return The maximum value
     */
    function maxUint256(uint256[] memory array) internal pure returns (uint256) {
        require(array.length > 0, "Array is empty");
        
        uint256 max = array[0];
        for (uint256 i = 1; i < array.length; i++) {
            if (array[i] > max) {
                max = array[i];
            }
        }
        
        return max;
    }
    
    /**
     * @dev Find the minimum value in a uint256 array
     * @param array The array to search
     * @return The minimum value
     */
    function minUint256(uint256[] memory array) internal pure returns (uint256) {
        require(array.length > 0, "Array is empty");
        
        uint256 min = array[0];
        for (uint256 i = 1; i < array.length; i++) {
            if (array[i] < min) {
                min = array[i];
            }
        }
        
        return min;
    }
    
    /**
     * @dev Calculate sum of all values in uint256 array
     * @param array The array to sum
     * @return The sum of all values
     */
    function sumUint256(uint256[] memory array) internal pure returns (uint256) {
        uint256 sum = 0;
        for (uint256 i = 0; i < array.length; i++) {
            sum += array[i];
        }
        return sum;
    }
}