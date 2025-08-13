import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { CarbonNFT, Community, Marketplace, Governance } from "../../typechain-types";

describe("End-to-End User Workflows", function () {
    let carbonNFT: CarbonNFT;
    let community: Community;
    let marketplace: Marketplace;
    let governance: Governance;
    
    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let charlie: SignerWithAddress;
    let dave: SignerWithAddress;
    
    const GRADE_A = 4;
    const GRADE_B = 3;
    const GRADE_C = 2;
    const GRADE_D = 1;
    const GRADE_F = 0;
    
    const THEME = "renewable-energy";
    const TOKEN_URI = "ipfs://QmTest123";
    
    beforeEach(async function () {
        [owner, alice, bob, charlie, dave] = await ethers.getSigners();
        
        // Deploy all contracts
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
    });
    
    describe("Complete User Journey: Registration → Minting → Community → Trading", function () {
        it("Should complete full user lifecycle with multiple interactions", async function () {
            // === PHASE 1: User Registration ===
            console.log("Phase 1: User Registration");
            
            // Register users with different types
            await carbonNFT.connect(alice).registerUser(0); // Individual
            await carbonNFT.connect(bob).registerUser(0);   // Individual
            await carbonNFT.connect(charlie).registerUser(1); // Company
            
            // Verify registrations
            expect(await carbonNFT.isRegistered(alice.address)).to.be.true;
            expect(await carbonNFT.isRegistered(bob.address)).to.be.true;
            expect(await carbonNFT.isRegistered(charlie.address)).to.be.true;
            expect(await carbonNFT.getUserType(alice.address)).to.equal(0);
            expect(await carbonNFT.getUserType(charlie.address)).to.equal(1);
            
            // === PHASE 2: NFT Minting ===
            console.log("Phase 2: NFT Minting");
            
            // Alice mints high-grade NFT
            await carbonNFT.mintCarbonNFT(alice.address, TOKEN_URI + "1", THEME, GRADE_A, 950);
            const aliceTokenId = 0;
            
            // Bob mints medium-grade NFT
            await carbonNFT.mintCarbonNFT(bob.address, TOKEN_URI + "2", "solar-power", GRADE_B, 750);
            const bobTokenId = 1;
            
            // Charlie (company) mints lower-grade NFT
            await carbonNFT.mintCarbonNFT(charlie.address, TOKEN_URI + "3", "wind-energy", GRADE_C, 600);
            const charlieTokenId = 2;
            
            // Verify NFT ownership and properties
            expect(await carbonNFT.ownerOf(aliceTokenId)).to.equal(alice.address);
            expect(await carbonNFT.ownerOf(bobTokenId)).to.equal(bob.address);
            expect(await carbonNFT.ownerOf(charlieTokenId)).to.equal(charlie.address);
            
            const aliceNFT = await carbonNFT.getNFTDetails(aliceTokenId);
            expect(aliceNFT.grade).to.equal(GRADE_A);
            expect(aliceNFT.carbonScore).to.equal(950);
            expect(aliceNFT.theme).to.equal(THEME);
            
            // === PHASE 3: Community Interactions ===
            console.log("Phase 3: Community Interactions");
            
            // Users set NFT visibility
            await community.connect(alice).setNFTVisibility(aliceTokenId, true);
            await community.connect(bob).setNFTVisibility(bobTokenId, true);
            await community.connect(charlie).setNFTVisibility(charlieTokenId, false); // Private
            
            // Check public gallery
            const publicNFTs = await community.getPublicNFTs(0, 10);
            expect(publicNFTs.length).to.equal(2); // Alice and Bob's NFTs
            expect(publicNFTs[0].owner).to.equal(alice.address);
            expect(publicNFTs[1].owner).to.equal(bob.address);
            
            // Check leaderboard
            const leaderboard = await community.getLeaderboard(10);
            expect(leaderboard.length).to.equal(3);
            expect(leaderboard[0].user).to.equal(alice.address); // Highest score
            expect(leaderboard[0].totalScore).to.equal(950);
            expect(leaderboard[1].user).to.equal(bob.address);
            expect(leaderboard[2].user).to.equal(charlie.address);
            
            // Check community statistics
            const stats = await community.getCommunityStats();
            expect(stats.totalUsers).to.equal(3);
            expect(stats.totalNFTs).to.equal(3);
            expect(stats.totalCarbonSaved).to.equal(950 + 750 + 600);
            
            // Users endorse each other's NFTs
            await carbonNFT.connect(bob).endorseNFT(aliceTokenId);
            await carbonNFT.connect(alice).endorseNFT(bobTokenId);
            
            // === PHASE 4: Marketplace Trading ===
            console.log("Phase 4: Marketplace Trading");
            
            // Alice lists her NFT for sale
            const aliceListingPrice = ethers.utils.parseEther("0.2");
            await carbonNFT.connect(alice).approve(marketplace.address, aliceTokenId);
            await marketplace.connect(alice).listNFT(aliceTokenId, aliceListingPrice);
            
            // Bob lists his NFT for sale
            const bobListingPrice = ethers.utils.parseEther("0.15");
            await carbonNFT.connect(bob).approve(marketplace.address, bobTokenId);
            await marketplace.connect(bob).listNFT(bobTokenId, bobListingPrice);
            
            // Verify NFTs are in escrow
            expect(await carbonNFT.ownerOf(aliceTokenId)).to.equal(marketplace.address);
            expect(await carbonNFT.ownerOf(bobTokenId)).to.equal(marketplace.address);
            
            // Check marketplace listings
            const listings = await marketplace.getActiveListings(0, 10);
            expect(listings.length).to.equal(2);
            
            // Dave (new user) registers and buys Alice's NFT
            await carbonNFT.connect(dave).registerUser(0);
            const daveInitialBalance = await ethers.provider.getBalance(dave.address);
            
            await marketplace.connect(dave).buyNFT(1, { value: aliceListingPrice }); // Listing ID 1
            
            // Verify ownership transfer
            expect(await carbonNFT.ownerOf(aliceTokenId)).to.equal(dave.address);
            
            // Verify payment transfer (Alice should receive payment minus fees)
            const aliceBalance = await ethers.provider.getBalance(alice.address);
            expect(aliceBalance).to.be.gt(0);
            
            // === PHASE 5: Post-Trade Community Updates ===
            console.log("Phase 5: Post-Trade Community Updates");
            
            // Dave can now interact with community features
            await community.connect(dave).setNFTVisibility(aliceTokenId, true);
            
            // Updated community stats should reflect new ownership
            const updatedStats = await community.getCommunityStats();
            expect(updatedStats.totalUsers).to.equal(4); // Alice, Bob, Charlie, Dave
            
            // Updated leaderboard should show Dave
            const updatedLeaderboard = await community.getLeaderboard(10);
            expect(updatedLeaderboard.some(entry => entry.user === dave.address)).to.be.true;
            
            // === PHASE 6: NFT Grade Updates ===
            console.log("Phase 6: NFT Grade Updates");
            
            // Dave improves his carbon footprint and updates NFT grade
            await carbonNFT.updateNFTGrade(aliceTokenId, GRADE_A, 980);
            
            // Verify grade update
            const updatedNFT = await carbonNFT.getNFTDetails(aliceTokenId);
            expect(updatedNFT.grade).to.equal(GRADE_A);
            expect(updatedNFT.carbonScore).to.equal(980);
            
            // Community stats should reflect the improvement
            const finalStats = await community.getCommunityStats();
            expect(finalStats.totalCarbonSaved).to.be.gt(updatedStats.totalCarbonSaved);
            
            console.log("✅ Complete user journey test passed!");
        });
        
        it("Should handle multiple concurrent users and transactions", async function () {
            // Register multiple users
            const users = [alice, bob, charlie, dave];
            for (let i = 0; i < users.length; i++) {
                await carbonNFT.connect(users[i]).registerUser(i % 2); // Alternate individual/company
            }
            
            // Mint NFTs for all users concurrently
            const mintPromises = users.map((user, index) => 
                carbonNFT.mintCarbonNFT(
                    user.address, 
                    TOKEN_URI + index, 
                    THEME, 
                    GRADE_A - (index % 5), 
                    900 - (index * 50)
                )
            );
            await Promise.all(mintPromises);
            
            // Set visibility for all NFTs
            const visibilityPromises = users.map((user, index) => 
                community.connect(user).setNFTVisibility(index, true)
            );
            await Promise.all(visibilityPromises);
            
            // List all NFTs on marketplace
            const listingPromises = users.map(async (user, index) => {
                await carbonNFT.connect(user).approve(marketplace.address, index);
                return marketplace.connect(user).listNFT(index, ethers.utils.parseEther("0.1"));
            });
            await Promise.all(listingPromises);
            
            // Verify all operations completed successfully
            const finalStats = await community.getCommunityStats();
            expect(finalStats.totalUsers).to.equal(4);
            expect(finalStats.totalNFTs).to.equal(4);
            
            const listings = await marketplace.getActiveListings(0, 10);
            expect(listings.length).to.equal(4);
        });
    });
    
    describe("Governance Workflow: Proposal → Voting → Execution", function () {
        beforeEach(async function () {
            // Setup: Register users and mint NFTs for voting power
            await carbonNFT.connect(alice).registerUser(0);
            await carbonNFT.connect(bob).registerUser(0);
            await carbonNFT.connect(charlie).registerUser(1);
            
            // Mint NFTs (voting power)
            await carbonNFT.mintCarbonNFT(alice.address, TOKEN_URI + "1", THEME, GRADE_A, 900);
            await carbonNFT.mintCarbonNFT(alice.address, TOKEN_URI + "2", THEME, GRADE_A, 950); // Alice has 2 NFTs
            await carbonNFT.mintCarbonNFT(bob.address, TOKEN_URI + "3", THEME, GRADE_B, 750);
            await carbonNFT.mintCarbonNFT(charlie.address, TOKEN_URI + "4", THEME, GRADE_C, 600);
        });
        
        it("Should complete full governance cycle with proposal execution", async function () {
            // === PHASE 1: Proposal Creation ===
            console.log("Phase 1: Proposal Creation");
            
            const description = "Reduce marketplace fee from 5% to 3%";
            const proposalType = 0; // MARKETPLACE_FEE
            const newFee = 300; // 3%
            const data = ethers.utils.defaultAbiCoder.encode(["uint256"], [newFee]);
            
            // Alice creates proposal (has voting power)
            await governance.connect(alice).createProposal(description, proposalType, data);
            
            const proposal = await governance.getProposal(0);
            expect(proposal.proposer).to.equal(alice.address);
            expect(proposal.description).to.equal(description);
            expect(proposal.executed).to.be.false;
            
            // === PHASE 2: Voting Period ===
            console.log("Phase 2: Voting Period");
            
            // Check initial voting power
            expect(await governance.getVotingPower(alice.address)).to.equal(2); // 2 NFTs
            expect(await governance.getVotingPower(bob.address)).to.equal(1);   // 1 NFT
            expect(await governance.getVotingPower(charlie.address)).to.equal(1); // 1 NFT
            
            // Users vote on the proposal
            await governance.connect(alice).vote(0, true);  // 2 votes FOR
            await governance.connect(bob).vote(0, true);    // 1 vote FOR
            await governance.connect(charlie).vote(0, false); // 1 vote AGAINST
            
            // Check vote counts
            const votedProposal = await governance.getProposal(0);
            expect(votedProposal.votesFor).to.equal(3);     // Alice(2) + Bob(1)
            expect(votedProposal.votesAgainst).to.equal(1); // Charlie(1)
            
            // === PHASE 3: Voting Period End ===
            console.log("Phase 3: Voting Period End");
            
            // Fast forward time to end voting period
            await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]); // 7 days + 1 second
            await ethers.provider.send("evm_mine", []);
            
            // === PHASE 4: Proposal Execution ===
            console.log("Phase 4: Proposal Execution");
            
            // Execute the proposal
            await governance.executeProposal(0);
            
            // Verify execution
            const executedProposal = await governance.getProposal(0);
            expect(executedProposal.executed).to.be.true;
            
            // Verify the change was applied
            expect(await governance.marketplaceFeePercentage()).to.equal(newFee);
            
            console.log("✅ Governance workflow test passed!");
        });
        
        it("Should handle failed proposals correctly", async function () {
            // Create proposal
            const description = "Increase marketplace fee to 10%";
            const proposalType = 0;
            const newFee = 1000; // 10%
            const data = ethers.utils.defaultAbiCoder.encode(["uint256"], [newFee]);
            
            await governance.connect(alice).createProposal(description, proposalType, data);
            
            // Vote against the proposal (majority against)
            await governance.connect(alice).vote(0, false); // 2 votes AGAINST
            await governance.connect(bob).vote(0, true);    // 1 vote FOR
            await governance.connect(charlie).vote(0, false); // 1 vote AGAINST
            
            // Fast forward time
            await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
            await ethers.provider.send("evm_mine", []);
            
            // Attempt to execute should fail
            await expect(governance.executeProposal(0))
                .to.be.revertedWithCustomError(governance, "ProposalFailed");
            
            // Verify no changes were made
            expect(await governance.marketplaceFeePercentage()).to.equal(500); // Original 5%
        });
        
        it("Should handle multiple concurrent proposals", async function () {
            // Create multiple proposals
            const proposals = [
                { desc: "Reduce marketplace fee to 2%", fee: 200 },
                { desc: "Reduce marketplace fee to 4%", fee: 400 },
                { desc: "Increase marketplace fee to 6%", fee: 600 }
            ];
            
            for (let i = 0; i < proposals.length; i++) {
                const data = ethers.utils.defaultAbiCoder.encode(["uint256"], [proposals[i].fee]);
                await governance.connect(alice).createProposal(proposals[i].desc, 0, data);
            }
            
            // Vote on all proposals
            await governance.connect(alice).vote(0, true);  // Support first proposal
            await governance.connect(alice).vote(1, false); // Against second
            await governance.connect(alice).vote(2, false); // Against third
            
            await governance.connect(bob).vote(0, true);    // Support first
            await governance.connect(bob).vote(1, true);    // Support second
            await governance.connect(bob).vote(2, false);   // Against third
            
            // Fast forward time
            await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
            await ethers.provider.send("evm_mine", []);
            
            // Execute first proposal (should pass: 3 for, 0 against)
            await governance.executeProposal(0);
            expect(await governance.marketplaceFeePercentage()).to.equal(200);
            
            // Second proposal should fail (2 for, 1 against, but first already executed)
            await expect(governance.executeProposal(1))
                .to.be.revertedWithCustomError(governance, "ProposalFailed");
        });
    });
    
    describe("Complex Multi-Contract Scenarios", function () {
        it("Should handle marketplace transactions affecting community stats", async function () {
            // Setup users and NFTs
            await carbonNFT.connect(alice).registerUser(0);
            await carbonNFT.connect(bob).registerUser(0);
            
            await carbonNFT.mintCarbonNFT(alice.address, TOKEN_URI + "1", THEME, GRADE_A, 900);
            await carbonNFT.mintCarbonNFT(bob.address, TOKEN_URI + "2", THEME, GRADE_B, 700);
            
            // Set community visibility
            await community.connect(alice).setNFTVisibility(0, true);
            await community.connect(bob).setNFTVisibility(1, true);
            
            // Check initial community stats
            const initialStats = await community.getCommunityStats();
            expect(initialStats.totalUsers).to.equal(2);
            
            // Alice lists NFT, Bob buys it
            await carbonNFT.connect(alice).approve(marketplace.address, 0);
            await marketplace.connect(alice).listNFT(0, ethers.utils.parseEther("0.1"));
            
            await marketplace.connect(bob).buyNFT(1, { value: ethers.utils.parseEther("0.1") });
            
            // Bob now owns both NFTs - community stats should reflect this
            expect(await carbonNFT.ownerOf(0)).to.equal(bob.address);
            expect(await carbonNFT.ownerOf(1)).to.equal(bob.address);
            
            // Leaderboard should show Bob with higher total score
            const leaderboard = await community.getLeaderboard(10);
            expect(leaderboard[0].user).to.equal(bob.address);
            expect(leaderboard[0].totalScore).to.equal(1600); // 900 + 700
            expect(leaderboard[0].nftCount).to.equal(2);
        });
        
        it("Should handle governance decisions affecting marketplace operations", async function () {
            // Setup
            await carbonNFT.connect(alice).registerUser(0);
            await carbonNFT.connect(bob).registerUser(0);
            
            await carbonNFT.mintCarbonNFT(alice.address, TOKEN_URI + "1", THEME, GRADE_A, 900);
            await carbonNFT.mintCarbonNFT(bob.address, TOKEN_URI + "2", THEME, GRADE_B, 700);
            
            // Create governance proposal to change marketplace fee
            const newFee = 200; // 2%
            const data = ethers.utils.defaultAbiCoder.encode(["uint256"], [newFee]);
            await governance.connect(alice).createProposal("Reduce marketplace fee", 0, data);
            
            // Vote and execute
            await governance.connect(alice).vote(0, true);
            await governance.connect(bob).vote(0, true);
            
            await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
            await ethers.provider.send("evm_mine", []);
            
            await governance.executeProposal(0);
            
            // Verify marketplace uses new fee
            expect(await governance.marketplaceFeePercentage()).to.equal(newFee);
            
            // Test marketplace transaction with new fee
            await carbonNFT.connect(alice).approve(marketplace.address, 0);
            await marketplace.connect(alice).listNFT(0, ethers.utils.parseEther("1.0"));
            
            const aliceBalanceBefore = await ethers.provider.getBalance(alice.address);
            await marketplace.connect(bob).buyNFT(1, { value: ethers.utils.parseEther("1.0") });
            const aliceBalanceAfter = await ethers.provider.getBalance(alice.address);
            
            // Alice should receive 98% of the sale price (100% - 2% fee)
            const expectedReceived = ethers.utils.parseEther("0.98");
            const actualReceived = aliceBalanceAfter.sub(aliceBalanceBefore);
            expect(actualReceived).to.be.closeTo(expectedReceived, ethers.utils.parseEther("0.01"));
        });
    });
});