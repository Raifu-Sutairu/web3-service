import { ethers, JsonRpcProvider, Contract, EventLog, Log } from 'ethers';
import ENV from '../../config/env.config';
import { ContractName, EventCallback, EventSubscription } from './types';

export interface EventFilter {
    fromBlock?: number;
    toBlock?: number;
    address?: string;
    topics?: string[];
}

export interface ProcessedEvent {
    contractName: ContractName;
    eventName: string;
    blockNumber: number;
    transactionHash: string;
    args: any[];
    timestamp: number;
}

export interface IEventService {
    // Event subscription management
    subscribeToEvents(contractName: ContractName, eventName: string, callback: EventCallback, filter?: any): string;
    unsubscribe(subscriptionId: string): void;
    unsubscribeAll(): void;
    
    // Historical event queries
    getHistoricalEvents(contractName: ContractName, eventName: string, fromBlock: number, toBlock?: number): Promise<ProcessedEvent[]>;
    getAllHistoricalEvents(contractName: ContractName, fromBlock: number, toBlock?: number): Promise<ProcessedEvent[]>;
    
    // Event processing
    processEvent(event: EventLog): ProcessedEvent;
    
    // Subscription management
    getActiveSubscriptions(): EventSubscription[];
    isSubscribed(contractName: ContractName, eventName: string): boolean;
    
    // Event monitoring
    startEventMonitoring(): void;
    stopEventMonitoring(): void;
    isMonitoring(): boolean;
}

export class EventService implements IEventService {
    private provider: JsonRpcProvider;
    private contracts: Map<ContractName, Contract> = new Map();
    private subscriptions: Map<string, EventSubscription> = new Map();
    private isMonitoringActive: boolean = false;
    private monitoringInterval: NodeJS.Timeout | null = null;
    private lastProcessedBlock: number = 0;

    // Contract ABIs for event parsing
    private readonly CONTRACT_ABIS = {
        [ContractName.CARBON_NFT]: [
            "event NFTMinted(uint256 indexed tokenId, address indexed owner, uint8 initialGrade, string theme)",
            "event GradeUpdated(uint256 indexed tokenId, uint8 oldGrade, uint8 newGrade, uint256 newScore)",
            "event NFTEndorsed(uint256 indexed tokenId, address indexed endorser, uint256 newEndorsementCount)",
            "event UserRegistered(address indexed user, uint8 userType)"
        ],
        [ContractName.COMMUNITY]: [
            "event NFTVisibilityChanged(uint256 indexed tokenId, address indexed owner, bool isPublic)",
            "event CommunityStatsUpdated(uint256 totalUsers, uint256 totalNFTs, uint256 totalCarbonSaved)"
        ],
        [ContractName.MARKETPLACE]: [
            "event NFTListed(uint256 indexed listingId, uint256 indexed tokenId, address indexed seller, uint256 price)",
            "event NFTSold(uint256 indexed listingId, uint256 indexed tokenId, address indexed seller, address buyer, uint256 price, uint256 marketplaceFee, uint256 royalty)",
            "event ListingCancelled(uint256 indexed listingId, uint256 indexed tokenId, address indexed seller)",
            "event PriceUpdated(uint256 indexed listingId, uint256 indexed tokenId, uint256 oldPrice, uint256 newPrice)"
        ],
        [ContractName.GOVERNANCE]: [
            "event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description, uint8 proposalType, uint256 endTime)",
            "event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 votingPower)",
            "event ProposalExecuted(uint256 indexed proposalId, bool success)",
            "event ProposalStatusChanged(uint256 indexed proposalId, uint8 newStatus)"
        ]
    };

    constructor() {
        this.provider = new JsonRpcProvider(ENV.RPC_URL);
        this.initializeContracts();
        this.initializeLastProcessedBlock();
    }

    private async initializeContracts(): Promise<void> {
        // Initialize contract instances for event listening
        if (ENV.CARBON_NFT_ADDRESS) {
            this.contracts.set(
                ContractName.CARBON_NFT,
                new Contract(ENV.CARBON_NFT_ADDRESS, this.CONTRACT_ABIS[ContractName.CARBON_NFT], this.provider)
            );
        }

        if (ENV.COMMUNITY_ADDRESS) {
            this.contracts.set(
                ContractName.COMMUNITY,
                new Contract(ENV.COMMUNITY_ADDRESS, this.CONTRACT_ABIS[ContractName.COMMUNITY], this.provider)
            );
        }

        if (ENV.MARKETPLACE_ADDRESS) {
            this.contracts.set(
                ContractName.MARKETPLACE,
                new Contract(ENV.MARKETPLACE_ADDRESS, this.CONTRACT_ABIS[ContractName.MARKETPLACE], this.provider)
            );
        }
    }

