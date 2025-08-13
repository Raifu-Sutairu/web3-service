import { expect } from "chai";
import { ethers } from "hardhat";
import { CarbonNFT, Community } from "../../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Community Contract", function () {
  let carbonNFT: CarbonNFT;
  let community: Community;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;

  // Grade enum values
  const Grade = {
    F: 0,
    D: 1,
    C: 2,
    B: 3,
    A: 4
  };

  // UserType enum values
  const UserType = {
    Individual: 0,
    Company: 1
  };

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();

    // Deploy CarbonNFT contract
    const CarbonNFTFactory = await ethers.getContractFactory("CarbonNFT");
    carbonNFT = await CarbonNFTFactory.deploy() as CarbonNFT;
    await carbonNFT.deployed();

    // Deploy Community contract
    const CommunityFactory = await ethers.getContractFactory("Community");
    community = await CommunityFactory.deploy(carbonNFT.address) as Community;
    await community.deployed();

    // Register users
    await carbonNFT.connect(user1).registerUser(UserType.Individual);
    await carbonNFT.connect(user2).registerUser(UserType.Individual);
    await carbonNFT.connect(user3).registerUser(UserType.Company);
  });

  describe("Deployment", function () {
    it("Should set the correct CarbonNFT address", async function () {
      expect(await community.carbonNFT()).to.equal(carbonNFT.address);
    });

    it("Should revert with invalid CarbonNFT address", async function () {
      const CommunityFactory = await ethers.getContractFactory("Community");
      await expect(
        CommunityFactory.deploy(ethers.constants.AddressZero)
      ).to.be.revertedWith("Invalid CarbonNFT address");
    });
  });

  describe("NFT Visibility Controls", function () {
    let tokenId1: number;
    let tokenId2: number;

    beforeEach(async function () {
      // Mint NFTs for testing
      const tx1 = await carbonNFT.mintCarbonNFT(
        user1.address,
        "ipfs://test1",
        "nature",
        Grade.B,
        100
      );
      const receipt1 = await tx1.wait();
      tokenId1 = receipt1.events?.[0]?.args?.tokenId.toNumber();

      const tx2 = await carbonNFT.mintCarbonNFT(
        user2.address,
        "ipfs://test2",
        "renewable",
        Grade.A,
        150
      );
      const receipt2 = await tx2.wait();
      tokenId2 = receipt2.events?.[0]?.args?.tokenId.toNumber();
    });

    it("Should allow NFT owner to set visibility to public", async function () {
      await expect(community.connect(user1).setNFTVisibility(tokenId1, true))
        .to.emit(community, "NFTVisibilityChanged")
        .withArgs(tokenId1, user1.address, true);

      expect(await community.isNFTPublic(tokenId1)).to.be.true;
    });

    it("Should allow NFT owner to set visibility to private", async function () {
      // First set to public
      await community.connect(user1).setNFTVisibility(tokenId1, true);
      
      // Then set to private
      await expect(community.connect(user1).setNFTVisibility(tokenId1, false))
        .to.emit(community, "NFTVisibilityChanged")
        .withArgs(tokenId1, user1.address, false);

      expect(await community.isNFTPublic(tokenId1)).to.be.false;
    });

    it("Should revert when non-owner tries to set visibility", async function () {
      await expect(
        community.connect(user2).setNFTVisibility(tokenId1, true)
      ).to.be.revertedWithCustomError(community, "UnauthorizedAccess");
    });

    it("Should revert when setting visibility for non-existent token", async function () {
      await expect(
        community.connect(user1).setNFTVisibility(999, true)
      ).to.be.revertedWithCustomError(community, "TokenNotFound");
    });

    it("Should default to private visibility for new NFTs", async function () {
      expect(await community.isNFTPublic(tokenId1)).to.be.false;
      expect(await community.isNFTPublic(tokenId2)).to.be.false;
    });
  });

  describe("Public NFT Gallery", function () {
    let tokenId1: number;
    let tokenId2: number;
    let tokenId3: number;

    beforeEach(async function () {
      // Mint multiple NFTs
      const tx1 = await carbonNFT.mintCarbonNFT(
        user1.address,
        "ipfs://test1",
        "nature",
        Grade.B,
        100
      );
      const receipt1 = await tx1.wait();
      tokenId1 = receipt1.events?.[0]?.args?.tokenId.toNumber();

      const tx2 = await carbonNFT.mintCarbonNFT(
        user2.address,
        "ipfs://test2",
        "renewable",
        Grade.A,
        150
      );
      const receipt2 = await tx2.wait();
      tokenId2 = receipt2.events?.[0]?.args?.tokenId.toNumber();

      const tx3 = await carbonNFT.mintCarbonNFT(
        user3.address,
        "ipfs://test3",
        "transport",
        Grade.C,
        80
      );
      const receipt3 = await tx3.wait();
      tokenId3 = receipt3.events?.[0]?.args?.tokenId.toNumber();

      // Set some NFTs to public
      await community.connect(user1).setNFTVisibility(tokenId1, true);
      await community.connect(user2).setNFTVisibility(tokenId2, true);
      // tokenId3 remains private
    });

    it("Should return only public NFTs in gallery", async function () {
      const publicNFTs = await community.getPublicNFTs(0, 10);
      
      expect(publicNFTs.length).to.equal(2);
      
      // Check that returned NFTs are the public ones
      const tokenIds = publicNFTs.map(nft => nft.tokenId.toNumber());
      expect(tokenIds).to.include(tokenId1);
      expect(tokenIds).to.include(tokenId2);
      expect(tokenIds).to.not.include(tokenId3);
    });

    it("Should return correct NFT display data", async function () {
      const publicNFTs = await community.getPublicNFTs(0, 10);
      
      const nft1 = publicNFTs.find(nft => nft.tokenId.toNumber() === tokenId1);
      expect(nft1).to.not.be.undefined;
      expect(nft1!.owner).to.equal(user1.address);
      expect(nft1!.grade).to.equal(Grade.B);
      expect(nft1!.carbonScore).to.equal(100);
      expect(nft1!.theme).to.equal("nature");
      expect(nft1!.isPublic).to.be.true;
    });

    it("Should handle pagination correctly", async function () {
      // Test with limit of 1
      const firstPage = await community.getPublicNFTs(0, 1);
      expect(firstPage.length).to.equal(1);

      const secondPage = await community.getPublicNFTs(1, 1);
      expect(secondPage.length).to.equal(1);

      // Ensure different NFTs are returned
      expect(firstPage[0].tokenId).to.not.equal(secondPage[0].tokenId);
    });

    it("Should revert with invalid limit parameters", async function () {
      await expect(
        community.getPublicNFTs(0, 0)
      ).to.be.revertedWithCustomError(community, "InvalidParameters");

      await expect(
        community.getPublicNFTs(0, 101)
      ).to.be.revertedWithCustomError(community, "InvalidParameters");
    });

    it("Should return correct public NFT count", async function () {
      expect(await community.getPublicNFTCount()).to.equal(2);
      
      // Make another NFT public
      await community.connect(user3).setNFTVisibility(tokenId3, true);
      expect(await community.getPublicNFTCount()).to.equal(3);
    });
  });

  describe("Leaderboard Functionality", function () {
    let tokenId1: number;
    let tokenId2: number;
    let tokenId3: number;
    let tokenId4: number;

    beforeEach(async function () {
      // Mint NFTs with different grades and scores for leaderboard testing
      const tx1 = await carbonNFT.mintCarbonNFT(
        user1.address,
        "ipfs://test1",
        "nature",
        Grade.A,
        200
      );
      const receipt1 = await tx1.wait();
      tokenId1 = receipt1.events?.[0]?.args?.tokenId.toNumber();

      const tx2 = await carbonNFT.mintCarbonNFT(
        user1.address,
        "ipfs://test2",
        "renewable",
        Grade.B,
        150
      );
      const receipt2 = await tx2.wait();
      tokenId2 = receipt2.events?.[0]?.args?.tokenId.toNumber();

      const tx3 = await carbonNFT.mintCarbonNFT(
        user2.address,
        "ipfs://test3",
        "transport",
        Grade.A,
        180
      );
      const receipt3 = await tx3.wait();
      tokenId3 = receipt3.events?.[0]?.args?.tokenId.toNumber();

      const tx4 = await carbonNFT.mintCarbonNFT(
        user3.address,
        "ipfs://test4",
        "energy",
        Grade.C,
        100
      );
      const receipt4 = await tx4.wait();
      tokenId4 = receipt4.events?.[0]?.args?.tokenId.toNumber();
    });

    it("Should return leaderboard sorted by total score", async function () {
      const leaderboard = await community.getLeaderboard(10);
      
      expect(leaderboard.length).to.equal(3); // 3 unique users
      
      // user1 should be first (200 + 150 = 350 total score)
      expect(leaderboard[0].user).to.equal(user1.address);
      expect(leaderboard[0].totalScore).to.equal(350);
      expect(leaderboard[0].nftCount).to.equal(2);
      
      // user2 should be second (180 total score)
      expect(leaderboard[1].user).to.equal(user2.address);
      expect(leaderboard[1].totalScore).to.equal(180);
      expect(leaderboard[1].nftCount).to.equal(1);
      
      // user3 should be third (100 total score)
      expect(leaderboard[2].user).to.equal(user3.address);
      expect(leaderboard[2].totalScore).to.equal(100);
      expect(leaderboard[2].nftCount).to.equal(1);
    });

    it("Should calculate average grades correctly", async function () {
      const leaderboard = await community.getLeaderboard(10);
      
      // user1 has grades A(4) and B(3), average = (4+3)/2 = 3.5 ≈ 3 (B)
      expect(leaderboard[0].averageGrade).to.equal(Grade.B);
      
      // user2 has grade A(4), average = 4
      expect(leaderboard[1].averageGrade).to.equal(Grade.A);
      
      // user3 has grade C(2), average = 2
      expect(leaderboard[2].averageGrade).to.equal(Grade.C);
    });

    it("Should respect limit parameter", async function () {
      const leaderboard = await community.getLeaderboard(2);
      expect(leaderboard.length).to.equal(2);
      
      // Should still be sorted by score
      expect(leaderboard[0].totalScore).to.be.greaterThan(leaderboard[1].totalScore);
    });

    it("Should revert with invalid limit parameters", async function () {
      await expect(
        community.getLeaderboard(0)
      ).to.be.revertedWithCustomError(community, "InvalidParameters");

      await expect(
        community.getLeaderboard(51)
      ).to.be.revertedWithCustomError(community, "InvalidParameters");
    });

    it("Should handle empty leaderboard", async function () {
      // Deploy new contracts with no NFTs
      const CarbonNFTFactory = await ethers.getContractFactory("CarbonNFT");
      const newCarbonNFT = await CarbonNFTFactory.deploy() as CarbonNFT;
      await newCarbonNFT.deployed();

      const CommunityFactory = await ethers.getContractFactory("Community");
      const newCommunity = await CommunityFactory.deploy(newCarbonNFT.address) as Community;
      await newCommunity.deployed();

      const leaderboard = await newCommunity.getLeaderboard(10);
      expect(leaderboard.length).to.equal(0);
    });
  });

  describe("Community Statistics", function () {
    let tokenId1: number;
    let tokenId2: number;
    let tokenId3: number;

    beforeEach(async function () {
      // Mint NFTs for statistics testing
      const tx1 = await carbonNFT.mintCarbonNFT(
        user1.address,
        "ipfs://test1",
        "nature",
        Grade.A,
        200
      );
      const receipt1 = await tx1.wait();
      tokenId1 = receipt1.events?.[0]?.args?.tokenId.toNumber();

      const tx2 = await carbonNFT.mintCarbonNFT(
        user2.address,
        "ipfs://test2",
        "renewable",
        Grade.B,
        150
      );
      const receipt2 = await tx2.wait();
      tokenId2 = receipt2.events?.[0]?.args?.tokenId.toNumber();

      const tx3 = await carbonNFT.mintCarbonNFT(
        user2.address,
        "ipfs://test3",
        "transport",
        Grade.C,
        100
      );
      const receipt3 = await tx3.wait();
      tokenId3 = receipt3.events?.[0]?.args?.tokenId.toNumber();
    });

    it("Should return correct community statistics", async function () {
      const stats = await community.getCommunityStats();
      
      expect(stats.totalUsers).to.equal(2); // user1 and user2
      expect(stats.totalNFTs).to.equal(3);
      expect(stats.totalCarbonSaved).to.equal(450); // 200 + 150 + 100
      
      // Average grade: (A=4 + B=3 + C=2) / 3 = 3
      expect(stats.averageGrade).to.equal(3);
    });

    it("Should handle single user statistics", async function () {
      // Deploy new contracts and mint single NFT
      const CarbonNFTFactory = await ethers.getContractFactory("CarbonNFT");
      const newCarbonNFT = await CarbonNFTFactory.deploy() as CarbonNFT;
      await newCarbonNFT.deployed();

      const CommunityFactory = await ethers.getContractFactory("Community");
      const newCommunity = await CommunityFactory.deploy(newCarbonNFT.address) as Community;
      await newCommunity.deployed();

      await newCarbonNFT.connect(user1).registerUser(UserType.Individual);
      await newCarbonNFT.mintCarbonNFT(
        user1.address,
        "ipfs://single",
        "test",
        Grade.A,
        100
      );

      const stats = await newCommunity.getCommunityStats();
      expect(stats.totalUsers).to.equal(1);
      expect(stats.totalNFTs).to.equal(1);
      expect(stats.totalCarbonSaved).to.equal(100);
      expect(stats.averageGrade).to.equal(Grade.A);
    });

    it("Should handle empty platform statistics", async function () {
      // Deploy new contracts with no NFTs
      const CarbonNFTFactory = await ethers.getContractFactory("CarbonNFT");
      const newCarbonNFT = await CarbonNFTFactory.deploy() as CarbonNFT;
      await newCarbonNFT.deployed();

      const CommunityFactory = await ethers.getContractFactory("Community");
      const newCommunity = await CommunityFactory.deploy(newCarbonNFT.address) as Community;
      await newCommunity.deployed();

      const stats = await newCommunity.getCommunityStats();
      expect(stats.totalUsers).to.equal(0);
      expect(stats.totalNFTs).to.equal(0);
      expect(stats.totalCarbonSaved).to.equal(0);
      expect(stats.averageGrade).to.equal(0);
    });
  });

  describe("NFT Display Access Control", function () {
    let tokenId1: number;
    let tokenId2: number;

    beforeEach(async function () {
      // Mint NFTs for access control testing
      const tx1 = await carbonNFT.mintCarbonNFT(
        user1.address,
        "ipfs://test1",
        "nature",
        Grade.B,
        100
      );
      const receipt1 = await tx1.wait();
      tokenId1 = receipt1.events?.[0]?.args?.tokenId.toNumber();

      const tx2 = await carbonNFT.mintCarbonNFT(
        user2.address,
        "ipfs://test2",
        "renewable",
        Grade.A,
        150
      );
      const receipt2 = await tx2.wait();
      tokenId2 = receipt2.events?.[0]?.args?.tokenId.toNumber();

      // Set tokenId1 to public, keep tokenId2 private
      await community.connect(user1).setNFTVisibility(tokenId1, true);
    });

    it("Should allow anyone to view public NFT display", async function () {
      const display = await community.connect(user3).getNFTDisplay(tokenId1);
      
      expect(display.tokenId).to.equal(tokenId1);
      expect(display.owner).to.equal(user1.address);
      expect(display.grade).to.equal(Grade.B);
      expect(display.carbonScore).to.equal(100);
      expect(display.theme).to.equal("nature");
      expect(display.isPublic).to.be.true;
    });

    it("Should allow owner to view private NFT display", async function () {
      const display = await community.connect(user2).getNFTDisplay(tokenId2);
      
      expect(display.tokenId).to.equal(tokenId2);
      expect(display.owner).to.equal(user2.address);
      expect(display.isPublic).to.be.false;
    });

    it("Should revert when non-owner tries to view private NFT", async function () {
      await expect(
        community.connect(user3).getNFTDisplay(tokenId2)
      ).to.be.revertedWithCustomError(community, "UnauthorizedAccess");
    });

    it("Should revert when viewing non-existent NFT", async function () {
      await expect(
        community.getNFTDisplay(999)
      ).to.be.revertedWithCustomError(community, "TokenNotFound");
    });
  });

  describe("Edge Cases and Error Handling", function () {
    it("Should handle large pagination requests gracefully", async function () {
      // Test with offset beyond available NFTs
      const publicNFTs = await community.getPublicNFTs(1000, 10);
      expect(publicNFTs.length).to.equal(0);
    });

    it("Should handle endorsements in NFT display", async function () {
      // Mint and endorse an NFT
      const tx = await carbonNFT.mintCarbonNFT(
        user1.address,
        "ipfs://test",
        "nature",
        Grade.B,
        100
      );
      const receipt = await tx.wait();
      const tokenId = receipt.events?.[0]?.args?.tokenId.toNumber();

      await community.connect(user1).setNFTVisibility(tokenId, true);
      await carbonNFT.connect(user2).endorseNFT(tokenId);

      const display = await community.getNFTDisplay(tokenId);
      expect(display.endorsements).to.equal(1);
    });

    it("Should maintain consistency after NFT transfers", async function () {
      // Mint NFT and set visibility
      const tx = await carbonNFT.mintCarbonNFT(
        user1.address,
        "ipfs://test",
        "nature",
        Grade.B,
        100
      );
      const receipt = await tx.wait();
      const tokenId = receipt.events?.[0]?.args?.tokenId.toNumber();

      await community.connect(user1).setNFTVisibility(tokenId, true);

      // Transfer NFT to user2
      await carbonNFT.connect(user1).transferFrom(user1.address, user2.address, tokenId);

      // Check that display shows new owner
      const display = await community.getNFTDisplay(tokenId);
      expect(display.owner).to.equal(user2.address);
      expect(display.isPublic).to.be.true; // Visibility setting should persist
    });
  });
});