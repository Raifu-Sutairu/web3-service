import { expect } from "chai";
import { ethers } from "hardhat";
import { EventService } from "../../../src/services/blockchain/EventService";
import { ContractName } from "../../../src/services/blockchain/types";

describe("EventService", function () {
    let eventService: EventService;
    let mockProvider: any;
    let mockContract: any;
    let eventCallbacks: any[] = [];

    beforeEach(function () {
        eventCallbacks = [];

        // Mock provider
        mockProvider = {
            getBlockNumber: async () => 12345,
            getBlock: async (blockNumber: number) => ({
                timestamp: Math.floor(Date.now() / 1000),
                number: blockNumber
            }),
            waitForTransaction: async (hash: string) => ({
                transactionHash: hash,
                status: 1
            })
        };

        // Mock contract
        mockContract = {
            target: "0x1234567890123456789012345678901234567890",
            filters: {
                NFTMinted: (...args: any[]) => ({
                    address: "0x1234567890123456789012345678901234567890",
                    topics: ["0xnftminted", ...args]
                }),
                GradeUpdated: (...args: any[]) => ({
                    address: "0x1234567890123456789012345678901234567890",
                    topics: ["0xgradeupdated", ...args]
                }),
                UserRegistered: (...args: any[]) => ({
                    address: "0x1234567890123456789012345678901234567890",
                    topics: ["0xuserregistered", ...args]
                })
            },
            on: (filter: any, callback: any) => {
                eventCallbacks.push({ filter, callback });
            },
            removeAllListeners: (eventName: string) => {
                eventCallbacks = eventCallbacks.filter(cb => 
                    !cb.filter.topics.includes(`0x${eventName.toLowerCase()}`)
                );
            },
            queryFilter: async (filter: any, fromBlock?: number, toBlock?: number) => {
                // Mock historical events
                return [
                    {
                        address: "0x1234567890123456789012345678901234567890",
                        blockNumber: 12340,
                        transactionHash: "0xevent1",
                        eventName: "NFTMinted",
                        args: [BigInt(1), "0xuser1", 2, "renewable-energy"]
                    },
                    {
                        address: "0x1234567890123456789012345678901234567890",
                        blockNumber: 12341,
                        transactionHash: "0xevent2",
                        eventName: "GradeUpdated",
                        args: [BigInt(1), 2, 3, BigInt(90)]
                    }
                ];
            }
        };

        // Create service instance
        eventService = new EventService();
        
        // Override private properties for testing
        (eventService as any).provider = mockProvider;
        (eventService as any).contracts = new Map([
            [ContractName.CARBON_NFT, mockContract]
        ]);
        (eventService as any).lastProcessedBlock = 12340;
    });

    afterEach(function () {
        if (eventService.isMonitoring()) {
            eventService.stopEventMonitoring();
        }
        eventService.unsubscribeAll();
    });

    describe("Event Subscription Management", function () {
        it("should subscribe to events successfully", function () {
            const callback = (event: any) => {
                console.log("Event received:", event);
            };

            const subscriptionId = eventService.subscribeToEvents(
                ContractName.CARBON_NFT,
                "NFTMinted",
                callback
            );

            expect(subscriptionId).to.be.a("string");
            expect(subscriptionId).to.include("CarbonNFT_NFTMinted");
            expect(eventCallbacks).to.have.length(1);
        });

        it("should unsubscribe from events", function () {
            const callback = (event: any) => {};
            
            const subscriptionId = eventService.subscribeToEvents(
                ContractName.CARBON_NFT,
                "NFTMinted",
                callback
            );

            expect(eventService.getActiveSubscriptions()).to.have.length(1);
            
            eventService.unsubscribe(subscriptionId);
            
            expect(eventService.getActiveSubscriptions()).to.have.length(0);
        });

        it("should unsubscribe from all events", function () {
            const callback = (event: any) => {};
            
            eventService.subscribeToEvents(ContractName.CARBON_NFT, "NFTMinted", callback);
            eventService.subscribeToEvents(ContractName.CARBON_NFT, "GradeUpdated", callback);
            
            expect(eventService.getActiveSubscriptions()).to.have.length(2);
            
            eventService.unsubscribeAll();
            
            expect(eventService.getActiveSubscriptions()).to.have.length(0);
        });

        it("should check if subscribed to specific event", function () {
            const callback = (event: any) => {};
            
            eventService.subscribeToEvents(ContractName.CARBON_NFT, "NFTMinted", callback);
            
            expect(eventService.isSubscribed(ContractName.CARBON_NFT, "NFTMinted")).to.be.true;
            expect(eventService.isSubscribed(ContractName.CARBON_NFT, "GradeUpdated")).to.be.false;
        });
    });

    describe("Historical Event Queries", function () {
        it("should get historical events for specific event type", async function () {
            const events = await eventService.getHistoricalEvents(
                ContractName.CARBON_NFT,
                "NFTMinted",
                12340,
                12345
            );

            expect(events).to.have.length(2);
            expect(events[0].eventName).to.equal("NFTMinted");
            expect(events[0].blockNumber).to.equal(12340);
            expect(events[0].transactionHash).to.equal("0xevent1");
        });

        it("should get all historical events for contract", async function () {
            const events = await eventService.getAllHistoricalEvents(
                ContractName.CARBON_NFT,
                12340,
                12345
            );

            expect(events).to.have.length(2);
            expect(events[0].contractName).to.equal(ContractName.CARBON_NFT);
        });

        it("should handle historical event query errors", async function () {
            mockContract.queryFilter = async () => {
                throw new Error("Query failed");
            };

            const events = await eventService.getHistoricalEvents(
                ContractName.CARBON_NFT,
                "NFTMinted",
                12340
            );

            expect(events).to.have.length(0);
        });

        it("should throw error for non-existent contract", async function () {
            try {
                await eventService.getHistoricalEvents(
                    ContractName.GOVERNANCE,
                    "ProposalCreated",
                    12340
                );
                expect.fail("Should have thrown an error");
            } catch (error) {
                expect((error as Error).message).to.include("Contract Governance not found");
            }
        });
    });

    describe("Event Processing", function () {
        it("should process event correctly", function () {
            const mockEvent = {
                address: "0x1234567890123456789012345678901234567890",
                blockNumber: 12345,
                transactionHash: "0xtest123",
                eventName: "NFTMinted",
                args: [BigInt(1), "0xuser1", 2, "renewable-energy"]
            };

            const processedEvent = eventService.processEvent(mockEvent as any);

            expect(processedEvent.contractName).to.equal(ContractName.CARBON_NFT);
            expect(processedEvent.eventName).to.equal("NFTMinted");
            expect(processedEvent.blockNumber).to.equal(12345);
            expect(processedEvent.transactionHash).to.equal("0xtest123");
            expect(processedEvent.args).to.deep.equal([BigInt(1), "0xuser1", 2, "renewable-energy"]);
        });
    });

    describe("Event Monitoring", function () {
        it("should start event monitoring", function () {
            expect(eventService.isMonitoring()).to.be.false;
            
            eventService.startEventMonitoring();
            
            expect(eventService.isMonitoring()).to.be.true;
        });

        it("should stop event monitoring", function () {
            eventService.startEventMonitoring();
            expect(eventService.isMonitoring()).to.be.true;
            
            eventService.stopEventMonitoring();
            
            expect(eventService.isMonitoring()).to.be.false;
        });

        it("should not start monitoring if already active", function () {
            eventService.startEventMonitoring();
            
            // Try to start again - should warn but not fail
            eventService.startEventMonitoring();
            
            expect(eventService.isMonitoring()).to.be.true;
        });

        it("should not stop monitoring if not active", function () {
            expect(eventService.isMonitoring()).to.be.false;
            
            // Try to stop when not running - should warn but not fail
            eventService.stopEventMonitoring();
            
            expect(eventService.isMonitoring()).to.be.false;
        });
    });

    describe("Utility Methods", function () {
        it("should get latest block number", async function () {
            const blockNumber = await eventService.getLatestBlockNumber();
            
            expect(blockNumber).to.equal(12345);
        });

        it("should get block timestamp", async function () {
            const timestamp = await eventService.getBlockTimestamp(12345);
            
            expect(timestamp).to.be.greaterThan(0);
        });

        it("should handle block timestamp error", async function () {
            mockProvider.getBlock = async () => {
                throw new Error("Block not found");
            };

            const timestamp = await eventService.getBlockTimestamp(99999);
            
            expect(timestamp).to.equal(0);
        });

        it("should get subscription count", function () {
            const callback = (event: any) => {};
            
            eventService.subscribeToEvents(ContractName.CARBON_NFT, "NFTMinted", callback);
            eventService.subscribeToEvents(ContractName.CARBON_NFT, "GradeUpdated", callback);
            
            expect(eventService.getSubscriptionCount()).to.equal(2);
        });

        it("should get contract addresses", function () {
            const addresses = eventService.getContractAddresses();
            
            expect(addresses[ContractName.CARBON_NFT]).to.equal("0x1234567890123456789012345678901234567890");
        });

        it("should create event filter", function () {
            const filter = eventService.createEventFilter(
                ContractName.CARBON_NFT,
                "NFTMinted",
                null, // tokenId
                "0xuser1" // owner
            );

            expect(filter.address).to.equal("0x1234567890123456789012345678901234567890");
            expect(filter.topics).to.include("0xnftminted");
        });

        it("should get event count", async function () {
            const count = await eventService.getEventCount(
                ContractName.CARBON_NFT,
                "NFTMinted",
                12340,
                12345
            );

            expect(count).to.equal(2);
        });
    });

    describe("Event Callback Execution", function () {
        it("should execute callback when event is received", function (done) {
            const callback = (event: any) => {
                expect(event.eventName).to.equal("NFTMinted");
                done();
            };

            eventService.subscribeToEvents(
                ContractName.CARBON_NFT,
                "NFTMinted",
                callback
            );

            // Simulate event reception
            const mockEvent = {
                address: "0x1234567890123456789012345678901234567890",
                blockNumber: 12346,
                transactionHash: "0xnewevent",
                eventName: "NFTMinted",
                args: [BigInt(2), "0xuser2", 1, "solar-power"]
            };

            // Trigger the callback directly for testing
            if (eventCallbacks.length > 0) {
                eventCallbacks[0].callback(mockEvent);
            }
        });

        it("should handle callback errors gracefully", function () {
            const callback = (event: any) => {
                throw new Error("Callback error");
            };

            eventService.subscribeToEvents(
                ContractName.CARBON_NFT,
                "NFTMinted",
                callback
            );

            // This should not throw - errors should be caught internally
            const mockEvent = {
                eventName: "NFTMinted",
                args: []
            };

            expect(() => {
                if (eventCallbacks.length > 0) {
                    eventCallbacks[0].callback(mockEvent);
                }
            }).to.not.throw();
        });
    });
});