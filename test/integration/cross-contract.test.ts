import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { CarbonNFT, Community, Marketplace, Governance } from "../../typechain-types";

describe("Cross-Contract Interaction Tests", function () {
    let carbonNFT: CarbonNFT;
    let community: Community;
    let marketplace: Marketplace;
    let governance: Governance;
    
    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let charlie: SignerWithAddress;
    
    const GRADE_A = 4;
    const GRADE_B = 3;
    const GRADE_C = 2;
    const THEME = "renewable-energy";
    const TOKEN_URI = "ipfs://QmTest123";
    
    beforeEach(async function () {
        [owner, alice, bob, charlie] = await ethers.getSigners();
        
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
        await carbonNFT.connect(alice).registerUser(0);
        await carbonNFT.connect(bob).registerUser(0);
        await carbonNFT.connect(charlie).registerUser(1);
    });
    
    describe("Community ↔ CarbonNFT Interactions", function () {
        it("Should read NFT data correctly from CarbonNFT contract", async function () {
            // Mint NFTs with different grades and scores
            await carbonNFT.mintCarbonNFT(alice.address, TOKEN_URI + "1", THEME, GRADE_A, 950);
            await carbonNFT.mintCarbonNFT(bob.address, TOKEN_URI + "2", "solar-power", GRADE_B, 750);
            await carbonNFT.mintCarbonNFT(charlie.address, TOKEN_URI + "3", "wind-energy", GRADE_C, 600);
            
            // Set visibility
            await community.connect(alice).setNFTVisibility(0, true);
            await community.connect(bob).setNFTVisibility(1, true);
            await community.connect(charlie).setNFTVisibility(2, false); // Private
            
            // Test public NFT gallery
            const publicNFTs = await community.getPublicNFTs(0, 10);
            expect(publicNFTs.length).to.equal(2);
            
            // Verify Alice's NFT data
            const aliceNFT = publicNFTs.find(nft => nft.owner === alice.address);
            expect(aliceNFT).to.exist;
            expect(aliceNFT!.tokenId).to.equal(0);
            expect(aliceNFT!.grade).to.equal(GRADE_A);
            expect(aliceNFT!.carbonScore).to.equal(950);
            expect(aliceNFT!.theme).to.equal(THEME);
            expect(aliceNFT!.isPublic).to.be.true;
            
            // Verify Bob's NFT data
            const bobNFT = publicNFTs.find(nft => nft.owner === bob.address);
            expect(bobNFT).to.exist;
            expect(bobNFT!.tokenId).to.equal(1);
            expect(bobNFT!.grade).to.equal(GRADE_B);
            expect(bobNFT!.carbonScore).to.equal(750);
            expect(bobNFT!.theme).to.equal("solar-power");
            
            // Charlie's NFT should not appear (private)
            const charlieNFT = publicNFTs.find(nft => nft.owner === charlie.address);
            expect(charlieNFT).to.be.undefined;
        });
        
        it("Should generate accurate leaderboard from NFT data", async function () {
            // Mint multiple NFTs for users
            await carbonNFT.mintCarbonNFT(alice.address, TOKEN_URI + "1", THEME, GRADE_A, 950);
            await carbonNFT.mintCarbonNFT(alice.address, TOKEN_URI + "2", THEME, GRADE_A, 900);
            await carbonNFT.mintCarbonNFT(bob.address, TOKEN_URI + "3", THEME, GRADE_B, 800);
            await carbonNFT.mintCarbonNFT(charlie.address, TOKEN_URI + "4", THEME, GRADE_C, 600);
            
            // Get leaderboard
            const leaderboard = await community.getLeaderboard(10);
            expect(leaderboard.length).to.equal(3);
            
            // Verify ranking (Alice should be first with highest total score)
            expect(leaderboard[0].user).to.equal(alice.address);
            expect(leaderboard[0].totalScore).to.equal(1850); // 950 + 900
            expect(leaderboard[0].nftCount).to.equal(2);
            expect(leaderboard[0].averageGrade).to.equal(GRADE_A);
            
            expect(leaderboard[1].user).to.equal(bob.address);
            expect(leaderboard[1].totalScore).to.equal(800);
            expect(leaderboard[1].nftCount).to.equal(1);
            
            expect(leaderboard[2].user).to.equal(charlie.address);
            expect(leaderboard[2].totalScore).to.equal(600);
            expect(leaderboard[2].nftCount).to.equal(1);
        });
        
        it("Should update community stats when NFT grades change", async function () {
            // Mint NFTs
            await carbonNFT.mintCarbonNFT(alice.address, TOKEN_URI + "1", THEME, GRADE_B, 750);
            await carbonNFT.mintCarbonNFT(bob.address, TOKEN_URI + "2", THEME, GRADE_C, 600);
            
            // Check initial stats
            const initialStats = await community.getCommunityStats();
            expect(initialStats.totalCarbonSaved).to.equal(1350); // 750 + 600
            
            // Update Alice's NFT grade
            await carbonNFT.updateNFTGrade(0, GRADE_A, 950);
            
            // Check updated stats
            const updatedStats = await community.getCommunityStats();
            expect(updatedStats.totalCarbonSaved).to.equal(1550); // 950 + 600
        });
        
        it("Should handle endorsements correctly", async function () {
            // Mint NFTs
            await carbonNFT.mintCarbonNFT(alice.address, TOKEN_URI + "1", THEME, GRADE_A, 900);
            await carbonNFT.mintCarbonNFT(bob.address, TOKEN_URI + "2", THEME, GRADE_B, 750);
            
            // Set visibility
            await community.connect(alice).setNFTVisibility(0, true);
            await community.connect(bob).setNFTVisibility(1, true);
            
            // Bob endorses Alice's NFT
            await carbonNFT.connect(bob).endorseNFT(0);
            
            // Check endorsement count in community view
            const publicNFTs = await community.getPublicNFTs(0, 10);
            const aliceNFT = publicNFTs.find(nft => nft.owner === alice.address);
            expect(aliceNFT!.endorsements).to.equal(1);
            
            // Alice endorses Bob's NFT
            await carbonNFT.connect(alice).endorseNFT(1);
            
            const updatedNFTs = await community.getPublicNFTs(0, 10);
            const bobNFT = updatedNFTs.find(nft => nft.owner === bob.address);
            expect(bobNFT!.endorsements).to.equal(1);
        });
    });
    
    describe("Marketplace ↔ CarbonNFT Interactions", function () {
        it("Should handle NFT escrow and ownership transfers correctly", async function () {
            // Mint NFT
            await carbonNFT.mintCarbonNFT(alice.address, TOKEN_URI, THEME, GRADE_A, 900);
            const tokenId = 0;
            
            // Verify initial ownership
            expect(await carbonNFT.ownerOf(tokenId)).to.equal(alice.address);
            
            // Approve and list NFT
            await carbonNFT.connect(alice).approve(marketplace.address, tokenId);
            const listingPrice = ethers.utils.parseEther("0.1");
            await marketplace.connect(alice).listNFT(tokenId, listingPrice);
            
            // Verify NFT is held by marketplace (escrow)
            expect(await carbonNFT.ownerOf(tokenId)).to.equal(marketplace.address);
            
            // Bob buys the NFT
            await marketplace.connect(bob).buyNFT(1, { value: listingPrice });
            
            // Verify ownership transfer to Bob
            expect(await carbonNFT.ownerOf(tokenId)).to.equal(bob.address);
        });
        
        it("Should calculate grade-based pricing suggestions", async function () {
            // Mint NFTs with different grades
            await carbonNFT.mintCarbonNFT(alice.address, TOKEN_URI + "1", THEME, GRADE_A, 950);
            await carbonNFT.mintCarbonNFT(bob.address, TOKEN_URI + "2", THEME, GRADE_B, 750);
            await carbonNFT.mintCarbonNFT(charlie.address, TOKEN_URI + "3", THEME, GRADE_C, 600);
            
            // Get pricing suggestions
            const gradeAPrice = await marketplace.getSuggestedPrice(0);
            const gradeBPrice = await marketplace.getSuggestedPrice(1);
            const gradeCPrice = await marketplace.getSuggestedPrice(2);
            
            // Higher grades should have higher suggested prices
            expect(gradeAPrice).to.be.gt(gradeBPrice);
            expect(gradeBPrice).to.be.gt(gradeCPrice);
            
            // Verify reasonable price ranges
            expect(gradeAPrice).to.be.gte(ethers.utils.parseEther("0.08")); // Grade A minimum
            expect(gradeCPrice).to.be.lte(ethers.utils.parseEther("0.06")); // Grade C maximum
        });
        
        it("Should handle royalty distribution correctly", async function () {
            // Mint NFT
            await carbonNFT.mintCarbonNFT(alice.address, TOKEN_URI, THEME, GRADE_A, 900);
            const tokenId = 0;
            
            // List NFT
            await carbonNFT.connect(alice).approve(marketplace.address, tokenId);
            const salePrice = ethers.utils.parseEther("1.0");
            await marketplace.connect(alice).listNFT(tokenId, salePrice);
            
            // Record balances before sale
            const aliceBalanceBefore = await ethers.provider.getBalance(alice.address);
            const marketplaceBalanceBefore = await ethers.provider.getBalance(marketplace.address);
            
            // Bob buys NFT
            await marketplace.connect(bob).buyNFT(1, { value: salePrice });
            
            // Check balances after sale
            const aliceBalanceAfter = await ethers.provider.getBalance(alice.address);
            const marketplaceBalanceAfter = await ethers.provider.getBalance(marketplace.address);
            
            // Alice should receive sale price minus marketplace fee
            const marketplaceFee = await governance.marketplaceFeePercentage(); // Default 5%
            const expectedAliceReceived = salePrice.mul(10000 - marketplaceFee).div(10000);
            const actualAliceReceived = aliceBalanceAfter.sub(aliceBalanceBefore);
            
            expect(actualAliceReceived).to.be.closeTo(expectedAliceReceived, ethers.utils.parseEther("0.01"));
            
            // Marketplace should receive the fee
            const expectedMarketplaceFee = salePrice.mul(marketplaceFee).div(10000);
            const actualMarketplaceFee = marketplaceBalanceAfter.sub(marketplaceBalanceBefore);
            
            expect(actualMarketplaceFee).to.be.closeTo(expectedMarketplaceFee, ethers.utils.parseEther("0.01"));
        });
        
        it("Should handle listing cancellation and NFT return", async function () {
            // Mint and list NFT
            await carbonNFT.mintCarbonNFT(alice.address, TOKEN_URI, THEME, GRADE_A, 900);
            const tokenId = 0;
            
            await carbonNFT.connect(alice).approve(marketplace.address, tokenId);
            await marketplace.connect(alice).listNFT(tokenId, ethers.utils.parseEther("0.1"));
            
            // Verify NFT is in escrow
            expect(await carbonNFT.ownerOf(tokenId)).to.equal(marketplace.address);
            
            // Cancel listing
            await marketplace.connect(alice).cancelListing(tokenId);
            
            // Verify NFT is returned to Alice
            expect(await carbonNFT.ownerOf(tokenId)).to.equal(alice.address);
            
            // Verify listing is no longer active
            const listings = await marketplace.getActiveListings(0, 10);
            expect(listings.length).to.equal(0);
        });
    });
    
    describe("Governance ↔ CarbonNFT Interactions", function () {
        it("Should calculate voting power based on NFT ownership", async function () {
            // Initially no voting power
            expect(await governance.getVotingPower(alice.address)).to.equal(0);
            expect(await governance.getVotingPower(bob.address)).to.equal(0);
            
            // Mint NFTs
            await carbonNFT.mintCarbonNFT(alice.address, TOKEN_URI + "1", THEME, GRADE_A, 900);
            await carbonNFT.mintCarbonNFT(alice.address, TOKEN_URI + "2", THEME, GRADE_B, 750);
            await carbonNFT.mintCarbonNFT(bob.address, TOKEN_URI + "3", THEME, GRADE_C, 600);
            
            // Check voting power
            expect(await governance.getVotingPower(alice.address)).to.equal(2); // 2 NFTs
            expect(await governance.getVotingPower(bob.address)).to.equal(1);   // 1 NFT
            expect(await governance.getVotingPower(charlie.address)).to.equal(0); // 0 NFTs
        });
        
        it("Should update voting power when NFTs are transferred", async function () {
            // Mint NFT for Alice
            await carbonNFT.mintCarbonNFT(alice.address, TOKEN_URI, THEME, GRADE_A, 900);
            const tokenId = 0;
            
            // Check initial voting power
            expect(await governance.getVotingPower(alice.address)).to.equal(1);
            expect(await governance.getVotingPower(bob.address)).to.equal(0);
            
            // Transfer NFT to Bob
            await carbonNFT.connect(alice).transferFrom(alice.address, bob.address, tokenId);
            
            // Check updated voting power
            expect(await governance.getVotingPower(alice.address)).to.equal(0);
            expect(await governance.getVotingPower(bob.address)).to.equal(1);
        });
        
        it("Should prevent non-NFT holders from creating proposals", async function () {
            // Charlie has no NFTs
            expect(await governance.getVotingPower(charlie.address)).to.equal(0);
            
            // Should not be able to create proposal
            await expect(
                governance.connect(charlie).createProposal("Test proposal", 0, "0x")
            ).to.be.revertedWithCustomError(governance, "InsufficientVotingPower");
            
            // Mint NFT for Charlie
            await carbonNFT.mintCarbonNFT(charlie.address, TOKEN_URI, THEME, GRADE_A, 900);
            
            // Now should be able to create proposal
            await expect(
                governance.connect(charlie).createProposal("Test proposal", 0, "0x")
            ).to.not.be.reverted;
        });
        
        it("Should prevent double voting on same proposal", async function () {
            // Setup: Mint NFT and create proposal
            await carbonNFT.mintCarbonNFT(alice.address, TOKEN_URI + "1", THEME, GRADE_A, 900);
            await carbonNFT.mintCarbonNFT(bob.address, TOKEN_URI + "2", THEME, GRADE_B, 750);
            
            await governance.connect(alice).createProposal("Test proposal", 0, "0x");
            
            // Alice votes
            await governance.connect(alice).vote(0, true);
            
            // Alice tries to vote again - should fail
            await expect(
                governance.connect(alice).vote(0, false)
            ).to.be.revertedWithCustomError(governance, "AlreadyVoted");
            
            // Bob can still vote
            await expect(
                governance.connect(bob).vote(0, true)
            ).to.not.be.reverted;
        });
    });
    
    describe("Multi-Contract State Consistency", function () {
        it("Should maintain consistent state across all contracts during complex operations", async function () {
            // Setup: Mint NFTs for multiple users
            await carbonNFT.mintCarbonNFT(alice.address, TOKEN_URI + "1", THEME, GRADE_A, 900);
            await carbonNFT.mintCarbonNFT(bob.address, TOKEN_URI + "2", THEME, GRADE_B, 750);
            
            // Set community visibility
            await community.connect(alice).setNFTVisibility(0, true);
            await community.connect(bob).setNFTVisibility(1, true);
            
            // Create governance proposal
            const newFee = 300;
            const data = ethers.utils.defaultAbiCoder.encode(["uint256"], [newFee]);
            await governance.connect(alice).createProposal("Reduce fee", 0, data);
            
            // Vote on proposal
            await governance.connect(alice).vote(0, true);
            await governance.connect(bob).vote(0, true);
            
            // List NFT on marketplace
            await carbonNFT.connect(alice).approve(marketplace.address, 0);
            await marketplace.connect(alice).listNFT(0, ethers.utils.parseEther("0.1"));
            
            // Execute governance proposal
            await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
            await ethers.provider.send("evm_mine", []);
            await governance.executeProposal(0);
            
            // Buy NFT (should use new fee)
            await marketplace.connect(bob).buyNFT(1, { value: ethers.utils.parseEther("0.1") });
            
            // Verify state consistency across all contracts
            
            // CarbonNFT: Bob should own Alice's NFT
            expect(await carbonNFT.ownerOf(0)).to.equal(bob.address);
            
            // Community: Leaderboard should reflect Bob owning both NFTs
            const leaderboard = await community.getLeaderboard(10);
            expect(leaderboard[0].user).to.equal(bob.address);
            expect(leaderboard[0].nftCount).to.equal(2);
            expect(leaderboard[0].totalScore).to.equal(1650); // 900 + 750
            
            // Governance: New fee should be active
            expect(await governance.marketplaceFeePercentage()).to.equal(newFee);
            
            // Marketplace: No active listings
            const listings = await marketplace.getActiveListings(0, 10);
            expect(listings.length).to.equal(0);
        });
        
        it("Should handle contract failures gracefully without corrupting state", async function () {
            // Mint NFT
            await carbonNFT.mintCarbonNFT(alice.address, TOKEN_URI, THEME, GRADE_A, 900);
            const tokenId = 0;
            
            // Set community visibility
            await community.connect(alice).setNFTVisibility(tokenId, true);
            
            // Try to list NFT without approval (should fail)
            await expect(
                marketplace.connect(alice).listNFT(tokenId, ethers.utils.parseEther("0.1"))
            ).to.be.revertedWithCustomError(marketplace, "NotApprovedOrOwner");
            
            // Verify states are unchanged
            expect(await carbonNFT.ownerOf(tokenId)).to.equal(alice.address);
            expect(await community.isNFTPublic(tokenId)).to.be.true;
            
            const listings = await marketplace.getActiveListings(0, 10);
            expect(listings.length).to.equal(0);
        });
    });
    
    describe("Event Synchronization", function () {
        it("Should emit events that can be tracked across contracts", async function () {
            // Mint NFT
            await carbonNFT.mintCarbonNFT(alice.address, TOKEN_URI, THEME, GRADE_A, 900);
            const tokenId = 0;
            
            // Set visibility - should emit event
            const visibilityTx = await community.connect(alice).setNFTVisibility(tokenId, true);
            await expect(visibilityTx)
                .to.emit(community, "NFTVisibilityChanged")
                .withArgs(tokenId, alice.address, true);
            
            // List NFT - should emit event
            await carbonNFT.connect(alice).approve(marketplace.address, tokenId);
            const listTx = await marketplace.connect(alice).listNFT(tokenId, ethers.utils.parseEther("0.1"));
            await expect(listTx)
                .to.emit(marketplace, "NFTListed")
                .withArgs(1, tokenId, alice.address, ethers.utils.parseEther("0.1"));
            
            // Buy NFT - should emit multiple events
            const buyTx = await marketplace.connect(bob).buyNFT(1, { value: ethers.utils.parseEther("0.1") });
            await expect(buyTx)
                .to.emit(marketplace, "NFTSold")
                .withArgs(1, tokenId, alice.address, bob.address, ethers.utils.parseEther("0.1"));
            
            // Should also emit transfer event from CarbonNFT
            await expect(buyTx)
                .to.emit(carbonNFT, "Transfer")
                .withArgs(marketplace.address, bob.address, tokenId);
        });
    });
});