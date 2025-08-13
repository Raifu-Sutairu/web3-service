// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../core/CarbonNFT.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/**
 * @title MaliciousEndorser
 * @dev Contract to test reentrancy protection in CarbonNFT endorsement
 */
contract MaliciousEndorser is IERC721Receiver {
    CarbonNFT public carbonNFT;
    bool public attacking = false;
    
    constructor(address _carbonNFT) {
        carbonNFT = CarbonNFT(_carbonNFT);
    }
    
    function attemptReentrancy(uint256 tokenId) external {
        attacking = true;
        carbonNFT.endorseNFT(tokenId);
    }
    
    // This would be called during the endorsement process if reentrancy was possible
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external override returns (bytes4) {
        if (attacking) {
            // Try to re-enter the endorseNFT function
            carbonNFT.endorseNFT(0);
        }
        return this.onERC721Received.selector;
    }
}