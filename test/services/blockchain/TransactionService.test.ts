import { expect } from "chai";
import { ethers } from "hardhat";
import { TransactionService, BatchTransaction } from "../../../src/services/blockchain/TransactionService";

describe("TransactionService", function () {
    let transactionService: TransactionService;
    let mockProvider: any;
    let mockWallet: any;

    beforeEach(function () {
        // Mock provider
        mockProvider = {
            getFeeData: async () => ({
                gasPrice: ethers.parseUnits("20", "gwei"),
                maxFeePerGas: ethers.parseUnits("30", "gwei"),
                maxPriorityFeePerGas: ethers.parseUnits("2", "gwei")
            }),
            estimateGas: async () => BigInt(200000),
            getTransactionCount: async () => 5,
            getTransaction: async (hash: string) => ({
                hash,
                from: "0x1234567890123456789012345678901234567890",
                to: "0x0987654321098765432109876543210987654321"
            }),
            getTransactionReceipt: async (hash: string) => ({
                transactionHash: hash,
                status: 1,
                gasUsed: BigInt(150000)
            }),
            waitForTransaction: async (hash: string, confirmations: number = 1) => ({
                transactionHash: hash,
                status: 1,
                gasUsed: BigInt(150000)
            }),
            getBlockNumber: async () => 12345
        };

        // Mock wallet
        mockWallet = {
            address: "0x1234567890123456789012345678901234567890",
            sendTransaction: async (tx: any) => ({
                hash: "0xabcdef1234567890",
                wait: async () => ({
                    gasUsed: BigInt(150000),
                    status: 1,
                    transactionHash: "0xabcdef1234567890"
                })
            })
        };

        // Create service instance
        transactionService = new TransactionService();
        
        // Override private properties for testing
        (transactionService as any).provider = mockProvider;
        (transactionService as any).wallet = mockWallet;
    });

    describe("Single Transaction Management", function () {
        it("should send transaction successfully", async function () {
            const txRequest = {
                to: "0x0987654321098765432109876543210987654321",
                data: "0x1234",
                value: ethers.parseEther("0.1")
            };

            const result = await transactionService.sendTransaction(txRequest);
            
            expect(result.success).to.be.true;
            expect(result.hash).to.equal("0xabcdef1234567890");
            expect(result.gasUsed).to.equal(BigInt(150000));
        });

        it("should handle transaction failure", async function () {
            mockWallet.sendTransaction = async () => {
                throw new Error("Transaction failed");
            };

            const txRequest = {
                to: "0x0987654321098765432109876543210987654321",
                data: "0x1234"
            };

            const result = await transactionService.sendTransaction(txRequest);
            
            expect(result.success).to.be.false;
            expect(result.error).to.equal("Transaction failed");
        });

        it("should estimate gas correctly", async function () {
            const txRequest = {
                to: "0x0987654321098765432109876543210987654321",
                data: "0x1234"
            };

            const estimation = await transactionService.estimateGas(txRequest);
            
            expect(estimation.gasLimit).to.equal(200000);
            expect(estimation.gasPrice).to.equal(ethers.parseUnits("20", "gwei"));
            expect(estimation.estimatedCost).to.be.greaterThan(0);
        });
    });

    describe("Batch Transaction Management", function () {
        it("should process batch transactions successfully", async function () {
            const batchTxs: BatchTransaction[] = [
                {
                    id: "tx1",
                    to: "0x0987654321098765432109876543210987654321",
                    data: "0x1234"
                },
                {
                    id: "tx2",
                    to: "0x0987654321098765432109876543210987654321",
                    data: "0x5678"
                }
            ];

            const result = await transactionService.batchTransactions(batchTxs);
            
            expect(result.successful).to.have.length(2);
            expect(result.failed).to.have.length(0);
            expect(result.totalGasUsed).to.equal(BigInt(300000)); // 150000 * 2
        });

        it("should handle partial batch failure", async function () {
            let callCount = 0;
            mockWallet.sendTransaction = async (tx: any) => {
                callCount++;
                if (callCount === 2) {
                    throw new Error("Second transaction failed");
                }
                return {
                    hash: `0xhash${callCount}`,
                    wait: async () => ({
                        gasUsed: BigInt(150000),
                        status: 1
                    })
                };
            };

            const batchTxs: BatchTransaction[] = [
                {
                    id: "tx1",
                    to: "0x0987654321098765432109876543210987654321",
                    data: "0x1234"
                },
                {
                    id: "tx2",
                    to: "0x0987654321098765432109876543210987654321",
                    data: "0x5678"
                }
            ];

            const result = await transactionService.batchTransactions(batchTxs);
            
            expect(result.successful).to.have.length(1);
            expect(result.failed).to.have.length(1);
            expect(result.totalGasUsed).to.equal(BigInt(150000));
        });
    });

    describe("Gas Optimization", function () {
        it("should get optimal gas price", async function () {
            const gasPrice = await transactionService.getOptimalGasPrice();
            
            expect(gasPrice).to.equal(ethers.parseUnits("30", "gwei")); // maxFeePerGas
        });

        it("should fallback to legacy gas price when EIP-1559 not available", async function () {
            mockProvider.getFeeData = async () => ({
                gasPrice: ethers.parseUnits("25", "gwei"),
                maxFeePerGas: null,
                maxPriorityFeePerGas: null
            });

            const gasPrice = await transactionService.getOptimalGasPrice();
            
            // Should be 25 + 10% = 27.5 gwei
            expect(gasPrice).to.equal(ethers.parseUnits("27.5", "gwei"));
        });

        it("should use fallback gas price on error", async function () {
            mockProvider.getFeeData = async () => {
                throw new Error("Network error");
            };

            const gasPrice = await transactionService.getOptimalGasPrice();
            
            expect(gasPrice).to.equal(ethers.parseUnits("20", "gwei")); // fallback
        });

        it("should calculate gas cost correctly", async function () {
            const cost = await transactionService.calculateGasCost(200000);
            
            expect(cost).to.equal(BigInt(200000) * ethers.parseUnits("30", "gwei"));
        });
    });

    describe("Transaction Monitoring", function () {
        it("should wait for transaction confirmation", async function () {
            const receipt = await transactionService.waitForTransaction("0xtest123", 1);
            
            expect(receipt).to.not.be.null;
            expect(receipt!.transactionHash).to.equal("0xtest123");
            expect(receipt!.status).to.equal(1);
        });

        it("should handle wait timeout", async function () {
            mockProvider.waitForTransaction = async () => {
                throw new Error("Timeout");
            };

            const receipt = await transactionService.waitForTransaction("0xtest123");
            
            expect(receipt).to.be.null;
        });

        it("should get transaction status correctly", async function () {
            const status = await transactionService.getTransactionStatus("0xtest123");
            
            expect(status).to.equal("confirmed");
        });

        it("should return pending for transaction without receipt", async function () {
            mockProvider.getTransactionReceipt = async () => null;

            const status = await transactionService.getTransactionStatus("0xtest123");
            
            expect(status).to.equal("pending");
        });

        it("should return not_found for non-existent transaction", async function () {
            mockProvider.getTransaction = async () => null;

            const status = await transactionService.getTransactionStatus("0xnonexistent");
            
            expect(status).to.equal("not_found");
        });
    });

    describe("Nonce Management", function () {
        it("should get nonce for wallet address", async function () {
            const nonce = await transactionService.getNonce();
            
            expect(nonce).to.equal(5);
        });

        it("should get nonce for specific address", async function () {
            const nonce = await transactionService.getNonce("0x0987654321098765432109876543210987654321");
            
            expect(nonce).to.equal(5);
        });
    });

    describe("Retry Mechanism", function () {
        it("should retry failed transaction successfully", async function () {
            let attemptCount = 0;
            mockWallet.sendTransaction = async (tx: any) => {
                attemptCount++;
                if (attemptCount === 1) {
                    throw new Error("First attempt failed");
                }
                return {
                    hash: "0xretry123",
                    wait: async () => ({
                        gasUsed: BigInt(150000),
                        status: 1
                    })
                };
            };

            const txRequest = {
                to: "0x0987654321098765432109876543210987654321",
                data: "0x1234"
            };

            const result = await transactionService.retryTransaction(txRequest, 2);
            
            expect(result.success).to.be.true;
            expect(result.hash).to.equal("0xretry123");
            expect(attemptCount).to.equal(2);
        });

        it("should fail after max retries", async function () {
            mockWallet.sendTransaction = async () => {
                throw new Error("Always fails");
            };

            const txRequest = {
                to: "0x0987654321098765432109876543210987654321",
                data: "0x1234"
            };

            const result = await transactionService.retryTransaction(txRequest, 2);
            
            expect(result.success).to.be.false;
            expect(result.error).to.include("Transaction failed after 2 attempts");
        });
    });

    describe("Network Monitoring", function () {
        it("should detect network congestion", async function () {
            mockProvider.getFeeData = async () => ({
                gasPrice: ethers.parseUnits("60", "gwei"), // Above 50 gwei threshold
                maxFeePerGas: ethers.parseUnits("70", "gwei"),
                maxPriorityFeePerGas: ethers.parseUnits("5", "gwei")
            });

            const isCongested = await transactionService.isNetworkCongested();
            
            expect(isCongested).to.be.true;
        });

        it("should detect normal network conditions", async function () {
            const isCongested = await transactionService.isNetworkCongested();
            
            expect(isCongested).to.be.false; // 20 gwei is below threshold
        });
    });

    describe("Utility Methods", function () {
        it("should track pending transactions", function () {
            const pendingTxs = transactionService.getPendingTransactions();
            
            expect(Array.isArray(pendingTxs)).to.be.true;
        });

        it("should get network gas price", async function () {
            const gasPrice = await transactionService.getNetworkGasPrice();
            
            expect(gasPrice).to.equal(ethers.parseUnits("20", "gwei"));
        });
    });
});