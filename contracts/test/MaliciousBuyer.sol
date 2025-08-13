// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../core/Marketplace.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/**
 * @title MaliciousBuyer
 * @dev Contract to test reentrancy protection in Marketplace purchases
 */
contract MaliciousBuyer is IERC721Receiver {
    Marketplace public marketplace;
    bool public attacking = false;
    
    constructor(address _marketplace) {
        marketplace = Marketplace(_marketplace);
    }
    
    function attemptReentrancy(uint256 listingId) external payable {
        attacking = true;
        marketplace.buyNFT{value: msg.value}(listingId);
    }
    
    // This would be called during the purchase process if reentrancy was possible
    receive() external payable {
        if (attacking && address(marketplace).balance > 0) {
            // Try to re-enter the buyNFT function
            marketplace.buyNFT{value: 0.1 ether}(1);
        }
    }
    
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}