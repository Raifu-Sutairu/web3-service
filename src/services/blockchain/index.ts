// Export all blockchain services
export { ContractService, IContractService } from './ContractService';
export { TransactionService, ITransactionService, BatchTransaction, BatchResult } from './TransactionService';
export { EventService, IEventService, EventFilter, ProcessedEvent } from './EventService';

// Export types
export * from './types';

// Create a unified blockchain service manager
import { ContractService } from './ContractService';
import { TransactionService } from './TransactionService';
import { EventService } from './EventService';

export class BlockchainServiceManager {
    public readonly contractService: ContractService;
    public readonly transactionService: TransactionService;
    public readonly eventService: EventService;

    constructor() {
        this.contractService = new ContractService();
        this.transactionService = new TransactionService();
        this.eventService = new EventService();
    }

    // Initialize all services
    async initialize(): Promise<void> {
        console.log('Initializing blockchain services...');
        
        try {
            // Start event monitoring
            this.eventService.startEventMonitoring();
            
            console.log('Blockchain services initialized successfully');
        } catch (error) {
            console.error('Failed to initialize blockchain services:', error);
            throw error;
        }
    }

    // Cleanup all services
    async cleanup(): Promise<void> {
        console.log('Cleaning up blockchain services...');
        
        try {
            // Stop event monitoring
            this.eventService.stopEventMonitoring();
            
            // Unsubscribe from all events
            this.eventService.unsubscribeAll();
            
            console.log('Blockchain services cleaned up successfully');
        } catch (error) {
            console.error('Error during blockchain services cleanup:', error);
        }
    }

    // Health check for all services
    async healthCheck(): Promise<{
        contractService: boolean;
        transactionService: boolean;
        eventService: boolean;
        overall: boolean;
    }> {
        const health = {
            contractService: false,
            transactionService: false,
            eventService: false,
            overall: false
        };

        try {
            // Check contract service
            const carbonNFTContract = this.contractService.getContractInstance('CarbonNFT' as any);
            health.contractService = !!carbonNFTContract;
        } catch (error) {
            console.warn('Contract service health check failed:', error);
        }

        try {
            // Check transaction service
            const gasPrice = await this.transactionService.getOptimalGasPrice();
            health.transactionService = gasPrice > 0;
        } catch (error) {
            console.warn('Transaction service health check failed:', error);
        }

        try {
            // Check event service
            const blockNumber = await this.eventService.getLatestBlockNumber();
            health.eventService = blockNumber > 0;
        } catch (error) {
            console.warn('Event service health check failed:', error);
        }

        health.overall = health.contractService && health.transactionService && health.eventService;
        
        return health;
    }
}

// Export singleton instance
export const blockchainServices = new BlockchainServiceManager();