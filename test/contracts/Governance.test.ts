import { expect } from "chai";
import { ethers } from "hardhat";
import { CarbonNFT, Governance } from "../../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Governance", function () {
  let carbonNFT: CarbonNFT;
  let governance: Governance;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let nonNFTHolder: SignerWithAddress;
  
  // Enums matching the contracts
  enum UserType { Individual, Company }
  enum Grade { F, D, C, B, A }
  enum ProposalType { MARKETPLACE_FEE, GRADE_THRESHOLD, PLATFORM_PARAMETER }
  enum ProposalStatus { Active, Passed, Failed, Executed }
  
  const VOTING_PERIOD = 7 * 24 * 60 * 60; // 7 days in seconds
  
  beforeEach(async function () {
    [owner, user1, user2, user3, nonNFTHolder] = await ethers.getSigners();
    
    // Deploy CarbonNFT first
    const CarbonNFTFactory = await ethers.getContractFactory("CarbonNFT");
    carbonNFT = await CarbonNFTFactory.deploy() as CarbonNFT;
    await carbonNFT.waitForDeployment();
    
    // Deploy Governance with CarbonNFT address
    const GovernanceFactory = await ethers.getContractFactory("Governance");
    governance = await GovernanceFactory.deploy(await carbonNFT.getAddress()) as Governance;
    await governance.waitForDeployment();
    
    // Register users and mint NFTs for testing
    await carbonNFT.connect(user1).registerUser(UserType.Individual);
    await carbonNFT.connect(user2).registerUser(UserType.Individual);
    await carbonNFT.connect(user3).registerUser(UserType.Individual);
    
    // Mint NFTs to give users voting power
    await carbonNFT.mintCarbonNFT(user1.address, "uri1", "theme1", Grade.C, 500);
    await carbonNFT.mintCarbonNFT(user2.address, "uri2", "theme2", Grade.B, 700);
    await carbonNFT.mintCarbonNFT(user3.address, "uri3", "theme3", Grade.A, 900);
    
    // Give user1 additional NFT for more voting power
    await carbonNFT.mintCarbonNFT(user1.address, "uri4", "theme4", Grade.D, 400);
  });

  describe("Deployment", function () {
    it("Should set the correct CarbonNFT address", async function () {
      expect(await governance.carbonNFT()).to.equal(await carbonNFT.getAddress());
    });

    it("Should set correct initial parameters", async function () {
      expect(await governance.quorumPercentage()).to.equal(10);
      expect(await governance.marketplaceFeePercentage()).to.equal(250);
      expect(await governance.gradeThresholdA()).to.equal(900);
      expect(await governance.gradeThresholdB()).to.equal(700);
      expect(await governance.gradeThresholdC()).to.equal(500);
      expect(await governance.gradeThresholdD()).to.equal(300);
    });

    it("Should set the correct owner", async function () {
      expect(await governance.owner()).to.equal(owner.address);
    });
  });

  describe("Proposal Creation", function () {
    it("Should allow NFT holders to create proposals", async function () {
      const description = "Increase marketplace fee to 3%";
      const proposalType = ProposalType.MARKETPLACE_FEE;
      const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [300]);
      
      const tx = await governance.connect(user1).createProposal(description, proposalType, data);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock("latest");
      const currentTime = block!.timestamp;
      
      await expect(tx)
        .to.emit(governance, "ProposalCreated")
        .withArgs(0, user1.address, description, proposalType, currentTime + VOTING_PERIOD);
      
      const proposal = await governance.getProposal(0);
      expect(proposal.id).to.equal(0);
      expect(proposal.proposer).to.equal(user1.address);
      expect(proposal.description).to.equal(description);
      expect(proposal.proposalType).to.equal(proposalType);
      expect(proposal.status).to.equal(ProposalStatus.Active);
      expect(proposal.executed).to.be.false;
      expect(proposal.votesFor).to.equal(0);
      expect(proposal.votesAgainst).to.equal(0);
    });

    it("Should not allow non-NFT holders to create proposals", async function () {
      const description = "Test proposal";
      const proposalType = ProposalType.MARKETPLACE_FEE;
      const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [300]);
      
      await expect(
        governance.connect(nonNFTHolder).createProposal(description, proposalType, data)
      ).to.be.revertedWithCustomError(governance, "InsufficientVotingPower");
    });

    it("Should not allow empty description", async function () {
      const proposalType = ProposalType.MARKETPLACE_FEE;
      const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [300]);
      
      await expect(
        governance.connect(user1).createProposal("", proposalType, data)
      ).to.be.revertedWithCustomError(governance, "InvalidProposal");
    });

    it("Should increment proposal ID counter", async function () {
      const description = "Test proposal 1";
      const proposalType = ProposalType.MARKETPLACE_FEE;
      const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [300]);
      
      await governance.connect(user1).createProposal(description, proposalType, data);
      await governance.connect(user2).createProposal("Test proposal 2", proposalType, data);
      
      expect(await governance.getTotalProposals()).to.equal(2);
    });
  });

  describe("Voting", function () {
    let proposalId: number;
    
    beforeEach(async function () {
      const description = "Test proposal for voting";
      const proposalType = ProposalType.MARKETPLACE_FEE;
      const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [300]);
      
      await governance.connect(user1).createProposal(description, proposalType, data);
      proposalId = 0;
    });

    it("Should allow NFT holders to vote", async function () {
      const votingPower = await governance.getVotingPower(user1.address);
      expect(votingPower).to.equal(2); // user1 has 2 NFTs
      
      const tx = await governance.connect(user1).vote(proposalId, true);
      
      await expect(tx)
        .to.emit(governance, "VoteCast")
        .withArgs(proposalId, user1.address, true, votingPower);
      
      const proposal = await governance.getProposal(proposalId);
      expect(proposal.votesFor).to.equal(votingPower);
      expect(proposal.votesAgainst).to.equal(0);
      
      expect(await governance.hasUserVoted(proposalId, user1.address)).to.be.true;
      expect(await governance.getUserVote(proposalId, user1.address)).to.be.true;
    });

    it("Should allow voting against proposals", async function () {
      const votingPower = await governance.getVotingPower(user2.address);
      
      await governance.connect(user2).vote(proposalId, false);
      
      const proposal = await governance.getProposal(proposalId);
      expect(proposal.votesFor).to.equal(0);
      expect(proposal.votesAgainst).to.equal(votingPower);
      
      expect(await governance.getUserVote(proposalId, user2.address)).to.be.false;
    });

    it("Should not allow non-NFT holders to vote", async function () {
      await expect(
        governance.connect(nonNFTHolder).vote(proposalId, true)
      ).to.be.revertedWithCustomError(governance, "InsufficientVotingPower");
    });

    it("Should not allow double voting", async function () {
      await governance.connect(user1).vote(proposalId, true);
      
      await expect(
        governance.connect(user1).vote(proposalId, false)
      ).to.be.revertedWithCustomError(governance, "AlreadyVoted");
    });

    it("Should not allow voting on non-existent proposals", async function () {
      await expect(
        governance.connect(user1).vote(999, true)
      ).to.be.revertedWithCustomError(governance, "InvalidProposal");
    });

    it("Should not allow voting after voting period ends", async function () {
      // Fast forward time past voting period
      await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD + 1]);
      await ethers.provider.send("evm_mine", []);
      
      await expect(
        governance.connect(user1).vote(proposalId, true)
      ).to.be.revertedWithCustomError(governance, "ProposalNotActive");
    });

    it("Should calculate voting power correctly based on NFT balance", async function () {
      expect(await governance.getVotingPower(user1.address)).to.equal(2);
      expect(await governance.getVotingPower(user2.address)).to.equal(1);
      expect(await governance.getVotingPower(user3.address)).to.equal(1);
      expect(await governance.getVotingPower(nonNFTHolder.address)).to.equal(0);
    });
  });

  describe("Proposal Execution", function () {
    let proposalId: number;
    
    beforeEach(async function () {
      const description = "Update marketplace fee to 3%";
      const proposalType = ProposalType.MARKETPLACE_FEE;
      const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [300]);
      
      await governance.connect(user1).createProposal(description, proposalType, data);
      proposalId = 0;
    });

    it("Should execute passed proposals with marketplace fee update", async function () {
      // Vote in favor with enough votes to pass
      await governance.connect(user1).vote(proposalId, true); // 2 votes
      await governance.connect(user2).vote(proposalId, true); // 1 vote
      
      // Fast forward past voting period
      await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD + 1]);
      await ethers.provider.send("evm_mine", []);
      
      const oldFee = await governance.marketplaceFeePercentage();
      
      const tx = await governance.executeProposal(proposalId);
      
      await expect(tx)
        .to.emit(governance, "ProposalExecuted")
        .withArgs(proposalId, true);
      
      await expect(tx)
        .to.emit(governance, "ParameterUpdated")
        .withArgs("marketplaceFeePercentage", oldFee, 300);
      
      expect(await governance.marketplaceFeePercentage()).to.equal(300);
      
      const proposal = await governance.getProposal(proposalId);
      expect(proposal.executed).to.be.true;
      expect(proposal.status).to.equal(ProposalStatus.Passed);
    });

    it("Should execute grade threshold updates", async function () {
      const description = "Update grade A threshold";
      const proposalType = ProposalType.GRADE_THRESHOLD;
      const data = ethers.AbiCoder.defaultAbiCoder().encode(["string", "uint256"], ["A", 950]);
      
      await governance.connect(user1).createProposal(description, proposalType, data);
      const newProposalId = 1;
      
      // Vote in favor
      await governance.connect(user1).vote(newProposalId, true);
      await governance.connect(user2).vote(newProposalId, true);
      
      await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD + 1]);
      await ethers.provider.send("evm_mine", []);
      
      const oldThreshold = await governance.gradeThresholdA();
      
      const tx = await governance.executeProposal(newProposalId);
      
      await expect(tx)
        .to.emit(governance, "ParameterUpdated")
        .withArgs("gradeThresholdA", oldThreshold, 950);
      
      expect(await governance.gradeThresholdA()).to.equal(950);
    });

    it("Should execute platform parameter updates", async function () {
      const description = "Update quorum percentage";
      const proposalType = ProposalType.PLATFORM_PARAMETER;
      const data = ethers.AbiCoder.defaultAbiCoder().encode(["string", "uint256"], ["quorumPercentage", 15]);
      
      await governance.connect(user1).createProposal(description, proposalType, data);
      const newProposalId = 1;
      
      // Vote in favor
      await governance.connect(user1).vote(newProposalId, true);
      await governance.connect(user2).vote(newProposalId, true);
      
      await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD + 1]);
      await ethers.provider.send("evm_mine", []);
      
      await governance.executeProposal(newProposalId);
      
      expect(await governance.quorumPercentage()).to.equal(15);
    });

    it("Should not execute proposals before voting period ends", async function () {
      await governance.connect(user1).vote(proposalId, true);
      
      await expect(
        governance.executeProposal(proposalId)
      ).to.be.revertedWithCustomError(governance, "ProposalNotExecutable");
    });

    it("Should not execute already executed proposals", async function () {
      await governance.connect(user1).vote(proposalId, true);
      await governance.connect(user2).vote(proposalId, true);
      
      await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD + 1]);
      await ethers.provider.send("evm_mine", []);
      
      await governance.executeProposal(proposalId);
      
      await expect(
        governance.executeProposal(proposalId)
      ).to.be.revertedWithCustomError(governance, "ProposalNotExecutable");
    });

    it("Should fail proposals that don't meet quorum", async function () {
      // Only user3 votes (1 vote out of 4 total NFTs = 25%, but quorum is 10% of holders, not NFTs)
      await governance.connect(user3).vote(proposalId, true);
      
      await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD + 1]);
      await ethers.provider.send("evm_mine", []);
      
      await governance.executeProposal(proposalId);
      
      const proposal = await governance.getProposal(proposalId);
      expect(proposal.status).to.equal(ProposalStatus.Failed);
    });

    it("Should fail proposals with more against votes", async function () {
      await governance.connect(user1).vote(proposalId, false); // 2 votes against
      await governance.connect(user2).vote(proposalId, true);  // 1 vote for
      
      await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD + 1]);
      await ethers.provider.send("evm_mine", []);
      
      await governance.executeProposal(proposalId);
      
      const proposal = await governance.getProposal(proposalId);
      expect(proposal.status).to.equal(ProposalStatus.Failed);
    });
  });

  describe("Proposal Status and Queries", function () {
    let proposalId: number;
    
    beforeEach(async function () {
      const description = "Test proposal";
      const proposalType = ProposalType.MARKETPLACE_FEE;
      const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [300]);
      
      await governance.connect(user1).createProposal(description, proposalType, data);
      proposalId = 0;
    });

    it("Should return correct proposal status during voting", async function () {
      expect(await governance.getProposalStatus(proposalId)).to.equal(ProposalStatus.Active);
    });

    it("Should return correct proposal status after voting ends", async function () {
      await governance.connect(user1).vote(proposalId, true);
      await governance.connect(user2).vote(proposalId, true);
      
      await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD + 1]);
      await ethers.provider.send("evm_mine", []);
      
      expect(await governance.getProposalStatus(proposalId)).to.equal(ProposalStatus.Passed);
    });

    it("Should return active proposals correctly", async function () {
      // Create another proposal
      const description2 = "Second proposal";
      const proposalType = ProposalType.GRADE_THRESHOLD;
      const data = ethers.AbiCoder.defaultAbiCoder().encode(["string", "uint256"], ["B", 750]);
      
      await governance.connect(user2).createProposal(description2, proposalType, data);
      
      const activeProposals = await governance.getActiveProposals();
      expect(activeProposals.length).to.equal(2);
      expect(activeProposals[0]).to.equal(0);
      expect(activeProposals[1]).to.equal(1);
    });

    it("Should not include expired proposals in active list", async function () {
      await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD + 1]);
      await ethers.provider.send("evm_mine", []);
      
      const activeProposals = await governance.getActiveProposals();
      expect(activeProposals.length).to.equal(0);
    });

    it("Should return total proposals count", async function () {
      expect(await governance.getTotalProposals()).to.equal(1);
      
      // Create another proposal
      const description2 = "Second proposal";
      const proposalType = ProposalType.MARKETPLACE_FEE;
      const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [400]);
      
      await governance.connect(user2).createProposal(description2, proposalType, data);
      
      expect(await governance.getTotalProposals()).to.equal(2);
    });
  });

  describe("Parameter Validation", function () {
    it("Should reject invalid marketplace fee proposals", async function () {
      const description = "Invalid high fee";
      const proposalType = ProposalType.MARKETPLACE_FEE;
      const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [1500]); // 15% - too high
      
      await governance.connect(user1).createProposal(description, proposalType, data);
      await governance.connect(user1).vote(0, true);
      await governance.connect(user2).vote(0, true);
      
      await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD + 1]);
      await ethers.provider.send("evm_mine", []);
      
      await expect(
        governance.executeProposal(0)
      ).to.be.revertedWithCustomError(governance, "ExecutionFailed");
    });

    it("Should reject invalid grade threshold proposals", async function () {
      const description = "Invalid grade";
      const proposalType = ProposalType.GRADE_THRESHOLD;
      const data = ethers.AbiCoder.defaultAbiCoder().encode(["string", "uint256"], ["X", 500]); // Invalid grade
      
      await governance.connect(user1).createProposal(description, proposalType, data);
      await governance.connect(user1).vote(0, true);
      await governance.connect(user2).vote(0, true);
      
      await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD + 1]);
      await ethers.provider.send("evm_mine", []);
      
      await expect(
        governance.executeProposal(0)
      ).to.be.revertedWithCustomError(governance, "ExecutionFailed");
    });

    it("Should reject invalid platform parameter proposals", async function () {
      const description = "Invalid quorum";
      const proposalType = ProposalType.PLATFORM_PARAMETER;
      const data = ethers.AbiCoder.defaultAbiCoder().encode(["string", "uint256"], ["quorumPercentage", 60]); // Too high
      
      await governance.connect(user1).createProposal(description, proposalType, data);
      await governance.connect(user1).vote(0, true);
      await governance.connect(user2).vote(0, true);
      
      await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD + 1]);
      await ethers.provider.send("evm_mine", []);
      
      await expect(
        governance.executeProposal(0)
      ).to.be.revertedWithCustomError(governance, "ExecutionFailed");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update quorum percentage", async function () {
      const newQuorum = 20;
      
      const tx = await governance.connect(owner).updateQuorumPercentage(newQuorum);
      
      await expect(tx)
        .to.emit(governance, "ParameterUpdated")
        .withArgs("quorumPercentage", 10, newQuorum);
      
      expect(await governance.quorumPercentage()).to.equal(newQuorum);
    });

    it("Should not allow non-owner to update quorum percentage", async function () {
      await expect(
        governance.connect(user1).updateQuorumPercentage(20)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should reject invalid quorum percentages", async function () {
      await expect(
        governance.connect(owner).updateQuorumPercentage(0)
      ).to.be.revertedWith("Invalid quorum percentage");
      
      await expect(
        governance.connect(owner).updateQuorumPercentage(60)
      ).to.be.revertedWith("Invalid quorum percentage");
    });
  });

  describe("Edge Cases and Error Handling", function () {
    it("Should handle proposals with no votes", async function () {
      const description = "No votes proposal";
      const proposalType = ProposalType.MARKETPLACE_FEE;
      const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [300]);
      
      await governance.connect(user1).createProposal(description, proposalType, data);
      
      await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD + 1]);
      await ethers.provider.send("evm_mine", []);
      
      await governance.executeProposal(0);
      
      const proposal = await governance.getProposal(0);
      expect(proposal.status).to.equal(ProposalStatus.Failed);
    });

    it("Should revert when getting vote for user who hasn't voted", async function () {
      const description = "Test proposal";
      const proposalType = ProposalType.MARKETPLACE_FEE;
      const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [300]);
      
      await governance.connect(user1).createProposal(description, proposalType, data);
      
      await expect(
        governance.getUserVote(0, user2.address)
      ).to.be.revertedWith("User has not voted");
    });

    it("Should handle multiple grade threshold updates", async function () {
      // Test updating all grade thresholds
      const grades = ["A", "B", "C", "D"];
      const newThresholds = [950, 750, 550, 350];
      
      for (let i = 0; i < grades.length; i++) {
        const description = `Update grade ${grades[i]} threshold`;
        const proposalType = ProposalType.GRADE_THRESHOLD;
        const data = ethers.AbiCoder.defaultAbiCoder().encode(["string", "uint256"], [grades[i], newThresholds[i]]);
        
        await governance.connect(user1).createProposal(description, proposalType, data);
        await governance.connect(user1).vote(i, true);
        await governance.connect(user2).vote(i, true);
        
        await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD + 1]);
        await ethers.provider.send("evm_mine", []);
        await governance.executeProposal(i);
        
        // Reset time for next proposal
        if (i < grades.length - 1) {
          await ethers.provider.send("evm_increaseTime", [-(VOTING_PERIOD + 1)]);
          await ethers.provider.send("evm_mine", []);
        }
      }
      
      expect(await governance.gradeThresholdA()).to.equal(950);
      expect(await governance.gradeThresholdB()).to.equal(750);
      expect(await governance.gradeThresholdC()).to.equal(550);
      expect(await governance.gradeThresholdD()).to.equal(350);
    });
  });
});