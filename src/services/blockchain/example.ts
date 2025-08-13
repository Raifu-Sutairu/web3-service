/**
 * Example usage of the Blockchain Services Layer
 * This file demonstrates how to use the ContractService, TransactionService, and EventService
 */

import { blockchainServices, ContractName, Grade, UserType } from './index';

async function exampleUsage() {
    try {
        console.log('Initializing blockchain services...');
        await blockchainServices.initialize();

        // Health check
        const health = await blockchainServices.healthCheck();
        console.log('Service health:', health);

        // Example 1: Contract Service Usage
        console.log('\n=== Contract Service Examples ===');
        
        // Register a user
        const registerResult = await blockchainServices.contractService.registerUser(UserType.Individual);
        console.log('User registration result:', registerResult);

        // Mint an NFT
        const mintResult = await blockchainServices.contractService.mintNFT(
            '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A', // to address
            'ipfs://QmExampleHash123', // tokenURI
            'renewable-energy', // theme
            Grade.B, // initial grade
            85 // initial score
        );
        console.log('NFT minting result:', mintResult);

        // Get user NFTs
        const userNFTs = await blockchainServices.contractService.getUserNFTs(
            '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A'
        );
        console.log('User NFTs:', userNFTs);

        // Example 2: Transaction Service Usage
        console.log('\n=== Transaction Service Examples ===');
        
        // Get optimal gas price
        const gasPrice = await blockchainServices.transactionService.getOptimalGasPrice();
        console.log('Optimal gas price:', gasPrice.toString(), 'wei');

        // Check network congestion
        const isCongested = await blockchainServices.transactionService.isNetworkCongested();
        console.log('Network congested:', isCongested);

        // Example batch transaction
        const batchTxs = [
            {
                id: 'endorse1',
                to: '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A',
                data: '0x1234' // encoded function call
            },
            {
                id: 'endorse2',
                to: '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A',
                data: '0x5678' // encoded function call
            }
        ];

        // Note: This would fail in testing without proper contract addresses
        // const batchResult = await blockchainServices.transactionService.batchTransactions(batchTxs);
        // console.log('Batch transaction result:', batchResult);

        // Example 3: Event Service Usage
        console.log('\n=== Event Service Examples ===');
        
        // Subscribe to NFT minting events
        const subscriptionId = blockchainServices.eventService.subscribeToEvents(
            ContractName.CARBON_NFT,
            'NFTMinted',
            (event) => {
                console.log('NFT Minted Event:', {
                    tokenId: event.args[0],
                    owner: event.args[1],
                    grade: event.args[2],
                    theme: event.args[3]
                });
            }
        );
        console.log('Event subscription ID:', subscriptionId);

        // Get historical events (would work with deployed contracts)
        // const historicalEvents = await blockchainServices.eventService.getHistoricalEvents(
        //     ContractName.CARBON_NFT,
        //     'NFTMinted',
        //     12000000, // from block
        //     'latest'  // to block
        // );
        // console.log('Historical events:', historicalEvents);

        // Example 4: Gas Estimation
        console.log('\n=== Gas Estimation Examples ===');
        
        try {
            const gasEstimation = await blockchainServices.contractService.estimateGas(
                ContractName.CARBON_NFT,
                'registerUser',
                [UserType.Individual]
            );
            console.log('Gas estimation for registerUser:', {
                gasLimit: gasEstimation.gasLimit,
                gasPrice: gasEstimation.gasPrice.toString(),
                estimatedCost: gasEstimation.estimatedCost.toString()
            });
        } catch (error) {
            console.log('Gas estimation failed (expected without deployed contracts):', (error as Error).message);
        }

        // Example 5: Community Features (when Community contract is deployed)
        console.log('\n=== Community Service Examples ===');
        
        try {
            // Set NFT visibility
            const visibilityResult = await blockchainServices.contractService.setNFTVisibility(1, true);
            console.log('NFT visibility update:', visibilityResult);

            // Get public NFTs
            const publicNFTs = await blockchainServices.contractService.getPublicNFTs(0, 10);
            console.log('Public NFTs:', publicNFTs);

            // Get leaderboard
            const leaderboard = await blockchainServices.contractService.getLeaderboard(5);
            console.log('Leaderboard:', leaderboard);
        } catch (error) {
            console.log('Community features failed (expected without deployed contracts):', (error as Error).message);
        }

        // Example 6: Marketplace Features (when Marketplace contract is deployed)
        console.log('\n=== Marketplace Service Examples ===');
        
        try {
            // List NFT for sale
            const listResult = await blockchainServices.contractService.listNFT(1, '0.1'); // 0.1 ETH
            console.log('NFT listing result:', listResult);

            // Get suggested price
            const suggestedPrice = await blockchainServices.contractService.getSuggestedPrice(1);
            console.log('Suggested price:', suggestedPrice, 'ETH');

            // Get active listings
            const activeListings = await blockchainServices.contractService.getActiveListings(0, 10);
            console.log('Active listings:', activeListings);
        } catch (error) {
            console.log('Marketplace features failed (expected without deployed contracts):', (error as Error).message);
        }

        console.log('\n=== Service Information ===');
        console.log('Active event subscriptions:', blockchainServices.eventService.getSubscriptionCount());
        console.log('Event monitoring active:', blockchainServices.eventService.isMonitoring());
        console.log('Contract addresses:', blockchainServices.eventService.getContractAddresses());

    } catch (error) {
        console.error('Example execution failed:', error);
    } finally {
        // Cleanup
        console.log('\nCleaning up services...');
        await blockchainServices.cleanup();
        console.log('Example completed.');
    }
}

// Export for use in other files
export { exampleUsage };

// Run example if this file is executed directly
if (require.main === module) {
    exampleUsage().catch(console.error);
}