    private async initializeLastProcessedBlock(): Promise<void> {
        try {
            this.lastProcessedBlock = await this.provider.getBlockNumber();
        } catch (error) {
            console.warn('Failed to get current block number, starting from 0:', error);
            this.lastProcessedBlock = 0;
        }
    }

    subscribeToEvents(
        contractName: ContractName,
        eventName: string,
        callback: EventCallback,
        filter?: any
    ): string {
        const subscriptionId = `${contractName}_${eventName}_${Date.now()}`;
        
        const subscription: EventSubscription = {
            contractName,
            eventName,
            callback,
            filter
        };

        this.subscriptions.set(subscriptionId, subscription);

        // Set up the actual event listener
        this.setupEventListener(subscription, subscriptionId);

        return subscriptionId;
    }

    private setupEventListener(subscription: EventSubscription, subscriptionId: string): void {
        const contract = this.contracts.get(subscription.contractName);
        if (!contract) {
            console.error(`Contract ${subscription.contractName} not found for event subscription`);
            return;
        }

        try {
            const eventFilter = contract.filters[subscription.eventName](...(subscription.filter || []));
            
            contract.on(eventFilter, (...args) => {
                const event = args[args.length - 1] as EventLog;
                try {
                    subscription.callback(event);
                } catch (error) {
                    console.error(`Error in event callback for ${subscriptionId}:`, error);
                }
            });

            console.log(`Event listener set up for ${subscription.contractName}.${subscription.eventName}`);
        } catch (error) {
            console.error(`Failed to set up event listener for ${subscriptionId}:`, error);
        }
    }

    unsubscribe(subscriptionId: string): void {
        const subscription = this.subscriptions.get(subscriptionId);
        if (!subscription) {
            console.warn(`Subscription ${subscriptionId} not found`);
            return;
        }

        const contract = this.contracts.get(subscription.contractName);
        if (contract) {
            try {
                contract.removeAllListeners(subscription.eventName);
                console.log(`Unsubscribed from ${subscription.contractName}.${subscription.eventName}`);
            } catch (error) {
                console.error(`Failed to unsubscribe from ${subscriptionId}:`, error);
            }
        }

        this.subscriptions.delete(subscriptionId);
    }

    unsubscribeAll(): void {
        for (const subscriptionId of this.subscriptions.keys()) {
            this.unsubscribe(subscriptionId);
        }
    }

    async getHistoricalEvents(
        contractName: ContractName,
        eventName: string,
        fromBlock: number,
        toBlock?: number
    ): Promise<ProcessedEvent[]> {
        const contract = this.contracts.get(contractName);
        if (!contract) {
            throw new Error(`Contract ${contractName} not found`);
        }

        try {
            const filter = contract.filters[eventName]();
            const events = await contract.queryFilter(filter, fromBlock, toBlock);
            
            return events.map(event => this.processEvent(event as EventLog));
        } catch (error) {
            console.error(`Failed to get historical events for ${contractName}.${eventName}:`, error);
            return [];
        }
    }

    async getAllHistoricalEvents(
        contractName: ContractName,
        fromBlock: number,
        toBlock?: number
    ): Promise<ProcessedEvent[]> {
        const contract = this.contracts.get(contractName);
        if (!contract) {
            throw new Error(`Contract ${contractName} not found`);
        }

        try {
            const events = await contract.queryFilter('*', fromBlock, toBlock);
            return events.map(event => this.processEvent(event as EventLog));
        } catch (error) {
            console.error(`Failed to get all historical events for ${contractName}:`, error);
            return [];
        }
    }

