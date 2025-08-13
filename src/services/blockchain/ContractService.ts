import { ethers, Contract, JsonRpcProvider, Wallet } from 'ethers';
import ENV from '../../config/env.config';
import {
    ContractName,
    TransactionResult,
    NFTMetadata,
    Grade,
    UserType,
    TransactionConfig,
    NFTData,
    GasEstimation
} from './types';
import { ErrorHandler } from '../errors/ErrorHandler';
import { 
    Web3ServiceError, 
    ErrorCode, 
    ErrorSeverity,
    createContractError,
    createNetworkError 
} from '../errors/ErrorTypes';

// Contract ABIs (simplified - in production these would be imported from compiled artifacts)
const CARBON_NFT_ABI = [
    "function registerUser(uint8 _userType) external",
    "function mintCarbonNFT(address to, string memory tokenURI, string memory theme, uint8 initialGrade, uint256 initialScore) external returns (uint256)",
    "function updateGrade(uint256 tokenId, uint8 newGrade, uint256 newScore, string memory newTokenURI) external",
    "function endorseNFT(uint256 tokenId) external",
    "function getUserNFTs(address user) external view returns (uint256[])",
    "function getNFTData(uint256 tokenId) external view returns (tuple(uint8 currentGrade, uint256 carbonScore, uint256 endorsements, uint256 mintedAt, uint256 lastUpdated, string theme, bool isActive))",
    "function ownerOf(uint256 tokenId) external view returns (address)",
    "function balanceOf(address owner) external view returns (uint256)",
    "function totalSupply() external view returns (uint256)",
    "function canUserUpload(address user) external view returns (bool)",
    "function getRemainingWeeklyUploads(address user) external view returns (uint256)"
];

const COMMUNITY_ABI = [
    "function setNFTVisibility(uint256 tokenId, bool isPublic) external",
    "function getPublicNFTs(uint256 offset, uint256 limit) external view returns (tuple(uint256 tokenId, address owner, uint8 grade, uint256 carbonScore, uint256 endorsements, string theme, bool isPublic)[])",
    "function getLeaderboard(uint256 limit) external view returns (tuple(address user, uint256 totalScore, uint256 nftCount, uint8 averageGrade)[])",
    "function getCommunityStats() external view returns (tuple(uint256 totalUsers, uint256 totalNFTs, uint256 totalCarbonSaved, uint256 averageGrade))"
];

const MARKETPLACE_ABI = [
    "function listNFT(uint256 tokenId, uint256 price) external",
    "function buyNFT(uint256 listingId) external payable",
    "function cancelListing(uint256 listingId) external",
    "function getActiveListings(uint256 offset, uint256 limit) external view returns (tuple(uint256 listingId, uint256 tokenId, address seller, uint256 price, uint256 listedAt, bool isActive)[])",
    "function getSuggestedPrice(uint256 tokenId) external view returns (uint256)"
];

const GOVERNANCE_ABI = [
    "function createProposal(string memory description, uint8 proposalType, bytes memory data) external returns (uint256)",
    "function vote(uint256 proposalId, bool support) external",
    "function executeProposal(uint256 proposalId) external",
    "function getProposal(uint256 proposalId) external view returns (tuple(uint256 id, address proposer, string description, uint256 votesFor, uint256 votesAgainst, uint256 startTime, uint256 endTime, bool executed, uint8 proposalType, bytes data, uint8 status))"
];

export interface IContractService {
    // Contract management
    getContractInstance(contractName: ContractName): Contract;
    
    // CarbonNFT functions
    registerUser(userType: UserType, config?: TransactionConfig): Promise<TransactionResult>;
    mintNFT(to: string, tokenURI: string, theme: string, grade: Grade, score: number, config?: TransactionConfig): Promise<TransactionResult>;
    updateGrade(tokenId: number, newGrade: Grade, newScore: number, newTokenURI: string, config?: TransactionConfig): Promise<TransactionResult>;
    endorseNFT(tokenId: number, config?: TransactionConfig): Promise<TransactionResult>;
    
