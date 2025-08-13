import { expect } from "chai";
import { ethers } from "hardhat";
import { CarbonNFT, Community, Governance, Marketplace } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Deployment Tests", function () {
  let carbonNFT: CarbonNFT;
  let community: Community;
  let governance: Governance;
  let marketplace: Marketplace;
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  // Gas usage tracking
  const gasUsage: Record<string, bigint> = {};

  before(async function () {
    [deployer, user1, user2] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("User1:", user1.address);
    console.log("User2:", user2.address);
  });

  describe("Contract Deployment", function () {
    it("Should deploy CarbonNFT contract", async function () {
      const CarbonNFTFactory = await ethers.getContractFactory("CarbonNFT");
      
      // Estimate gas
      const deploymentData = CarbonNFTFactory.getDeployTransaction();
      const gasEstimate = await deployer.estimateGas(deploymentData);
      console.log("CarbonNFT deployment gas estimate:", gasEstimate.toString());
      
      carbonNFT = await CarbonNFTFactory.deploy();
      const receipt = await carbonNFT.deploymentTransaction()?.wait();
      
      gasUsage.carbonNFT = receipt?.gasUsed || BigInt(0);
      console.log("CarbonNFT actual gas used:", gasUsage.carbonNFT.toString());
      
      expect(await carbonNFT.getAddress()).to.be.properAddress;
      expect(gasUsage.carbonNFT).to.be.lessThan(BigInt(3000000)); // Should be under 3M gas
    });

    it("Should deploy Community contract", async function () {
      const CommunityFactory = await ethers.getContractFactory("Community");
      const carbonNFTAddress = await carbonNFT.getAddress();
      
      const gasEstimate = await deployer.estimateGas(
        CommunityFactory.getDeployTransaction(carbonNFTAddress)
      );
      console.log("Community deployment gas estimate:", gasEstimate.toString());
      
      community = await CommunityFactory.deploy(carbonNFTAddress);
      const receipt = await community.deploymentTransaction()?.wait();
      
      gasUsage.community = receipt?.gasUsed || BigInt(0);
      console.log("Community actual gas used:", gasUsage.community.toString());
      
      expect(await community.getAddress()).to.be.properAddress;
      expect(await community.carbonNFT()).to.equal(carbonNFTAddress);
      expect(gasUsage.community).to.be.lessThan(BigInt(2000000)); // Should be under 2M gas
    });

    it("Should deploy Governance contract", async function () {
      const GovernanceFactory = await ethers.getContractFactory("Governance");
      const carbonNFTAddress = await carbonNFT.getAddress();
      
      const gasEstimate = await deployer.estimateGas(
        GovernanceFactory.getDeployTransaction(carbonNFTAddress)
      );
      console.log("Governance deployment gas estimate:", gasEstimate.toString());
      
      governance = await GovernanceFactory.deploy(carbonNFTAddress);
      const receipt = await governance.deploymentTransaction()?.wait();
      
      gasUsage.governance = receipt?.gasUsed || BigInt(0);
      console.log("Governance actual gas used:", gasUsage.governance.toString());
      
      expect(await governance.getAddress()).to.be.properAddress;
      expect(await governance.carbonNFT()).to.equal(carbonNFTAddress);
      expect(gasUsage.governance).to.be.lessThan(BigInt(2500000)); // Should be under 2.5M gas
    });

    it("Should deploy Marketplace contract", async function () {
      const MarketplaceFactory = await ethers.getContractFactory("Marketplace");
      const carbonNFTAddress = await carbonNFT.getAddress();
      
      const gasEstimate = await deployer.estimateGas(
        MarketplaceFactory.getDeployTransaction(carbonNFTAddress)
      );
      console.log("Marketplace deployment gas estimate:", gasEstimate.toString());
      
      marketplace = await MarketplaceFactory.deploy(carbonNFTAddress);
      const receipt = await marketplace.deploymentTransaction()?.wait();
      
      gasUsage.marketplace = receipt?.gasUsed || BigInt(0);
      console.log("Marketplace actual gas used:", gasUsage.marketplace.toString());
      
      expect(await marketplace.getAddress()).to.be.properAddress;
      expect(await marketplace.carbonNFT()).to.equal(carbonNFTAddress);
      expect(gasUsage.marketplace).to.be.lessThan(BigInt(2500000)); // Should be under 2.5M gas
    });

    it("Should have reasonable total deployment gas cost", async function () {
      const totalGas = Object.values(gasUsage).reduce((sum, gas) => sum + gas, BigInt(0));
      console.log("Total deployment gas:", totalGas.toString());
      
      // Total deployment should be under 10M gas
      expect(totalGas).to.be.lessThan(BigInt(10000000));
      
      // Log gas breakdown
      console.log("\nGas Usage Breakdown:");
      Object.entries(gasUsage).forEach(([contract, gas]) => {
        console.log(`${contract}: ${gas.toString()} gas`);
      });
    });
  });

  describe("Post-Deployment Configuration", function () {
    it("Should verify contract interconnections", async function () {
      const carbonNFTAddress = await carbonNFT.getAddress();
      
      // Verify all contracts reference the correct CarbonNFT
      expect(await community.carbonNFT()).to.equal(carbonNFTAddress);
      expect(await governance.carbonNFT()).to.equal(carbonNFTAddress);
      expect(await marketplace.carbonNFT()).to.equal(carbonNFTAddress);
    });

    it("Should have correct initial configurations", async function () {
      // Check Marketplace initial settings
      expect(await marketplace.marketplaceFeePercent()).to.equal(250); // 2.5%
      expect(await marketplace.royaltyPercent()).to.equal(500); // 5%
      
      // Check grade multipliers
      for (let i = 0; i < 5; i++) {
        const multiplier = await marketplace.gradeMultipliers(i);
        expect(multiplier).to.be.greaterThan(0);
      }
      
      // Check Governance initial settings
      expect(await governance.votingPeriod()).to.equal(7 * 24 * 60 * 60); // 7 days
      expect(await governance.proposalThreshold()).to.equal(1); // 1 NFT required
    });
  });

  describe("Basic Functionality Tests", function () {
    beforeEach(async function () {
      // Register users for testing
      await carbonNFT.connect(user1).registerUser(0); // Individual
      await carbonNFT.connect(user2).registerUser(0); // Individual
    });

    it("Should allow NFT minting with gas optimization", async function () {
      const mintTx = await carbonNFT.connect(user1).mintCarbonNFT(
        user1.address,
        "https://ipfs.io/ipfs/test-metadata",
        "Forest Theme",
        4, // Grade F
        100
      );
      
      const receipt = await mintTx.wait();
      const gasUsed = receipt?.gasUsed || BigInt(0);
      
      console.log("NFT minting gas used:", gasUsed.toString());
      expect(gasUsed).to.be.lessThan(BigInt(200000)); // Should be under 200k gas
      
      // Verify NFT was minted
      const userNFTs = await carbonNFT.getUserNFTs(user1.address);
      expect(userNFTs.length).to.equal(1);
    });

    it("Should allow Community interactions with gas optimization", async function () {
      // First mint an NFT
      await carbonNFT.connect(user1).mintCarbonNFT(
        user1.address,
        "https://ipfs.io/ipfs/test-metadata",
        "Forest Theme",
        3, // Grade D
        250
      );
      
      const userNFTs = await carbonNFT.getUserNFTs(user1.address);
      const tokenId = userNFTs[0];
      
      // Test visibility setting
      const visibilityTx = await community.connect(user1).setNFTVisibility(tokenId, true);
      const receipt = await visibilityTx.wait();
      const gasUsed = receipt?.gasUsed || BigInt(0);
      
      console.log("Set NFT visibility gas used:", gasUsed.toString());
      expect(gasUsed).to.be.lessThan(BigInt(50000)); // Should be under 50k gas
      
      // Test public gallery retrieval
      const publicNFTs = await community.getPublicNFTs(0, 10);
      expect(publicNFTs.length).to.be.greaterThan(0);
    });

    it("Should allow Marketplace operations with gas optimization", async function () {
      // Mint NFT for user1
      await carbonNFT.connect(user1).mintCarbonNFT(
        user1.address,
        "https://ipfs.io/ipfs/test-metadata",
        "Ocean Theme",
        2, // Grade C
        500
      );
      
      const userNFTs = await carbonNFT.getUserNFTs(user1.address);
      const tokenId = userNFTs[0];
      
      // Approve marketplace
      await carbonNFT.connect(user1).approve(await marketplace.getAddress(), tokenId);
      
      // List NFT
      const listPrice = ethers.parseEther("0.1");
      const listTx = await marketplace.connect(user1).listNFT(tokenId, listPrice);
      const listReceipt = await listTx.wait();
      const listGasUsed = listReceipt?.gasUsed || BigInt(0);
      
      console.log("List NFT gas used:", listGasUsed.toString());
      expect(listGasUsed).to.be.lessThan(BigInt(150000)); // Should be under 150k gas
      
      // Verify listing
      const listings = await marketplace.getActiveListings(0, 10);
      expect(listings.length).to.equal(1);
      expect(listings[0].tokenId).to.equal(tokenId);
    });

    it("Should allow Governance operations with gas optimization", async function () {
      // Mint NFT for user1 to have voting power
      await carbonNFT.connect(user1).mintCarbonNFT(
        user1.address,
        "https://ipfs.io/ipfs/test-metadata",
        "Mountain Theme",
        1, // Grade B
        750
      );
      
      // Create proposal
      const proposalTx = await governance.connect(user1).createProposal(
        "Test proposal for marketplace fee adjustment",
        0, // MARKETPLACE_FEE type
        ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [200]) // 2% fee
      );
      
      const proposalReceipt = await proposalTx.wait();
      const proposalGasUsed = proposalReceipt?.gasUsed || BigInt(0);
      
      console.log("Create proposal gas used:", proposalGasUsed.toString());
      expect(proposalGasUsed).to.be.lessThan(BigInt(200000)); // Should be under 200k gas
      
      // Vote on proposal
      const voteTx = await governance.connect(user1).vote(1, true); // Vote yes on proposal 1
      const voteReceipt = await voteTx.wait();
      const voteGasUsed = voteReceipt?.gasUsed || BigInt(0);
      
      console.log("Vote gas used:", voteGasUsed.toString());
      expect(voteGasUsed).to.be.lessThan(BigInt(100000)); // Should be under 100k gas
      
      // Verify proposal
      const proposal = await governance.getProposal(1);
      expect(proposal.votesFor).to.equal(1);
    });
  });

  describe("Gas Optimization Verification", function () {
    it("Should meet gas efficiency targets for all operations", function () {
      console.log("\n=== Gas Efficiency Report ===");
      
      const targets = {
        carbonNFT: BigInt(3000000),    // 3M gas for deployment
        community: BigInt(2000000),    // 2M gas for deployment
        governance: BigInt(2500000),   // 2.5M gas for deployment
        marketplace: BigInt(2500000),  // 2.5M gas for deployment
      };
      
      let allTargetsMet = true;
      
      Object.entries(gasUsage).forEach(([contract, actualGas]) => {
        const target = targets[contract as keyof typeof targets];
        const efficiency = Number((BigInt(100) * actualGas) / target);
        const status = actualGas <= target ? "✅ PASS" : "❌ FAIL";
        
        console.log(`${contract}: ${actualGas.toString()} gas (${efficiency.toFixed(1)}% of target) ${status}`);
        
        if (actualGas > target) {
          allTargetsMet = false;
        }
      });
      
      const totalGas = Object.values(gasUsage).reduce((sum, gas) => sum + gas, BigInt(0));
      const totalTarget = Object.values(targets).reduce((sum, gas) => sum + gas, BigInt(0));
      const totalEfficiency = Number((BigInt(100) * totalGas) / totalTarget);
      
      console.log(`\nTotal: ${totalGas.toString()} gas (${totalEfficiency.toFixed(1)}% of target)`);
      console.log("===============================\n");
      
      expect(allTargetsMet).to.be.true;
    });
  });

  after(function () {
    console.log("\n=== Final Deployment Summary ===");
    console.log("CarbonNFT:", carbonNFT ? await carbonNFT.getAddress() : "Not deployed");
    console.log("Community:", community ? await community.getAddress() : "Not deployed");
    console.log("Governance:", governance ? await governance.getAddress() : "Not deployed");
    console.log("Marketplace:", marketplace ? await marketplace.getAddress() : "Not deployed");
    console.log("================================\n");
  });
});