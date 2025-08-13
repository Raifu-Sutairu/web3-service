import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { CarbonNFT, Community, Marketplace, Governance } from "../../typechain-types";

describe("Contract Integration Tests", function () {
    let carbonNFT: CarbonNFT;
    let community: Community;
    let marketplace: Marketplace;
    let governance: Governance;
    
    let owner: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let user3: SignerWithAddress;
    
    const GRADE_A = 4;
    const GRADE_B = 3;
    const GRADE_C = 2;
    const INITIAL_SCORE = 800;
    const THEME = "renewable-energy";
    const TOKEN_URI = "ipfs://QmTest123";
    
    beforeEach(async function () {
        [owner, user1, user2, user3] = await ethers.getSigners();
        
        // Deploy CarbonNFT
        const CarbonNFTFactory = await ethers.getContractFactory("CarbonNFT");
        carbonNFT = await CarbonNFTFactory.deploy();
        await carbonNFT.deployed();
        
        // Deploy Community
        const CommunityFactory = await ethers.getContractFactory("Community");
        community = await CommunityFactory.deploy(carbonNFT.address);
        await community.deployed();
        
        // Deploy Marketplace
        const MarketplaceFactory = await ethers.getContractFactory("Marketplace");
        marketplace = await MarketplaceFactory.deploy(carbonNFT.address);
        await marketplace.deployed();
        
        // Deploy Governance
        const GovernanceFactory = await ethers.getContractFactory("Governance");
        governance = await GovernanceFactory.deploy(carbonNFT.address);
        await governance.deployed();
        
        // Register users
        await carbonNFT.connect(user1).registerUser(0); // Individual
        await carbonNFT.connect(user2).registerUser(0); // Individual
        await carbonNFT.connect(user3).registerUser(1); // Company
    });
    
    describe("Cross-Contract Communication", function () {
        it("Should allow Community to read NFT data from CarbonNFT", async function () {
            // Mint NFT
            await carbonNFT.mintCarbonNFT(user1.address, TOKEN_URI, THEME, GRADE_B, INITIAL_SCORE);
            const tokenId = 0;
            
            // Set NFT as public in Community
            await community.connect(user1).setNFTVisibility(tokenId, true);
            
            // Community should be able to read NFT data
            const publicNFTs = await community.getPublicNFTs(0, 10);
            expect(publicNFTs.length).to.equal(1);
            expect(publicNFTs[0].tokenId).to.equal(tokenId);
            expect(publicNFTs[0].owner).to.equal(user1.address);
            expect(publicNFTs[0].grade).to.equal(GRADE_B);
            expect(publicNFTs[0].carbonScore).to.equal(INITIAL_SCORE);
            expect(publicNFTs[0].theme).to.equal(THEME);
        });
        
        it("Should allow Marketplace to interact with CarbonNFT for trading", async function () {
            // Mint NFT
            await carbonNFT.mintCarbonNFT(user1.address, TOKEN_URI, THEME, GRADE_A, INITIAL_SCORE);
            const tokenId = 0;
            const listingPrice = ethers.utils.parseEther("0.1");
            
            // Approve marketplace to transfer NFT
            await carbonNFT.connect(user1).approve(marketplace.address, tokenId);
            
            // List NFT on marketplace
            await marketplace.connect(user1).listNFT(tokenId, listingPrice);
            
            // Verify NFT is held by marketplace
            expect(await carbonNFT.ownerOf(tokenId)).to.equal(marketplace.address);
            
            // Buy NFT
            await marketplace.connect(user2).buyNFT(1, { value: listingPrice });
            
            // Verify ownership transfer
            expect(await carbonNFT.ownerOf(tokenId)).to.equal(user2.address);
        });
        
        it("Should allow Governance to read NFT holder data for voting", async function () {
            // Mint NFTs for users
            await carbonNFT.mintCarbonNFT(user1.address, TOKEN_URI, THEME, GRADE_A, INITIAL_SCORE);
            await carbonNFT.mintCarbonNFT(user2.address, TOKEN_URI, THEME, GRADE_B, INITIAL_SCORE);
            
            // Check voting power
            expect(await governance.getVotingPower(user1.address)).to.equal(1);
            expect(await governance.getVotingPower(user2.address)).to.equal(1);
            expect(await governance.getVotingPower(user3.address)).to.equal(0);
            
            // Create proposal
            const description = "Update marketplace fee to 3%";
            const proposalType = 0; // MARKETPLACE_FEE
            const newFee = 300; // 3%
            const data = ethers.utils.defaultAbiCoder.encode(["uint256"], [newFee]);
            
            await governance.connect(user1).createProposal(description, proposalType, data);
            
            // Vote on proposal
            await governance.connect(user1).vote(0, true);
            await governance.connect(user2).vote(0, false);
            
            // Check votes
            const proposal = await governance.getProposal(0);
            expect(proposal.votesFor).to.equal(1);
            expect(proposal.votesAgainst).to.equal(1);
        });
    });
    
    describe("End-to-End User Workflows", function () {
        it("Should complete full user journey: register → mint → community → marketplace", async function () {
            // 1. User registration (already done in beforeEach)
            expect(await carbonNFT.isRegistered(user1.address)).to.be.true;
            
            // 2. Mint NFT
            await carbonNFT.mintCarbonNFT(user1.address, TOKEN_URI, THEME, GRADE_A, INITIAL_SCORE);
            const tokenId = 0;
            
            // 3. Set NFT visibility in community
            await community.connect(user1).setNFTVisibility(tokenId, true);
            
            // 4. Check community stats
            const stats = await community.getCommunityStats();
            expect(stats.totalUsers).to.equal(1);
            expect(stats.totalNFTs).to.equal(1);
            expect(stats.totalCarbonSaved).to.equal(INITIAL_SCORE);
            
            // 5. List NFT on marketplace
            const listingPrice = ethers.utils.parseEther("0.1");
            await carbonNFT.connect(user1).approve(marketplace.address, tokenId);
            await marketplace.connect(user1).listNFT(tokenId, listingPrice);
            
            // 6. Another user buys the NFT
            await marketplace.connect(user2).buyNFT(1, { value: listingPrice });
            
            // 7. Verify final state
            expect(await carbonNFT.ownerOf(tokenId)).to.equal(user2.address);
            
            // 8. New owner can interact with community
            await community.connect(user2).setNFTVisibility(tokenId, false);
            expect(await community.isNFTPublic(tokenId)).to.be.false;
        });
        
        it("Should complete governance workflow: proposal → voting → execution", async function () {
            // Setup: Mint NFTs for voting power
            await carbonNFT.mintCarbonNFT(user1.address, TOKEN_URI, THEME, GRADE_A, INITIAL_SCORE);
            await carbonNFT.mintCarbonNFT(user2.address, TOKEN_URI, THEME, GRADE_B, INITIAL_SCORE);
            await carbonNFT.mintCarbonNFT(user1.address, TOKEN_URI + "2", THEME, GRADE_A, INITIAL_SCORE);
            
            // 1. Create proposal to change marketplace fee
            const description = "Reduce marketplace fee to 2%";
            const proposalType = 0; // MARKETPLACE_FEE
            const newFee = 200; // 2%
            const data = ethers.utils.defaultAbiCoder.encode(["uint256"], [newFee]);
            
            await governance.connect(user1).createProposal(description, proposalType, data);
            
            // 2. Users vote (user1 has 2 NFTs, user2 has 1 NFT)
            await governance.connect(user1).vote(0, true);
            await governance.connect(user2).vote(0, true);
            
            // 3. Fast forward time to end voting period
            await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]); // 7 days + 1 second
            await ethers.provider.send("evm_mine", []);
            
            // 4. Execute proposal
            await governance.executeProposal(0);
            
            // 5. Verify execution
            const proposal = await governance.getProposal(0);
            expect(proposal.executed).to.be.true;
            expect(await governance.marketplaceFeePercentage()).to.equal(newFee);
        });
        
        it("Should handle complex multi-contract interactions", async function () {
            // Setup: Multiple users with NFTs
            await carbonNFT.mintCarbonNFT(user1.address, TOKEN_URI, THEME, GRADE_A, 900);
            await carbonNFT.mintCarbonNFT(user2.address, TOKEN_URI + "2", THEME, GRADE_B, 700);
            await carbonNFT.mintCarbonNFT(user3.address, TOKEN_URI + "3", THEME, GRADE_C, 500);
            
            // 1. Set community visibility
            await community.connect(user1).setNFTVisibility(0, true);
            await community.connect(user2).setNFTVisibility(1, true);
            await community.connect(user3).setNFTVisibility(2, false); // Private
            
            // 2. Check leaderboard
            const leaderboard = await community.getLeaderboard(10);
            expect(leaderboard.length).to.equal(3);
            expect(leaderboard[0].user).to.equal(user1.address); // Highest score
            expect(leaderboard[0].totalScore).to.equal(900);
            
            // 3. List some NFTs on marketplace
            await carbonNFT.connect(user1).approve(marketplace.address, 0);
            await marketplace.connect(user1).listNFT(0, ethers.utils.parseEther("0.2"));
            
            await carbonNFT.connect(user2).approve(marketplace.address, 1);
            await marketplace.connect(user2).listNFT(1, ethers.utils.parseEther("0.15"));
            
            // 4. Check marketplace listings
            const listings = await marketplace.getActiveListings(0, 10);
            expect(listings.length).to.equal(2);
            
            // 5. User endorses another's NFT (affects community stats)
            await carbonNFT.connect(user2).endorseNFT(0);
            
            // 6. Check updated community stats
            const updatedStats = await community.getCommunityStats();
            expect(updatedStats.totalNFTs).to.equal(3);
            expect(updatedStats.totalUsers).to.equal(3);
            
            // 7. Create governance proposal affecting marketplace
            const description = "Update royalty percentage";
            const proposalType = 0; // MARKETPLACE_FEE (reusing for test)
            const newRoyalty = 300; // 3%
            const data = ethers.utils.defaultAbiCoder.encode(["uint256"], [newRoyalty]);
            
            await governance.connect(user1).createProposal(description, proposalType, data);
            
            // All contracts are working together seamlessly
        });
    });
    
    describe("Error Handling and Edge Cases", function () {
        it("Should handle unauthorized access across contracts", async function () {
            // Mint NFT
            await carbonNFT.mintCarbonNFT(user1.address, TOKEN_URI, THEME, GRADE_A, INITIAL_SCORE);
            const tokenId = 0;
            
            // User2 cannot set visibility for user1's NFT
            await expect(
                community.connect(user2).setNFTVisibility(tokenId, true)
            ).to.be.revertedWithCustomError(community, "UnauthorizedAccess");
            
            // User2 cannot list user1's NFT without approval
            await expect(
                marketplace.connect(user2).listNFT(tokenId, ethers.utils.parseEther("0.1"))
            ).to.be.revertedWithCustomError(marketplace, "NotTokenOwner");
        });
        
        it("Should handle non-existent tokens across contracts", async function () {
            const nonExistentTokenId = 999;
            
            // Community should reject non-existent token
            await expect(
                community.connect(user1).setNFTVisibility(nonExistentTokenId, true)
            ).to.be.revertedWithCustomError(community, "TokenNotFound");
            
            // Marketplace should reject non-existent token
            await expect(
                marketplace.connect(user1).listNFT(nonExistentTokenId, ethers.utils.parseEther("0.1"))
            ).to.be.revertedWithCustomError(marketplace, "NotTokenOwner");
        });
        
        it("Should handle insufficient voting power in governance", async function () {
            // User without NFTs cannot create proposals
            await expect(
                governance.connect(user1).createProposal("Test proposal", 0, "0x")
            ).to.be.revertedWithCustomError(governance, "InsufficientVotingPower");
            
            // User without NFTs cannot vote
            await carbonNFT.mintCarbonNFT(user2.address, TOKEN_URI, THEME, GRADE_A, INITIAL_SCORE);
            await governance.connect(user2).createProposal("Test proposal", 0, "0x");
            
            await expect(
                governance.connect(user1).vote(0, true)
            ).to.be.revertedWithCustomError(governance, "InsufficientVotingPower");
        });
    });
    
    describe("Gas Optimization Tests", function () {
        it("Should efficiently handle batch operations", async function () {
            // Mint multiple NFTs
            const mintTxs = [];
            for (let i = 0; i < 5; i++) {
                const tx = await carbonNFT.mintCarbonNFT(
                    user1.address,
                    TOKEN_URI + i,
                    THEME,
                    GRADE_A,
                    INITIAL_SCORE + i * 100
                );
                mintTxs.push(tx);
            }
            
            // Check gas usage for community operations
            const visibilityTx = await community.connect(user1).setNFTVisibility(0, true);
            const receipt = await visibilityTx.wait();
            
            // Gas should be reasonable (less than 100k for simple operations)
            expect(receipt.gasUsed.toNumber()).to.be.lessThan(100000);
            
            // Batch read operations should be efficient
            const publicNFTs = await community.getPublicNFTs(0, 10);
            const leaderboard = await community.getLeaderboard(10);
            const stats = await community.getCommunityStats();
            
            // These should complete without timeout
            expect(publicNFTs).to.be.an('array');
            expect(leaderboard).to.be.an('array');
            expect(stats.totalNFTs).to.be.a('number');
        });
    });
});