    // View functions
    getUserNFTs(userAddress: string): Promise<number[]>;
    getNFTData(tokenId: number): Promise<NFTData>;
    canUserUpload(userAddress: string): Promise<boolean>;
    getRemainingWeeklyUploads(userAddress: string): Promise<number>;
    
    // Community functions
    setNFTVisibility(tokenId: number, isPublic: boolean, config?: TransactionConfig): Promise<TransactionResult>;
    getPublicNFTs(offset: number, limit: number): Promise<any[]>;
    getLeaderboard(limit: number): Promise<any[]>;
    getCommunityStats(): Promise<any>;
    
    // Marketplace functions
    listNFT(tokenId: number, price: string, config?: TransactionConfig): Promise<TransactionResult>;
    buyNFT(listingId: number, config?: TransactionConfig): Promise<TransactionResult>;
    cancelListing(listingId: number, config?: TransactionConfig): Promise<TransactionResult>;
    getActiveListings(offset: number, limit: number): Promise<any[]>;
    getSuggestedPrice(tokenId: number): Promise<string>;
    
    // Governance functions
    createProposal(description: string, proposalType: number, data: string, config?: TransactionConfig): Promise<TransactionResult>;
    vote(proposalId: number, support: boolean, config?: TransactionConfig): Promise<TransactionResult>;
    executeProposal(proposalId: number, config?: TransactionConfig): Promise<TransactionResult>;
    getProposal(proposalId: number): Promise<any>;
    
    // Gas optimization
    estimateGas(contractName: ContractName, functionName: string, args: any[]): Promise<GasEstimation>;
}

export class ContractService implements IContractService {
    private provider: JsonRpcProvider;
    private wallet: Wallet;
    private contracts: Map<ContractName, Contract> = new Map();
    private errorHandler: ErrorHandler;

    constructor() {
        this.errorHandler = new ErrorHandler();
        this.initializeProvider();
        this.initializeContracts();
    }

    private initializeProvider(): void {
        try {
            this.provider = new JsonRpcProvider(ENV.RPC_URL);
            this.wallet = new Wallet(ENV.PRIVATE_KEY, this.provider);
        } catch (error) {
            throw createNetworkError('provider-initialization', error as Error);
        }
    }

    private initializeContracts(): void {
        // Initialize contract instances
        if (ENV.CARBON_NFT_ADDRESS) {
            this.contracts.set(
                ContractName.CARBON_NFT,
                new Contract(ENV.CARBON_NFT_ADDRESS, CARBON_NFT_ABI, this.wallet)
            );
        }

        if (ENV.COMMUNITY_ADDRESS) {
            this.contracts.set(
                ContractName.COMMUNITY,
                new Contract(ENV.COMMUNITY_ADDRESS, COMMUNITY_ABI, this.wallet)
            );
        }

        if (ENV.MARKETPLACE_ADDRESS) {
            this.contracts.set(
                ContractName.MARKETPLACE,
                new Contract(ENV.MARKETPLACE_ADDRESS, MARKETPLACE_ABI, this.wallet)
            );
        }

        // Note: Governance address would be added to ENV config after deployment
    }

    getContractInstance(contractName: ContractName): Contract {
        const contract = this.contracts.get(contractName);
        if (!contract) {
            throw new Web3ServiceError(
                ErrorCode.CONTRACT_NOT_FOUND,
                `Contract ${contractName} not initialized or address not configured`,
                { 
                    operation: 'get-contract-instance',
                    contractName,
                    timestamp: Date.now()
                },
                { severity: ErrorSeverity.HIGH }
            );
        }
        return contract;
    }

