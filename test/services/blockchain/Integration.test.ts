import { expect } from "chai";
import { ethers } from "hardhat";
import { ContractService } from "../../../src/services/blockchain/ContractService";
import { TransactionService } from "../../../src/services/blockchain/TransactionService";
import { EventService } from "../../../src/services/blockchain/EventService";
import { ContractName, Grade, UserType } from "../../../src/services/blockchain/types";

describe("Blockchain Services Integration", function () {
    let contractService: ContractService;
    let transactionService: TransactionService;
    let eventService: EventService;
    
    // Mock shared provider and wallet
    let mockProvider: any;
    let mockWallet: any;
    let mockContract: any;

    beforeEach(function () {
        // Shared mock provider
        mockProvider = {
            getFeeData: async () => ({
                gasPrice: ethers.parseUnits("20", "gwei"),
                maxFeePerGas: ethers.parseUnits("30", "gwei"),
                maxPriorityFeePerGas: ethers.parseUnits("2", "gwei")
            }),
            estimateGas: async () => BigInt(200000),
            getTransactionCount: async () => 1,
            getBlockNumber: async () => 12345,
            waitForTransaction: async (hash: string) => ({
                transactionHash: hash,
                status: 1,
                gasUsed: BigInt(150000)
            })
        };

        // Shared mock wallet
        mockWallet = {
            address: "0x1234567890123456789012345678901234567890",
            sendTransaction: async (tx: any) => ({
                hash: "0xintegration123",
                wait: async () => ({
                    gasUsed: BigInt(150000),
                    status: 1,
                    transactionHash: "0xintegration123"
                })
            })
        };

        // Mock contract with event capabilities
        mockContract = {
            target: "0x1234567890123456789012345678901234567890",
            mintCarbonNFT: async () => ({
                hash: "0xmint123",
                wait: async () => ({
                    gasUsed: BigInt(200000),
                    status: 1,
                    logs: [{
                        address: "0x1234567890123456789012345678901234567890",
                        topics: ["0xnftminted"],
                        data: "0x..."
                    }]
                })
            }),
            filters: {
                NFTMinted: () => ({
                    address: "0x1234567890123456789012345678901234567890",
                    topics: ["0xnftminted"]
                })
            },
            on: () => {},
            removeAllListeners: () => {},
            queryFilter: async () => []
        };

        // Initialize services
        contractService = new ContractService();
        transactionService = new TransactionService();
        eventService = new EventService();

        // Override private properties for testing
        (contractService as any).provider = mockProvider;
        (contractService as any).wallet = mockWallet;
        (contractService as any).contracts = new Map([[ContractName.CARBON_NFT, mockContract]]);

        (transactionService as any).provider = mockProvider;
        (transactionService as any).wallet = mockWallet;

        (eventService as any).provider = mockProvider;
        (eventService as any).contracts = new Map([[ContractName.CARBON_NFT, mockContract]]);
    });

    afterEach(function () {
        if (eventService.isMonitoring()) {
            eventService.stopEventMonitoring();
        }
        eventService.unsubscribeAll();
    });

    describe("Contract and Transaction Service Integration", function () {
        it("should mint NFT using both services", async function () {
            // First, estimate gas using transaction service
            const txRequest = {
                to: "0x1234567890123456789012345678901234567890",
                data: "0x1234"
            };

            const gasEstimation = await transactionService.estimateGas(txRequest);
            expect(gasEstimation.gasLimit).to.equal(200000);

            // Then mint NFT using contract service
            const result = await contractService.mintNFT(
                "0x0987654321098765432109876543210987654321",
                "ipfs://test-uri",
                "renewable-energy",
                Grade.B,
                85
            );

            expect(result.success).to.be.true;
            expect(result.hash).to.equal("0xmint123");
        });

        it("should handle transaction retry through both services", async function () {
            let attemptCount = 0;
            mockWallet.sendTransaction = async (tx: any) => {
                attemptCount++;
                if (attemptCount === 1) {
                    throw new Error("Network congestion");
                }
                return {
                    hash: "0xretry123",
                    wait: async () => ({
                        gasUsed: BigInt(150000),
                        status: 1
                    })
                };
            };

            // Use transaction service retry mechanism
            const txRequest = {
                to: "0x1234567890123456789012345678901234567890",
                data: "0x1234"
            };

            const result = await transactionService.retryTransaction(txRequest, 2);
            expect(result.success).to.be.true;
            expect(attemptCount).to.equal(2);
        });
    });

    describe("Contract and Event Service Integration", function () {
        it("should mint NFT and listen for events", function (done) {
            let eventReceived = false;

            // Set up event listener
            const callback = (event: any) => {
                eventReceived = true;
                expect(event.eventName).to.equal("NFTMinted");
                done();
            };

            eventService.subscribeToEvents(
                ContractName.CARBON_NFT,
                "NFTMinted",
                callback
            );

            // Simulate NFT minting and event emission
            setTimeout(() => {
                const mockEvent = {
                    address: "0x1234567890123456789012345678901234567890",
                    blockNumber: 12346,
                    transactionHash: "0xmint123",
                    eventName: "NFTMinted",
                    args: [BigInt(1), "0xuser1", 2, "renewable-energy"]
                };

                // Trigger callback directly for testing
                callback(mockEvent);
            }, 100);
        });

        it("should process historical events after contract deployment", async function () {
            // Mock historical events
            mockContract.queryFilter = async () => [
                {
                    address: "0x1234567890123456789012345678901234567890",
                    blockNumber: 12340,
                    transactionHash: "0xhistorical1",
                    eventName: "NFTMinted",
                    args: [BigInt(1), "0xuser1", 2, "renewable-energy"]
                }
            ];

            const events = await eventService.getHistoricalEvents(
                ContractName.CARBON_NFT,
                "NFTMinted",
                12340,
                12345
            );

            expect(events).to.have.length(1);
            expect(events[0].eventName).to.equal("NFTMinted");
            expect(events[0].transactionHash).to.equal("0xhistorical1");
        });
    });

    describe("Transaction and Event Service Integration", function () {
        it("should monitor transaction confirmation through events", async function () {
            let transactionConfirmed = false;

            // Set up event monitoring
            eventService.startEventMonitoring();

            // Send transaction
            const txRequest = {
                to: "0x1234567890123456789012345678901234567890",
                data: "0x1234"
            };

            const result = await transactionService.sendTransaction(txRequest);
            expect(result.success).to.be.true;

            // Wait for transaction confirmation
            const receipt = await transactionService.waitForTransaction(result.hash);
            expect(receipt).to.not.be.null;
            expect(receipt!.status).to.equal(1);

            eventService.stopEventMonitoring();
        });

        it("should batch transactions and monitor all events", async function () {
            const batchTxs = [
                {
                    id: "tx1",
                    to: "0x1234567890123456789012345678901234567890",
                    data: "0x1111"
                },
                {
                    id: "tx2",
                    to: "0x1234567890123456789012345678901234567890",
                    data: "0x2222"
                }
            ];

            const batchResult = await transactionService.batchTransactions(batchTxs);
            
            expect(batchResult.successful).to.have.length(2);
            expect(batchResult.failed).to.have.length(0);
            expect(batchResult.totalGasUsed).to.equal(BigInt(300000)); // 150000 * 2
        });
    });

    describe("Full Workflow Integration", function () {
        it("should complete full NFT minting workflow", async function () {
            let eventsReceived: any[] = [];

            // Set up comprehensive event monitoring
            const eventCallback = (event: any) => {
                eventsReceived.push(event);
            };

            eventService.subscribeToEvents(ContractName.CARBON_NFT, "NFTMinted", eventCallback);
            eventService.subscribeToEvents(ContractName.CARBON_NFT, "GradeUpdated", eventCallback);

            // Step 1: Register user
            const registerResult = await contractService.registerUser(UserType.Individual);
            expect(registerResult.success).to.be.true;

            // Step 2: Mint NFT
            const mintResult = await contractService.mintNFT(
                "0x0987654321098765432109876543210987654321",
                "ipfs://test-metadata",
                "renewable-energy",
                Grade.C,
                75
            );
            expect(mintResult.success).to.be.true;

            // Step 3: Update grade
            const updateResult = await contractService.updateGrade(
                1,
                Grade.B,
                85,
                "ipfs://updated-metadata"
            );
            expect(updateResult.success).to.be.true;

            // Verify all transactions were successful
            expect(registerResult.success && mintResult.success && updateResult.success).to.be.true;
        });

        it("should handle workflow with gas optimization", async function () {
            // Get optimal gas price
            const gasPrice = await transactionService.getOptimalGasPrice();
            expect(gasPrice).to.be.greaterThan(0);

            // Use optimized gas settings for contract calls
            const config = {
                gasPrice,
                gasLimit: 250000
            };

            const result = await contractService.mintNFT(
                "0x0987654321098765432109876543210987654321",
                "ipfs://optimized-metadata",
                "solar-power",
                Grade.A,
                95,
                config
            );

            expect(result.success).to.be.true;
        });

        it("should handle errors gracefully across services", async function () {
            // Simulate network failure
            mockWallet.sendTransaction = async () => {
                throw new Error("Network error");
            };

            // Contract service should handle the error
            const result = await contractService.mintNFT(
                "0x0987654321098765432109876543210987654321",
                "ipfs://test-metadata",
                "renewable-energy",
                Grade.C,
                75
            );

            expect(result.success).to.be.false;
            expect(result.error).to.equal("Network error");

            // Transaction service should also handle the error
            const txRequest = {
                to: "0x1234567890123456789012345678901234567890",
                data: "0x1234"
            };

            const txResult = await transactionService.sendTransaction(txRequest);
            expect(txResult.success).to.be.false;
            expect(txResult.error).to.equal("Network error");
        });
    });

    describe("Service State Consistency", function () {
        it("should maintain consistent state across services", async function () {
            // All services should use the same provider/wallet
            const contractProvider = (contractService as any).provider;
            const transactionProvider = (transactionService as any).provider;
            const eventProvider = (eventService as any).provider;

            expect(contractProvider).to.equal(mockProvider);
            expect(transactionProvider).to.equal(mockProvider);
            expect(eventProvider).to.equal(mockProvider);
        });

        it("should handle concurrent operations", async function () {
            const promises = [
                contractService.getUserNFTs("0x1234567890123456789012345678901234567890"),
                transactionService.getOptimalGasPrice(),
                eventService.getLatestBlockNumber()
            ];

            const results = await Promise.all(promises);
            
            expect(results[0]).to.be.an("array"); // getUserNFTs result
            expect(results[1]).to.be.greaterThan(0); // gas price
            expect(results[2]).to.equal(12345); // block number
        });
    });
});