import { ethers, JsonRpcProvider, Wallet, TransactionRequest, TransactionReceipt } from 'ethers';
import ENV from '../../config/env.config';
import { TransactionResult, TransactionConfig, GasEstimation } from './types';

export interface BatchTransaction {
    id: string;
    to: string;
    data: string;
    value?: bigint;
    gasLimit?: number;
}

export interface BatchResult {
    successful: TransactionResult[];
    failed: TransactionResult[];
    totalGasUsed: bigint;
}

export interface ITransactionService {
    // Single transaction management
    sendTransaction(transaction: TransactionRequest): Promise<TransactionResult>;
    estimateGas(transaction: TransactionRequest): Promise<GasEstimation>;
    
    // Batch transaction management
    batchTransactions(transactions: BatchTransaction[]): Promise<BatchResult>;
    
    // Gas optimization
    getOptimalGasPrice(): Promise<bigint>;
    calculateGasCost(gasLimit: number, gasPrice?: bigint): Promise<bigint>;
    
    // Transaction monitoring
    waitForTransaction(hash: string, confirmations?: number): Promise<TransactionReceipt | null>;
    getTransactionStatus(hash: string): Promise<'pending' | 'confirmed' | 'failed' | 'not_found'>;
    
    // Nonce management
    getNonce(address?: string): Promise<number>;
    
    // Retry mechanism
    retryTransaction(originalTx: TransactionRequest, maxRetries?: number): Promise<TransactionResult>;
}

export class TransactionService implements ITransactionService {
    private provider: JsonRpcProvider;
    private wallet: Wallet;
    private pendingTransactions: Map<string, TransactionRequest> = new Map();
    private readonly DEFAULT_GAS_LIMIT = 300000;
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 2000; // 2 seconds

    constructor() {
        this.provider = new JsonRpcProvider(ENV.RPC_URL);
        this.wallet = new Wallet(ENV.PRIVATE_KEY, this.provider);
    }

