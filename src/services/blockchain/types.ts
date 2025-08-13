import { Contract, TransactionReceipt, TransactionRequest, EventLog } from 'ethers';

// Grade enum matching the contract
export enum Grade {
    F = 0,
    D = 1,
    C = 2,
    B = 3,
    A = 4
}

// User type enum matching the contract
export enum UserType {
    Individual = 0,
    Company = 1
}

// Transaction result interface
export interface TransactionResult {
    hash: string;
    receipt: TransactionReceipt | null;
    success: boolean;
    gasUsed?: bigint;
    error?: string;
}

// NFT metadata interface
export interface NFTMetadata {
    name: string;
    description: string;
    image: string;
    attributes: {
        grade: Grade;
        carbonScore: number;
        theme: string;
        generatedAt: number;
        lastUpdated: number;
    };
    external_url?: string;
}

// NFT data from contract
export interface NFTData {
    currentGrade: Grade;
    carbonScore: bigint;
    endorsements: bigint;
    mintedAt: bigint;
    lastUpdated: bigint;
    theme: string;
    isActive: boolean;
}

// Transaction configuration
export interface TransactionConfig {
    gasLimit?: number;
    gasPrice?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
    value?: bigint;
}

// Event callback type
export type EventCallback = (event: EventLog) => void;

// Contract names enum
export enum ContractName {
    CARBON_NFT = 'CarbonNFT',
    COMMUNITY = 'Community',
    MARKETPLACE = 'Marketplace',
    GOVERNANCE = 'Governance'
}

// Event subscription interface
export interface EventSubscription {
    contractName: ContractName;
    eventName: string;
    callback: EventCallback;
    filter?: any;
}

// Gas estimation result
export interface GasEstimation {
    gasLimit: number;
    gasPrice: bigint;
    estimatedCost: bigint;
}