    processEvent(event: EventLog): ProcessedEvent {
        // Find the contract name for this event
        let contractName: ContractName = ContractName.CARBON_NFT;
        for (const [name, contract] of this.contracts.entries()) {
            if (contract.target === event.address) {
                contractName = name;
                break;
            }
        }

        return {
            contractName,
            eventName: event.eventName || 'Unknown',
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            args: event.args ? Array.from(event.args) : [],
            timestamp: Date.now() // In production, you'd get this from the block
        };
    }

    getActiveSubscriptions(): EventSubscription[] {
        return Array.from(this.subscriptions.values());
    }

    isSubscribed(contractName: ContractName, eventName: string): boolean {
        for (const subscription of this.subscriptions.values()) {
            if (subscription.contractName === contractName && subscription.eventName === eventName) {
                return true;
            }
        }
        return false;
    }

    startEventMonitoring(): void {
        if (this.isMonitoringActive) {
            console.warn('Event monitoring is already active');
            return;
        }

        this.isMonitoringActive = true;
        console.log('Starting event monitoring...');

        // Monitor for new blocks and process events
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.processNewBlocks();
            } catch (error) {
                console.error('Error in event monitoring:', error);
            }
        }, 5000); // Check every 5 seconds
    }

    stopEventMonitoring(): void {
        if (!this.isMonitoringActive) {
            console.warn('Event monitoring is not active');
            return;
        }

        this.isMonitoringActive = false;
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }

        console.log('Event monitoring stopped');
    }

    isMonitoring(): boolean {
        return this.isMonitoringActive;
    }

    private async processNewBlocks(): Promise<void> {
        try {
            const currentBlock = await this.provider.getBlockNumber();
            
            if (currentBlock > this.lastProcessedBlock) {
                // Process events from new blocks
                for (const [contractName, contract] of this.contracts.entries()) {
                    try {
                        const events = await contract.queryFilter('*', this.lastProcessedBlock + 1, currentBlock);
                        
                        for (const event of events) {
                            const processedEvent = this.processEvent(event as EventLog);
                            this.notifySubscribers(processedEvent);
                        }
                    } catch (error) {
                        console.error(`Failed to process events for ${contractName}:`, error);
                    }
                }
                
                this.lastProcessedBlock = currentBlock;
            }
        } catch (error) {
            console.error('Failed to process new blocks:', error);
        }
    }

    private notifySubscribers(event: ProcessedEvent): void {
        for (const subscription of this.subscriptions.values()) {
            if (subscription.contractName === event.contractName && 
                subscription.eventName === event.eventName) {
                try {
                    // Create a mock EventLog for the callback
                    const mockEventLog: EventLog = {
                        address: '',
                        blockNumber: event.blockNumber,
                        transactionHash: event.transactionHash,
                        args: event.args,
                        eventName: event.eventName,
                        eventSignature: '',
                        fragment: null as any,
                        interface: null as any,
                        log: null as any,
                        topics: [],
                        data: ''
                    };
                    
                    subscription.callback(mockEventLog);
                } catch (error) {
                    console.error(`Error notifying subscriber for ${event.contractName}.${event.eventName}:`, error);
                }
            }
        }
    }

    // Utility methods
    async getLatestBlockNumber(): Promise<number> {
        return await this.provider.getBlockNumber();
    }

    async getBlockTimestamp(blockNumber: number): Promise<number> {
        try {
            const block = await this.provider.getBlock(blockNumber);
            return block ? block.timestamp : 0;
        } catch (error) {
            console.error(`Failed to get block timestamp for block ${blockNumber}:`, error);
            return 0;
        }
    }

    getSubscriptionCount(): number {
        return this.subscriptions.size;
    }

    getContractAddresses(): Record<ContractName, string> {
        const addresses: Record<string, string> = {};
        
        for (const [name, contract] of this.contracts.entries()) {
            addresses[name] = contract.target as string;
        }
        
        return addresses as Record<ContractName, string>;
    }

    // Event filtering utilities
    createEventFilter(contractName: ContractName, eventName: string, ...args: any[]): any {
        const contract = this.contracts.get(contractName);
        if (!contract) {
            throw new Error(`Contract ${contractName} not found`);
        }

        return contract.filters[eventName](...args);
    }

    async getEventCount(
        contractName: ContractName,
        eventName: string,
        fromBlock: number,
        toBlock?: number
    ): Promise<number> {
        const events = await this.getHistoricalEvents(contractName, eventName, fromBlock, toBlock);
        return events.length;
    }
}