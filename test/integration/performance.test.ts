import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { CarbonNFT, Community, Marketplace, Governance } from "../../typechain-types";

describe("Performance and Gas Optimization Tests", function () {
    let carbonNFT: CarbonNFT;
    let community: Community;
    let marketplace: Marketplace;
    let governance: Governance;
    
    let owner: SignerWithAddress;
    let users: SignerWithAddress[];
    
    const GRADE_A = 4;
    const GRADE_B = 3;
    const GRADE_C = 2;
    const THEME = "renewable-energy";
    const TOKEN_URI = "ipfs://QmTest123";
    
    // Gas limit thresholds for different operations
    const GAS_LIMITS = {
        NFT_MINT: 200000,
        NFT_TRANSFER: 100000,
        MARKETPLACE_LIST: 150000,
        MARKETPLACE_BUY: 200000,
        COMMUNITY_VISIBILITY: 80000,
        GOVERNANCE_VOTE: 120000,
        GOVERNANCE_PROPOSAL: 180000
    };
    
    beforeEach(async function () {
        const signers = await ethers.getSigners();
        owner = signers[0];
        users = signers.slice(1, 11); // Use 10 users for testing
        
        // Deploy contracts
        const CarbonNFTFactory = await ethers.getContractFactory("CarbonNFT");
        carbonNFT = await CarbonNFTFactory.deploy();
        await carbonNFT.deployed();
        
        const CommunityFactory = await ethers.getContractFactory("Community");
        community = await CommunityFactory.deploy(carbonNFT.address);
        await community.deployed();
        
        const MarketplaceFactory = await ethers.getContractFactory("Marketplace");
        marketplace = await MarketplaceFactory.deploy(carbonNFT.address);
        await marketplace.deployed();
        
        const GovernanceFactory = await ethers.getContractFactory("Governance");
        governance = await GovernanceFactory.deploy(carbonNFT.address);
        await governance.deployed();
        
        // Register users
        for (let i = 0; i < users.length; i++) {
            await carbonNFT.connect(users[i]).registerUser(i % 2);
        }
    });
    
    describe("Gas Usage Optimization", function () {
        it("Should mint NFTs within gas limits", async function () {
            const user = users[0];
            
            // Measure gas for NFT minting
            const tx = await carbonNFT.mintCarbonNFT(
                user.address,
                TOKEN_URI,
                THEME,
                GRADE_A,
                900
            );
            const receipt = await tx.wait();
            
            console.log(`NFT Mint Gas Used: ${receipt.gasUsed.toNumber()}`);
            expect(receipt.gasUsed.toNumber()).to.be.lessThan(GAS_LIMITS.NFT_MINT);
        });
        
        it("Should handle marketplace operations efficiently", async function () {
            const seller = users[0];
            const buyer = users[1];
            
            // Mint NFT
            await carbonNFT.mintCarbonNFT(seller.address, TOKEN_URI, THEME, GRADE_A, 900);
            const tokenId = 0;
            
            // Measure gas for listing
            await carbonNFT.connect(seller).approve(marketplace.address, tokenId);
            const listTx = await marketplace.connect(seller).listNFT(tokenId, ethers.utils.parseEther("0.1"));
            const listReceipt = await listTx.wait();
            
            console.log(`Marketplace List Gas Used: ${listReceipt.gasUsed.toNumber()}`);
            expect(listReceipt.gasUsed.toNumber()).to.be.lessThan(GAS_LIMITS.MARKETPLACE_LIST);
            
            // Measure gas for buying
            const buyTx = await marketplace.connect(buyer).buyNFT(1, { value: ethers.utils.parseEther("0.1") });
            const buyReceipt = await buyTx.wait();
            
            console.log(`Marketplace Buy Gas Used: ${buyReceipt.gasUsed.toNumber()}`);
            expect(buyReceipt.gasUsed.toNumber()).to.be.lessThan(GAS_LIMITS.MARKETPLACE_BUY);
        });
        
        it("Should handle community operations efficiently", async function () {
            const user = users[0];
            
            // Mint NFT
            await carbonNFT.mintCarbonNFT(user.address, TOKEN_URI, THEME, GRADE_A, 900);
            const tokenId = 0;
            
            // Measure gas for visibility setting
            const visibilityTx = await community.connect(user).setNFTVisibility(tokenId, true);
            const visibilityReceipt = await visibilityTx.wait();
            
            console.log(`Community Visibility Gas Used: ${visibilityReceipt.gasUsed.toNumber()}`);
            expect(visibilityReceipt.gasUsed.toNumber()).to.be.lessThan(GAS_LIMITS.COMMUNITY_VISIBILITY);
        });
        
        it("Should handle governance operations efficiently", async function () {
            const proposer = users[0];
            const voter = users[1];
            
            // Mint NFTs for voting power
            await carbonNFT.mintCarbonNFT(proposer.address, TOKEN_URI + "1", THEME, GRADE_A, 900);
            await carbonNFT.mintCarbonNFT(voter.address, TOKEN_URI + "2", THEME, GRADE_B, 750);
            
            // Measure gas for proposal creation
            const data = ethers.utils.defaultAbiCoder.encode(["uint256"], [300]);
            const proposalTx = await governance.connect(proposer).createProposal("Test proposal", 0, data);
            const proposalReceipt = await proposalTx.wait();
            
            console.log(`Governance Proposal Gas Used: ${proposalReceipt.gasUsed.toNumber()}`);
            expect(proposalReceipt.gasUsed.toNumber()).to.be.lessThan(GAS_LIMITS.GOVERNANCE_PROPOSAL);
            
            // Measure gas for voting
            const voteTx = await governance.connect(voter).vote(0, true);
            const voteReceipt = await voteTx.wait();
            
            console.log(`Governance Vote Gas Used: ${voteReceipt.gasUsed.toNumber()}`);
            expect(voteReceipt.gasUsed.toNumber()).to.be.lessThan(GAS_LIMITS.GOVERNANCE_VOTE);
        });
    });
    
    describe("Batch Operations Performance", function () {
        it("Should handle multiple NFT mints efficiently", async function () {
            const batchSize = 5;
            const gasUsages: number[] = [];
            
            for (let i = 0; i < batchSize; i++) {
                const tx = await carbonNFT.mintCarbonNFT(
                    users[i].address,
                    TOKEN_URI + i,
                    THEME,
                    GRADE_A - (i % 5),
                    900 - (i * 50)
                );
                const receipt = await tx.wait();
                gasUsages.push(receipt.gasUsed.toNumber());
            }
            
            // Gas usage should remain consistent
            const avgGas = gasUsages.reduce((a, b) => a + b, 0) / gasUsages.length;
            const maxDeviation = Math.max(...gasUsages.map(gas => Math.abs(gas - avgGas)));
            
            console.log(`Average Gas for Batch Minting: ${avgGas}`);
            console.log(`Max Deviation: ${maxDeviation}`);
            
            // Deviation should be minimal (less than 10% of average)
            expect(maxDeviation).to.be.lessThan(avgGas * 0.1);
        });
        
        it("Should handle multiple marketplace listings efficiently", async function () {
            const batchSize = 5;
            
            // Mint NFTs
            for (let i = 0; i < batchSize; i++) {
                await carbonNFT.mintCarbonNFT(users[i].address, TOKEN_URI + i, THEME, GRADE_A, 900);
            }
            
            // Batch list NFTs
            const gasUsages: number[] = [];
            for (let i = 0; i < batchSize; i++) {
                await carbonNFT.connect(users[i]).approve(marketplace.address, i);
                const tx = await marketplace.connect(users[i]).listNFT(i, ethers.utils.parseEther("0.1"));
                const receipt = await tx.wait();
                gasUsages.push(receipt.gasUsed.toNumber());
            }
            
            // Check gas consistency
            const avgGas = gasUsages.reduce((a, b) => a + b, 0) / gasUsages.length;
            console.log(`Average Gas for Batch Listing: ${avgGas}`);
            
            gasUsages.forEach(gas => {
                expect(gas).to.be.lessThan(GAS_LIMITS.MARKETPLACE_LIST);
            });
        });
        
        it("Should handle multiple community visibility updates efficiently", async function () {
            const batchSize = 10;
            
            // Mint NFTs
            for (let i = 0; i < batchSize; i++) {
                await carbonNFT.mintCarbonNFT(users[i].address, TOKEN_URI + i, THEME, GRADE_A, 900);
            }
            
            // Batch visibility updates
            const startTime = Date.now();
            const gasUsages: number[] = [];
            
            for (let i = 0; i < batchSize; i++) {
                const tx = await community.connect(users[i]).setNFTVisibility(i, true);
                const receipt = await tx.wait();
                gasUsages.push(receipt.gasUsed.toNumber());
            }
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;
            
            console.log(`Batch Visibility Updates Time: ${totalTime}ms`);
            console.log(`Average Gas per Update: ${gasUsages.reduce((a, b) => a + b, 0) / gasUsages.length}`);
            
            // Should complete within reasonable time (less than 30 seconds)
            expect(totalTime).to.be.lessThan(30000);
        });
    });
    
    describe("Large Dataset Performance", function () {
        it("Should handle large community galleries efficiently", async function () {
            const nftCount = 50;
            
            // Mint many NFTs
            for (let i = 0; i < nftCount; i++) {
                await carbonNFT.mintCarbonNFT(
                    users[i % users.length].address,
                    TOKEN_URI + i,
                    THEME,
                    GRADE_A - (i % 5),
                    900 - (i * 10)
                );
                
                // Set half as public
                if (i % 2 === 0) {
                    await community.connect(users[i % users.length]).setNFTVisibility(i, true);
                }
            }
            
            // Test gallery retrieval performance
            const startTime = Date.now();
            const publicNFTs = await community.getPublicNFTs(0, 25); // Get first 25
            const endTime = Date.now();
            
            console.log(`Gallery Retrieval Time: ${endTime - startTime}ms`);
            console.log(`Public NFTs Retrieved: ${publicNFTs.length}`);
            
            expect(publicNFTs.length).to.equal(25);
            expect(endTime - startTime).to.be.lessThan(5000); // Less than 5 seconds
        });
        
        it("Should handle large leaderboards efficiently", async function () {
            const userCount = users.length;
            
            // Give each user multiple NFTs with different scores
            for (let i = 0; i < userCount; i++) {
                const nftCount = Math.floor(Math.random() * 5) + 1; // 1-5 NFTs per user
                for (let j = 0; j < nftCount; j++) {
                    await carbonNFT.mintCarbonNFT(
                        users[i].address,
                        TOKEN_URI + `${i}_${j}`,
                        THEME,
                        GRADE_A - (j % 5),
                        800 + Math.floor(Math.random() * 200)
                    );
                }
            }
            
            // Test leaderboard performance
            const startTime = Date.now();
            const leaderboard = await community.getLeaderboard(userCount);
            const endTime = Date.now();
            
            console.log(`Leaderboard Retrieval Time: ${endTime - startTime}ms`);
            console.log(`Users in Leaderboard: ${leaderboard.length}`);
            
            expect(leaderboard.length).to.equal(userCount);
            expect(endTime - startTime).to.be.lessThan(3000); // Less than 3 seconds
            
            // Verify leaderboard is properly sorted
            for (let i = 1; i < leaderboard.length; i++) {
                expect(leaderboard[i-1].totalScore).to.be.gte(leaderboard[i].totalScore);
            }
        });
        
        it("Should handle large marketplace listings efficiently", async function () {
            const listingCount = 30;
            
            // Create many listings
            for (let i = 0; i < listingCount; i++) {
                await carbonNFT.mintCarbonNFT(
                    users[i % users.length].address,
                    TOKEN_URI + i,
                    THEME,
                    GRADE_A - (i % 5),
                    900 - (i * 10)
                );
                
                await carbonNFT.connect(users[i % users.length]).approve(marketplace.address, i);
                await marketplace.connect(users[i % users.length]).listNFT(
                    i,
                    ethers.utils.parseEther((0.05 + (i * 0.01)).toString())
                );
            }
            
            // Test marketplace listing retrieval
            const startTime = Date.now();
            const listings = await marketplace.getActiveListings(0, 20); // Get first 20
            const endTime = Date.now();
            
            console.log(`Marketplace Listings Retrieval Time: ${endTime - startTime}ms`);
            console.log(`Active Listings Retrieved: ${listings.length}`);
            
            expect(listings.length).to.equal(20);
            expect(endTime - startTime).to.be.lessThan(2000); // Less than 2 seconds
        });
    });
    
    describe("Memory and Storage Optimization", function () {
        it("Should use storage efficiently for NFT data", async function () {
            const user = users[0];
            
            // Mint NFT and check storage usage
            const tx = await carbonNFT.mintCarbonNFT(user.address, TOKEN_URI, THEME, GRADE_A, 900);
            const receipt = await tx.wait();
            
            // Check that storage operations are optimized
            // This is indicated by reasonable gas usage for storage operations
            expect(receipt.gasUsed.toNumber()).to.be.lessThan(GAS_LIMITS.NFT_MINT);
            
            // Verify data integrity
            const nftDetails = await carbonNFT.getNFTDetails(0);
            expect(nftDetails.grade).to.equal(GRADE_A);
            expect(nftDetails.carbonScore).to.equal(900);
            expect(nftDetails.theme).to.equal(THEME);
        });
        
        it("Should handle state updates efficiently", async function () {
            const user = users[0];
            
            // Mint NFT
            await carbonNFT.mintCarbonNFT(user.address, TOKEN_URI, THEME, GRADE_B, 750);
            const tokenId = 0;
            
            // Update grade multiple times and measure gas
            const gasUsages: number[] = [];
            const grades = [GRADE_A, GRADE_B, GRADE_C, GRADE_A];
            const scores = [900, 750, 600, 950];
            
            for (let i = 0; i < grades.length; i++) {
                const tx = await carbonNFT.updateNFTGrade(tokenId, grades[i], scores[i]);
                const receipt = await tx.wait();
                gasUsages.push(receipt.gasUsed.toNumber());
            }
            
            // Gas usage should remain consistent for updates
            const avgGas = gasUsages.reduce((a, b) => a + b, 0) / gasUsages.length;
            console.log(`Average Gas for Grade Updates: ${avgGas}`);
            
            gasUsages.forEach(gas => {
                expect(Math.abs(gas - avgGas)).to.be.lessThan(avgGas * 0.2); // Within 20% of average
            });
        });
    });
    
    describe("Concurrent Operations Performance", function () {
        it("Should handle concurrent marketplace operations", async function () {
            const concurrentOps = 5;
            
            // Mint NFTs for concurrent operations
            for (let i = 0; i < concurrentOps; i++) {
                await carbonNFT.mintCarbonNFT(users[i].address, TOKEN_URI + i, THEME, GRADE_A, 900);
            }
            
            // Perform concurrent listings
            const listingPromises = [];
            for (let i = 0; i < concurrentOps; i++) {
                const approvePromise = carbonNFT.connect(users[i]).approve(marketplace.address, i);
                listingPromises.push(
                    approvePromise.then(() =>
                        marketplace.connect(users[i]).listNFT(i, ethers.utils.parseEther("0.1"))
                    )
                );
            }
            
            const startTime = Date.now();
            await Promise.all(listingPromises);
            const endTime = Date.now();
            
            console.log(`Concurrent Listings Time: ${endTime - startTime}ms`);
            
            // Verify all listings were created
            const listings = await marketplace.getActiveListings(0, 10);
            expect(listings.length).to.equal(concurrentOps);
            
            // Should complete within reasonable time
            expect(endTime - startTime).to.be.lessThan(10000); // Less than 10 seconds
        });
        
        it("Should handle concurrent governance voting", async function () {
            const voterCount = 5;
            
            // Setup: Mint NFTs for voters and create proposal
            for (let i = 0; i < voterCount; i++) {
                await carbonNFT.mintCarbonNFT(users[i].address, TOKEN_URI + i, THEME, GRADE_A, 900);
            }
            
            const data = ethers.utils.defaultAbiCoder.encode(["uint256"], [300]);
            await governance.connect(users[0]).createProposal("Test proposal", 0, data);
            
            // Perform concurrent voting
            const votePromises = [];
            for (let i = 0; i < voterCount; i++) {
                votePromises.push(governance.connect(users[i]).vote(0, i % 2 === 0)); // Alternate votes
            }
            
            const startTime = Date.now();
            await Promise.all(votePromises);
            const endTime = Date.now();
            
            console.log(`Concurrent Voting Time: ${endTime - startTime}ms`);
            
            // Verify all votes were recorded
            const proposal = await governance.getProposal(0);
            expect(proposal.votesFor.add(proposal.votesAgainst)).to.equal(voterCount);
            
            // Should complete within reasonable time
            expect(endTime - startTime).to.be.lessThan(8000); // Less than 8 seconds
        });
    });
    
    describe("Gas Optimization Benchmarks", function () {
        it("Should provide gas usage benchmarks for all operations", async function () {
            const benchmarks: { [key: string]: number } = {};
            
            // NFT Operations
            const mintTx = await carbonNFT.mintCarbonNFT(users[0].address, TOKEN_URI, THEME, GRADE_A, 900);
            benchmarks['NFT_MINT'] = (await mintTx.wait()).gasUsed.toNumber();
            
            const updateTx = await carbonNFT.updateNFTGrade(0, GRADE_B, 750);
            benchmarks['NFT_UPDATE'] = (await updateTx.wait()).gasUsed.toNumber();
            
            const endorseTx = await carbonNFT.connect(users[1]).endorseNFT(0);
            benchmarks['NFT_ENDORSE'] = (await endorseTx.wait()).gasUsed.toNumber();
            
            // Community Operations
            const visibilityTx = await community.connect(users[0]).setNFTVisibility(0, true);
            benchmarks['COMMUNITY_VISIBILITY'] = (await visibilityTx.wait()).gasUsed.toNumber();
            
            // Marketplace Operations
            await carbonNFT.connect(users[0]).approve(marketplace.address, 0);
            const listTx = await marketplace.connect(users[0]).listNFT(0, ethers.utils.parseEther("0.1"));
            benchmarks['MARKETPLACE_LIST'] = (await listTx.wait()).gasUsed.toNumber();
            
            const buyTx = await marketplace.connect(users[1]).buyNFT(1, { value: ethers.utils.parseEther("0.1") });
            benchmarks['MARKETPLACE_BUY'] = (await buyTx.wait()).gasUsed.toNumber();
            
            // Governance Operations
            await carbonNFT.mintCarbonNFT(users[2].address, TOKEN_URI + "2", THEME, GRADE_A, 900);
            const data = ethers.utils.defaultAbiCoder.encode(["uint256"], [300]);
            const proposalTx = await governance.connect(users[2]).createProposal("Test", 0, data);
            benchmarks['GOVERNANCE_PROPOSAL'] = (await proposalTx.wait()).gasUsed.toNumber();
            
            const voteTx = await governance.connect(users[2]).vote(0, true);
            benchmarks['GOVERNANCE_VOTE'] = (await voteTx.wait()).gasUsed.toNumber();
            
            // Print benchmarks
            console.log("\n=== GAS USAGE BENCHMARKS ===");
            Object.entries(benchmarks).forEach(([operation, gas]) => {
                console.log(`${operation}: ${gas} gas`);
            });
            
            // Verify all operations are within limits
            expect(benchmarks['NFT_MINT']).to.be.lessThan(GAS_LIMITS.NFT_MINT);
            expect(benchmarks['MARKETPLACE_LIST']).to.be.lessThan(GAS_LIMITS.MARKETPLACE_LIST);
            expect(benchmarks['MARKETPLACE_BUY']).to.be.lessThan(GAS_LIMITS.MARKETPLACE_BUY);
            expect(benchmarks['COMMUNITY_VISIBILITY']).to.be.lessThan(GAS_LIMITS.COMMUNITY_VISIBILITY);
            expect(benchmarks['GOVERNANCE_PROPOSAL']).to.be.lessThan(GAS_LIMITS.GOVERNANCE_PROPOSAL);
            expect(benchmarks['GOVERNANCE_VOTE']).to.be.lessThan(GAS_LIMITS.GOVERNANCE_VOTE);
        });
    });
});