import { expect } from "chai";
import { ethers } from "hardhat";
import { ContractService } from "../../../src/services/blockchain/ContractService";
import { ContractName, Grade, UserType } from "../../../src/services/blockchain/types";

describe("ContractService", function () {
    let contractService: ContractService;
    let mockProvider: any;
    let mockWallet: any;
    let mockContract: any;

    beforeEach(function () {
        // Mock provider
        mockProvider = {
            getFeeData: async () => ({
                gasPrice: ethers.parseUnits("20", "gwei"),
                maxFeePerGas: ethers.parseUnits("30", "gwei"),
                maxPriorityFeePerGas: ethers.parseUnits("2", "gwei")
            }),
            estimateGas: async () => BigInt(200000),
            getTransactionCount: async () => 1
        };

        // Mock wallet
        mockWallet = {
            address: "0x1234567890123456789012345678901234567890",
            sendTransaction: async (tx: any) => ({
                hash: "0xabcdef1234567890",
                wait: async () => ({
                    gasUsed: BigInt(150000),
                    status: 1
                })
            })
        };

        // Mock contract
        mockContract = {
            registerUser: {
                estimateGas: async () => BigInt(100000)
            },
            mintCarbonNFT: {
                estimateGas: async () => BigInt(200000)
            },
            getUserNFTs: async () => [BigInt(1), BigInt(2), BigInt(3)],
            getNFTData: async () => ({
                currentGrade: 2,
                carbonScore: BigInt(85),
                endorsements: BigInt(5),
                mintedAt: BigInt(Date.now()),
                lastUpdated: BigInt(Date.now()),
                theme: "renewable-energy",
                isActive: true
            }),
            canUserUpload: async () => true,
            getRemainingWeeklyUploads: async () => BigInt(3)
        };

        // Create service instance with mocked dependencies
        contractService = new ContractService();
        
        // Override private properties for testing
        (contractService as any).provider = mockProvider;
        (contractService as any).wallet = mockWallet;
        (contractService as any).contracts = new Map([
            [ContractName.CARBON_NFT, mockContract]
        ]);
    });

    describe("Contract Instance Management", function () {
        it("should return contract instance for valid contract name", function () {
            const contract = contractService.getContractInstance(ContractName.CARBON_NFT);
            expect(contract).to.equal(mockContract);
        });

        it("should throw error for non-existent contract", function () {
            expect(() => {
                contractService.getContractInstance(ContractName.GOVERNANCE);
            }).to.throw("Contract Governance not initialized or address not configured");
        });
    });

    describe("CarbonNFT Functions", function () {
        it("should register user successfully", async function () {
            mockContract.registerUser = async () => ({
                hash: "0xtest123",
                wait: async () => ({ gasUsed: BigInt(100000), status: 1 })
            });

            const result = await contractService.registerUser(UserType.Individual);
            
            expect(result.success).to.be.true;
            expect(result.hash).to.equal("0xtest123");
            expect(result.gasUsed).to.equal(BigInt(100000));
        });

        it("should handle registration failure", async function () {
            mockContract.registerUser = async () => {
                throw new Error("Registration failed");
            };

            const result = await contractService.registerUser(UserType.Individual);
            
            expect(result.success).to.be.false;
            expect(result.error).to.equal("Registration failed");
        });

        it("should mint NFT successfully", async function () {
            mockContract.mintCarbonNFT = async () => ({
                hash: "0xmint123",
                wait: async () => ({ gasUsed: BigInt(200000), status: 1 })
            });

            const result = await contractService.mintNFT(
                "0x1234567890123456789012345678901234567890",
                "ipfs://test-uri",
                "renewable-energy",
                Grade.B,
                85
            );
            
            expect(result.success).to.be.true;
            expect(result.hash).to.equal("0xmint123");
            expect(result.gasUsed).to.equal(BigInt(200000));
        });

        it("should update grade successfully", async function () {
            mockContract.updateGrade = async () => ({
                hash: "0xupdate123",
                wait: async () => ({ gasUsed: BigInt(120000), status: 1 })
            });

            const result = await contractService.updateGrade(
                1,
                Grade.A,
                95,
                "ipfs://updated-uri"
            );
            
            expect(result.success).to.be.true;
            expect(result.hash).to.equal("0xupdate123");
        });

        it("should endorse NFT successfully", async function () {
            mockContract.endorseNFT = async () => ({
                hash: "0xendorse123",
                wait: async () => ({ gasUsed: BigInt(80000), status: 1 })
            });

            const result = await contractService.endorseNFT(1);
            
            expect(result.success).to.be.true;
            expect(result.hash).to.equal("0xendorse123");
        });
    });

    describe("View Functions", function () {
        it("should get user NFTs", async function () {
            const nfts = await contractService.getUserNFTs("0x1234567890123456789012345678901234567890");
            
            expect(nfts).to.deep.equal([1, 2, 3]);
        });

        it("should get NFT data", async function () {
            const data = await contractService.getNFTData(1);
            
            expect(data.currentGrade).to.equal(2);
            expect(data.carbonScore).to.equal(BigInt(85));
            expect(data.theme).to.equal("renewable-energy");
            expect(data.isActive).to.be.true;
        });

        it("should check if user can upload", async function () {
            const canUpload = await contractService.canUserUpload("0x1234567890123456789012345678901234567890");
            
            expect(canUpload).to.be.true;
        });

        it("should get remaining weekly uploads", async function () {
            const remaining = await contractService.getRemainingWeeklyUploads("0x1234567890123456789012345678901234567890");
            
            expect(remaining).to.equal(3);
        });
    });

    describe("Gas Estimation", function () {
        it("should estimate gas for contract function", async function () {
            const estimation = await contractService.estimateGas(
                ContractName.CARBON_NFT,
                "registerUser",
                [UserType.Individual]
            );
            
            expect(estimation.gasLimit).to.equal(100000);
            expect(estimation.gasPrice).to.equal(ethers.parseUnits("20", "gwei"));
            expect(estimation.estimatedCost).to.be.greaterThan(0);
        });

        it("should handle gas estimation failure", async function () {
            mockContract.registerUser.estimateGas = async () => {
                throw new Error("Gas estimation failed");
            };

            try {
                await contractService.estimateGas(
                    ContractName.CARBON_NFT,
                    "registerUser",
                    [UserType.Individual]
                );
                expect.fail("Should have thrown an error");
            } catch (error) {
                expect((error as Error).message).to.include("Gas estimation failed");
            }
        });
    });

    describe("Transaction Configuration", function () {
        it("should build transaction config correctly", function () {
            const config = {
                gasLimit: 300000,
                gasPrice: ethers.parseUnits("25", "gwei"),
                value: ethers.parseEther("0.1")
            };

            // Access private method for testing
            const builtConfig = (contractService as any).buildTxConfig(config);
            
            expect(builtConfig.gasLimit).to.equal(300000);
            expect(builtConfig.gasPrice).to.equal(ethers.parseUnits("25", "gwei"));
            expect(builtConfig.value).to.equal(ethers.parseEther("0.1"));
        });

        it("should return empty config when no config provided", function () {
            const builtConfig = (contractService as any).buildTxConfig();
            
            expect(Object.keys(builtConfig)).to.have.length(0);
        });
    });
});