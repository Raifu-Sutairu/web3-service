import { expect } from "chai";
import { BlockchainServiceManager } from "../../../src/services/blockchain";

describe("BlockchainServiceManager", function () {
    let serviceManager: BlockchainServiceManager;

    beforeEach(function () {
        serviceManager = new BlockchainServiceManager();
    });

    afterEach(async function () {
        await serviceManager.cleanup();
    });

    describe("Service Initialization", function () {
        it("should initialize all services", function () {
            expect(serviceManager.contractService).to.not.be.undefined;
            expect(serviceManager.transactionService).to.not.be.undefined;
            expect(serviceManager.eventService).to.not.be.undefined;
        });

        it("should initialize services successfully", async function () {
            // Mock the event service to avoid actual network calls
            const mockEventService = {
                startEventMonitoring: () => {},
                stopEventMonitoring: () => {},
                unsubscribeAll: () => {},
                getLatestBlockNumber: async () => 12345
            };
            
            serviceManager.eventService = mockEventService as any;

            await serviceManager.initialize();
            
            // Should complete without throwing
            expect(true).to.be.true;
        });

        it("should handle initialization errors", async function () {
            // Mock the event service to throw an error
            const mockEventService = {
                startEventMonitoring: () => {
                    throw new Error("Initialization failed");
                }
            };
            
            serviceManager.eventService = mockEventService as any;

            try {
                await serviceManager.initialize();
                expect.fail("Should have thrown an error");
            } catch (error) {
                expect((error as Error).message).to.equal("Initialization failed");
            }
        });
    });

    describe("Service Cleanup", function () {
        it("should cleanup all services", async function () {
            let eventMonitoringStopped = false;
            let eventsUnsubscribed = false;

            // Mock the event service
            const mockEventService = {
                stopEventMonitoring: () => {
                    eventMonitoringStopped = true;
                },
                unsubscribeAll: () => {
                    eventsUnsubscribed = true;
                }
            };
            
            serviceManager.eventService = mockEventService as any;

            await serviceManager.cleanup();
            
            expect(eventMonitoringStopped).to.be.true;
            expect(eventsUnsubscribed).to.be.true;
        });

        it("should handle cleanup errors gracefully", async function () {
            // Mock the event service to throw an error
            const mockEventService = {
                stopEventMonitoring: () => {
                    throw new Error("Cleanup failed");
                },
                unsubscribeAll: () => {}
            };
            
            serviceManager.eventService = mockEventService as any;

            // Should not throw - errors should be caught and logged
            await serviceManager.cleanup();
            
            expect(true).to.be.true;
        });
    });

    describe("Health Check", function () {
        it("should perform health check on all services", async function () {
            // Mock all services for health check
            const mockContractService = {
                getContractInstance: () => ({ address: "0x123" })
            };
            
            const mockTransactionService = {
                getOptimalGasPrice: async () => BigInt(20000000000) // 20 gwei
            };
            
            const mockEventService = {
                getLatestBlockNumber: async () => 12345
            };
            
            serviceManager.contractService = mockContractService as any;
            serviceManager.transactionService = mockTransactionService as any;
            serviceManager.eventService = mockEventService as any;

            const health = await serviceManager.healthCheck();
            
            expect(health.contractService).to.be.true;
            expect(health.transactionService).to.be.true;
            expect(health.eventService).to.be.true;
            expect(health.overall).to.be.true;
        });

        it("should detect service failures in health check", async function () {
            // Mock services to fail
            const mockContractService = {
                getContractInstance: () => {
                    throw new Error("Contract service failed");
                }
            };
            
            const mockTransactionService = {
                getOptimalGasPrice: async () => {
                    throw new Error("Transaction service failed");
                }
            };
            
            const mockEventService = {
                getLatestBlockNumber: async () => {
                    throw new Error("Event service failed");
                }
            };
            
            serviceManager.contractService = mockContractService as any;
            serviceManager.transactionService = mockTransactionService as any;
            serviceManager.eventService = mockEventService as any;

            const health = await serviceManager.healthCheck();
            
            expect(health.contractService).to.be.false;
            expect(health.transactionService).to.be.false;
            expect(health.eventService).to.be.false;
            expect(health.overall).to.be.false;
        });

        it("should handle partial service failures", async function () {
            // Mock contract service to succeed, others to fail
            const mockContractService = {
                getContractInstance: () => ({ address: "0x123" })
            };
            
            const mockTransactionService = {
                getOptimalGasPrice: async () => {
                    throw new Error("Transaction service failed");
                }
            };
            
            const mockEventService = {
                getLatestBlockNumber: async () => {
                    throw new Error("Event service failed");
                }
            };
            
            serviceManager.contractService = mockContractService as any;
            serviceManager.transactionService = mockTransactionService as any;
            serviceManager.eventService = mockEventService as any;

            const health = await serviceManager.healthCheck();
            
            expect(health.contractService).to.be.true;
            expect(health.transactionService).to.be.false;
            expect(health.eventService).to.be.false;
            expect(health.overall).to.be.false; // Overall should be false if any service fails
        });
    });

    describe("Service Integration", function () {
        it("should provide access to all service instances", function () {
            expect(serviceManager.contractService).to.be.an("object");
            expect(serviceManager.transactionService).to.be.an("object");
            expect(serviceManager.eventService).to.be.an("object");
        });

        it("should maintain service instances across operations", async function () {
            const contractServiceRef = serviceManager.contractService;
            const transactionServiceRef = serviceManager.transactionService;
            const eventServiceRef = serviceManager.eventService;

            // Mock services for initialization
            serviceManager.eventService = {
                startEventMonitoring: () => {},
                stopEventMonitoring: () => {},
                unsubscribeAll: () => {}
            } as any;

            await serviceManager.initialize();
            await serviceManager.cleanup();

            // References should remain the same
            expect(serviceManager.contractService).to.equal(contractServiceRef);
            expect(serviceManager.transactionService).to.equal(transactionServiceRef);
        });
    });

    describe("Singleton Instance", function () {
        it("should export a singleton instance", function () {
            const { blockchainServices } = require("../../../src/services/blockchain");
            
            expect(blockchainServices).to.be.an.instanceof(BlockchainServiceManager);
            expect(blockchainServices.contractService).to.not.be.undefined;
            expect(blockchainServices.transactionService).to.not.be.undefined;
            expect(blockchainServices.eventService).to.not.be.undefined;
        });
    });
});