    // CarbonNFT functions
    async registerUser(userType: UserType, config?: TransactionConfig): Promise<TransactionResult> {
        return this.errorHandler.executeWithRetry(
            async () => {
                // Validate inputs
                if (userType !== UserType.Individual && userType !== UserType.Company) {
                    throw new Web3ServiceError(
                        ErrorCode.INVALID_PARAMETERS,
                        `Invalid user type: ${userType}`,
                        { operation: 'register-user', parameters: { userType }, timestamp: Date.now() }
                    );
                }

                const contract = this.getContractInstance(ContractName.CARBON_NFT);
                
                // Estimate gas first
                const gasEstimate = await contract.registerUser.estimateGas(userType);
                const txConfig = this.buildTxConfig(config, gasEstimate);
                
                const tx = await contract.registerUser(userType, txConfig);
                const receipt = await tx.wait();
                
                return {
                    hash: tx.hash,
                    receipt,
                    success: true,
                    gasUsed: receipt.gasUsed
                };
            },
            {
                operation: 'register-user',
                contractName: ContractName.CARBON_NFT,
                functionName: 'registerUser',
                parameters: { userType },
                timestamp: Date.now()
            }
        ).catch(error => ({
            hash: '',
            receipt: null,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }));
    }

    async mintNFT(
        to: string,
        tokenURI: string,
        theme: string,
        grade: Grade,
        score: number,
        config?: TransactionConfig
    ): Promise<TransactionResult> {
        return this.errorHandler.executeWithRetry(
            async () => {
                // Validate inputs
                this.errorHandler.validateAddress(to, 'recipient address');
                this.errorHandler.validateGrade(grade);
                this.errorHandler.validateScore(score);
                
                if (!tokenURI || tokenURI.trim().length === 0) {
                    throw new Web3ServiceError(
                        ErrorCode.INVALID_PARAMETERS,
                        'Token URI cannot be empty',
                        { operation: 'mint-nft', parameters: { tokenURI }, timestamp: Date.now() }
                    );
                }
                
                if (!theme || theme.trim().length === 0) {
                    throw new Web3ServiceError(
                        ErrorCode.INVALID_PARAMETERS,
                        'Theme cannot be empty',
                        { operation: 'mint-nft', parameters: { theme }, timestamp: Date.now() }
                    );
                }

                const contract = this.getContractInstance(ContractName.CARBON_NFT);
                
                // Estimate gas first
                const gasEstimate = await contract.mintCarbonNFT.estimateGas(to, tokenURI, theme, grade, score);
                const txConfig = this.buildTxConfig(config, gasEstimate);
                
                const tx = await contract.mintCarbonNFT(to, tokenURI, theme, grade, score, txConfig);
                const receipt = await tx.wait();
                
                return {
                    hash: tx.hash,
                    receipt,
                    success: true,
                    gasUsed: receipt.gasUsed
                };
            },
            {
                operation: 'mint-nft',
                contractName: ContractName.CARBON_NFT,
                functionName: 'mintCarbonNFT',
                parameters: { to, tokenURI, theme, grade, score },
                timestamp: Date.now()
            }
        ).catch(error => ({
            hash: '',
            receipt: null,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }));
    }