    async sendTransaction(transaction: TransactionRequest): Promise<TransactionResult> {
        try {
            // Optimize gas settings
            const optimizedTx = await this.optimizeTransaction(transaction);
            
            // Send transaction
            const tx = await this.wallet.sendTransaction(optimizedTx);
            this.pendingTransactions.set(tx.hash, optimizedTx);
            
            // Wait for confirmation
            const receipt = await tx.wait();
            this.pendingTransactions.delete(tx.hash);
            
            return {
                hash: tx.hash,
                receipt,
                success: true,
                gasUsed: receipt?.gasUsed
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

    async estimateGas(transaction: TransactionRequest): Promise<GasEstimation> {
        try {
            const gasLimit = await this.provider.estimateGas(transaction);
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

    async batchTransactions(transactions: BatchTransaction[]): Promise<BatchResult> {
        const successful: TransactionResult[] = [];
        const failed: TransactionResult[] = [];
        let totalGasUsed = BigInt(0);

        // Process transactions sequentially to avoid nonce conflicts
        for (const batchTx of transactions) {
            try {
                const txRequest: TransactionRequest = {
                    to: batchTx.to,
                    data: batchTx.data,
                    value: batchTx.value || BigInt(0),
                    gasLimit: batchTx.gasLimit || this.DEFAULT_GAS_LIMIT
                };

                const result = await this.sendTransaction(txRequest);
                
                if (result.success) {
                    successful.push(result);
                    if (result.gasUsed) {
                        totalGasUsed += result.gasUsed;
                    }
                } else {
                    failed.push(result);
                }
            } catch (error) {
                failed.push({
                    hash: '',
                    receipt: null,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        return {
            successful,
            failed,
            totalGasUsed
        };
    }

    async getOptimalGasPrice(): Promise<bigint> {
        try {
            const feeData = await this.provider.getFeeData();
            
            // Use EIP-1559 if available, otherwise use legacy gas price
            if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
                return feeData.maxFeePerGas;
            } else if (feeData.gasPrice) {
                // Add 10% buffer for faster confirmation
                return feeData.gasPrice + (feeData.gasPrice / BigInt(10));
            } else {
                // Fallback gas price (20 gwei)
                return ethers.parseUnits('20', 'gwei');
            }
        } catch (error) {
            console.warn('Failed to get optimal gas price, using fallback:', error);
            return ethers.parseUnits('20', 'gwei');
        }
    }

    async calculateGasCost(gasLimit: number, gasPrice?: bigint): Promise<bigint> {
        const price = gasPrice || await this.getOptimalGasPrice();
        return BigInt(gasLimit) * price;
    }

    async waitForTransaction(hash: string, confirmations: number = 1): Promise<TransactionReceipt | null> {
        try {
            return await this.provider.waitForTransaction(hash, confirmations);
        } catch (error) {
            console.error(`Failed to wait for transaction ${hash}:`, error);
            return null;
        }
    }

    async getTransactionStatus(hash: string): Promise<'pending' | 'confirmed' | 'failed' | 'not_found'> {
        try {
            const tx = await this.provider.getTransaction(hash);
            if (!tx) {
                return 'not_found';
            }

            const receipt = await this.provider.getTransactionReceipt(hash);
            if (!receipt) {
                return 'pending';
            }

            return receipt.status === 1 ? 'confirmed' : 'failed';
        } catch (error) {
            console.error(`Failed to get transaction status for ${hash}:`, error);
            return 'not_found';
        }
    }

    async getNonce(address?: string): Promise<number> {
        const addr = address || this.wallet.address;
        return await this.provider.getTransactionCount(addr, 'pending');
    }

    async retryTransaction(originalTx: TransactionRequest, maxRetries: number = this.MAX_RETRIES): Promise<TransactionResult> {
        let lastError: string = '';
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Increase gas price for retry attempts
                const retryTx = { ...originalTx };
                if (attempt > 1) {
                    const currentGasPrice = await this.getOptimalGasPrice();
                    retryTx.gasPrice = currentGasPrice + (currentGasPrice * BigInt(attempt * 10) / BigInt(100));
                }

                const result = await this.sendTransaction(retryTx);
                if (result.success) {
                    return result;
                }
                
                lastError = result.error || 'Unknown error';
                
                // Wait before retry
                if (attempt < maxRetries) {
                    await this.delay(this.RETRY_DELAY * attempt);
                }
            } catch (error) {
                lastError = error instanceof Error ? error.message : 'Unknown error';
                
                if (attempt < maxRetries) {
                    await this.delay(this.RETRY_DELAY * attempt);
                }
            }
        }

        return {
            hash: '',
            receipt: null,
            success: false,
            error: `Transaction failed after ${maxRetries} attempts. Last error: ${lastError}`
        };
    }

    private async optimizeTransaction(transaction: TransactionRequest): Promise<TransactionRequest> {
        const optimized = { ...transaction };

        // Set nonce if not provided
        if (!optimized.nonce) {
            optimized.nonce = await this.getNonce();
        }

        // Estimate gas if not provided
        if (!optimized.gasLimit) {
            try {
                const gasEstimate = await this.provider.estimateGas(transaction);
                // Add 20% buffer to gas estimate
                optimized.gasLimit = gasEstimate + (gasEstimate / BigInt(5));
            } catch (error) {
                console.warn('Gas estimation failed, using default:', error);
                optimized.gasLimit = this.DEFAULT_GAS_LIMIT;
            }
        }

        // Set gas price if not provided
        if (!optimized.gasPrice && !optimized.maxFeePerGas) {
            const feeData = await this.provider.getFeeData();
            
            if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
                // Use EIP-1559
                optimized.maxFeePerGas = feeData.maxFeePerGas;
                optimized.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
            } else {
                // Use legacy gas price
                optimized.gasPrice = await this.getOptimalGasPrice();
            }
        }

        return optimized;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Utility methods for monitoring
    getPendingTransactions(): string[] {
        return Array.from(this.pendingTransactions.keys());
    }

    async getPendingTransactionCount(): Promise<number> {
        return this.pendingTransactions.size;
    }

    async getNetworkGasPrice(): Promise<bigint> {
        const feeData = await this.provider.getFeeData();
        return feeData.gasPrice || BigInt(0);
    }

    async isNetworkCongested(): Promise<boolean> {
        try {
            const feeData = await this.provider.getFeeData();
            const gasPrice = feeData.gasPrice || BigInt(0);
            
            // Consider network congested if gas price is above 50 gwei
            const threshold = ethers.parseUnits('50', 'gwei');
            return gasPrice > threshold;
        } catch (error) {
            console.warn('Failed to check network congestion:', error);
            return false;
        }
    }
}