    async updateGrade(
        tokenId: number,
        newGrade: Grade,
        newScore: number,
        newTokenURI: string,
        config?: TransactionConfig
    ): Promise<TransactionResult> {
        try {
            const contract = this.getContractInstance(ContractName.CARBON_NFT);
            const tx = await contract.updateGrade(
                tokenId,
                newGrade,
                newScore,
                newTokenURI,
                this.buildTxConfig(config)
            );
            const receipt = await tx.wait();
            
            return {
                hash: tx.hash,
                receipt,
                success: true,
                gasUsed: receipt.gasUsed
            };
        } catch (error) {
            return {
                hash: '',
                receipt: null,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    async endorseNFT(tokenId: number, config?: TransactionConfig): Promise<TransactionResult> {
        try {
            const contract = this.getContractInstance(ContractName.CARBON_NFT);
            const tx = await contract.endorseNFT(tokenId, this.buildTxConfig(config));
            const receipt = await tx.wait();
            
            return {
                hash: tx.hash,
                receipt,
                success: true,
                gasUsed: receipt.gasUsed
            };
        } catch (error) {
            return {
                hash: '',
                receipt: null,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    // View functions
    async getUserNFTs(userAddress: string): Promise<number[]> {
        return this.errorHandler.executeWithRetry(
            async () => {
                this.errorHandler.validateAddress(userAddress, 'user address');
                
                const contract = this.getContractInstance(ContractName.CARBON_NFT);
                const tokenIds = await contract.getUserNFTs(userAddress);
                return tokenIds.map((id: bigint) => Number(id));
            },
            {
                operation: 'get-user-nfts',
                contractName: ContractName.CARBON_NFT,
                functionName: 'getUserNFTs',
                parameters: { userAddress },
                timestamp: Date.now()
            }
        );
    }

    async getNFTData(tokenId: number): Promise<NFTData> {
        return this.errorHandler.executeWithRetry(
            async () => {
                this.errorHandler.validateTokenId(tokenId);
                
                const contract = this.getContractInstance(ContractName.CARBON_NFT);
                const data = await contract.getNFTData(tokenId);
                
                return {
                    currentGrade: data.currentGrade,
                    carbonScore: data.carbonScore,
                    endorsements: data.endorsements,
                    mintedAt: data.mintedAt,
                    lastUpdated: data.lastUpdated,
                    theme: data.theme,
                    isActive: data.isActive
                };
            },
            {
                operation: 'get-nft-data',
                contractName: ContractName.CARBON_NFT,
                functionName: 'getNFTData',
                parameters: { tokenId },
                timestamp: Date.now()
            }
        );
    }

    async canUserUpload(userAddress: string): Promise<boolean> {
        const contract = this.getContractInstance(ContractName.CARBON_NFT);
        return await contract.canUserUpload(userAddress);
    }

    async getRemainingWeeklyUploads(userAddress: string): Promise<number> {
        const contract = this.getContractInstance(ContractName.CARBON_NFT);
        const remaining = await contract.getRemainingWeeklyUploads(userAddress);
        return Number(remaining);
    }

    // Community functions
    async setNFTVisibility(tokenId: number, isPublic: boolean, config?: TransactionConfig): Promise<TransactionResult> {
        try {
            const contract = this.getContractInstance(ContractName.COMMUNITY);
            const tx = await contract.setNFTVisibility(tokenId, isPublic, this.buildTxConfig(config));
            const receipt = await tx.wait();
            
            return {
                hash: tx.hash,
                receipt,
                success: true,
                gasUsed: receipt.gasUsed
            };
        } catch (error) {
            return {
                hash: '',
                receipt: null,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    async getPublicNFTs(offset: number, limit: number): Promise<any[]> {
        const contract = this.getContractInstance(ContractName.COMMUNITY);
        return await contract.getPublicNFTs(offset, limit);
    }

    async getLeaderboard(limit: number): Promise<any[]> {
        const contract = this.getContractInstance(ContractName.COMMUNITY);
        return await contract.getLeaderboard(limit);
    }

    async getCommunityStats(): Promise<any> {
        const contract = this.getContractInstance(ContractName.COMMUNITY);
        return await contract.getCommunityStats();
    }

    // Marketplace functions
    async listNFT(tokenId: number, price: string, config?: TransactionConfig): Promise<TransactionResult> {
        try {
            const contract = this.getContractInstance(ContractName.MARKETPLACE);
            const tx = await contract.listNFT(tokenId, ethers.parseEther(price), this.buildTxConfig(config));
            const receipt = await tx.wait();
            
            return {
                hash: tx.hash,
                receipt,
                success: true,
                gasUsed: receipt.gasUsed
            };
        } catch (error) {
            return {
                hash: '',
                receipt: null,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    async buyNFT(listingId: number, config?: TransactionConfig): Promise<TransactionResult> {
        try {
            const contract = this.getContractInstance(ContractName.MARKETPLACE);
            const tx = await contract.buyNFT(listingId, this.buildTxConfig(config));
            const receipt = await tx.wait();
            
            return {
                hash: tx.hash,
                receipt,
                success: true,
                gasUsed: receipt.gasUsed
            };
        } catch (error) {
            return {
                hash: '',
                receipt: null,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    async cancelListing(listingId: number, config?: TransactionConfig): Promise<TransactionResult> {
        try {
            const contract = this.getContractInstance(ContractName.MARKETPLACE);
            const tx = await contract.cancelListing(listingId, this.buildTxConfig(config));
            const receipt = await tx.wait();
            
            return {
                hash: tx.hash,
                receipt,
                success: true,
                gasUsed: receipt.gasUsed
            };
        } catch (error) {
            return {
                hash: '',
                receipt: null,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    async getActiveListings(offset: number, limit: number): Promise<any[]> {
        const contract = this.getContractInstance(ContractName.MARKETPLACE);
        return await contract.getActiveListings(offset, limit);
    }

    async getSuggestedPrice(tokenId: number): Promise<string> {
        const contract = this.getContractInstance(ContractName.MARKETPLACE);
        const price = await contract.getSuggestedPrice(tokenId);
        return ethers.formatEther(price);
    }

    // Governance functions
    async createProposal(
        description: string,
        proposalType: number,
        data: string,
        config?: TransactionConfig
    ): Promise<TransactionResult> {
        try {
            const contract = this.getContractInstance(ContractName.GOVERNANCE);
            const tx = await contract.createProposal(
                description,
                proposalType,
                data,
                this.buildTxConfig(config)
            );
            const receipt = await tx.wait();
            
            return {
                hash: tx.hash,
                receipt,
                success: true,
                gasUsed: receipt.gasUsed
            };
        } catch (error) {
            return {
                hash: '',
                receipt: null,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    async vote(proposalId: number, support: boolean, config?: TransactionConfig): Promise<TransactionResult> {
        try {
            const contract = this.getContractInstance(ContractName.GOVERNANCE);
            const tx = await contract.vote(proposalId, support, this.buildTxConfig(config));
            const receipt = await tx.wait();
            
            return {
                hash: tx.hash,
                receipt,
                success: true,
                gasUsed: receipt.gasUsed
            };
        } catch (error) {
            return {
                hash: '',
                receipt: null,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    async executeProposal(proposalId: number, config?: TransactionConfig): Promise<TransactionResult> {
        try {
            const contract = this.getContractInstance(ContractName.GOVERNANCE);
            const tx = await contract.executeProposal(proposalId, this.buildTxConfig(config));
            const receipt = await tx.wait();
            
            return {
                hash: tx.hash,
                receipt,
                success: true,
                gasUsed: receipt.gasUsed
            };
        } catch (error) {
            return {
                hash: '',
                receipt: null,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    async getProposal(proposalId: number): Promise<any> {
        const contract = this.getContractInstance(ContractName.GOVERNANCE);
        return await contract.getProposal(proposalId);
    }

    // Gas optimization
    async estimateGas(contractName: ContractName, functionName: string, args: any[]): Promise<GasEstimation> {
        try {
            const contract = this.getContractInstance(contractName);
            const gasLimit = await contract[functionName].estimateGas(...args);
            const feeData = await this.provider.getFeeData();
            
            return {
                gasLimit: Number(gasLimit),
                gasPrice: feeData.gasPrice || BigInt(0),
                estimatedCost: gasLimit * (feeData.gasPrice || BigInt(0))
            };
        } catch (error) {
            throw new Error(`Gas estimation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private buildTxConfig(config?: TransactionConfig, gasEstimate?: bigint): any {
        const txConfig: any = {};
        
        // Use provided config or defaults
        if (config?.gasLimit) {
            txConfig.gasLimit = config.gasLimit;
        } else if (gasEstimate) {
            // Add 20% buffer to gas estimate
            txConfig.gasLimit = gasEstimate + (gasEstimate / BigInt(5));
        }
        
        if (config?.gasPrice) txConfig.gasPrice = config.gasPrice;
        if (config?.maxFeePerGas) txConfig.maxFeePerGas = config.maxFeePerGas;
        if (config?.maxPriorityFeePerGas) txConfig.maxPriorityFeePerGas = config.maxPriorityFeePerGas;
        if (config?.value) txConfig.value = config.value;
        
        return txConfig;
    }
}