import { expect } from "chai";
import { ethers } from "hardhat";
import { CarbonNFT } from "../../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";

describe("CarbonNFT", function () {
  let carbonNFT: CarbonNFT;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let company: SignerWithAddress;
  
  // Enums matching the contract
  enum UserType { Individual, Company }
  enum Grade { F, D, C, B, A }
  
  beforeEach(async function () {
    [owner, user1, user2, company] = await ethers.getSigners();
    
    const CarbonNFTFactory = await ethers.getContractFactory("CarbonNFT");
    carbonNFT = await CarbonNFTFactory.deploy() as CarbonNFT;
    await carbonNFT.deployed();
  });

  describe("User Registration", function () {
    it("Should register individual users", async function () {
      await carbonNFT.connect(user1).registerUser(UserType.Individual);
      expect(await carbonNFT.isRegistered(user1.address)).to.be.true;
      expect(await carbonNFT.userTypes(user1.address)).to.equal(UserType.Individual);
    });

    it("Should register company users", async function () {
      await carbonNFT.connect(company).registerUser(UserType.Company);
      expect(await carbonNFT.isRegistered(company.address)).to.be.true;
      expect(await carbonNFT.userTypes(company.address)).to.equal(UserType.Company);
    });

    it("Should emit UserRegistered event", async function () {
      await expect(carbonNFT.connect(user1).registerUser(UserType.Individual))
        .to.emit(carbonNFT, "UserRegistered")
        .withArgs(user1.address, UserType.Individual);
    });

    it("Should not allow double registration", async function () {
      await carbonNFT.connect(user1).registerUser(UserType.Individual);
      await expect(
        carbonNFT.connect(user1).registerUser(UserType.Individual)
      ).to.be.revertedWith("User already registered");
    });
  });

  describe("NFT Minting", function () {
    beforeEach(async function () {
      await carbonNFT.connect(user1).registerUser(UserType.Individual);
    });

    it("Should mint NFT with correct data", async function () {
      const tokenURI = "https://ipfs.io/ipfs/test-hash";
      const theme = "Ocean Blue";
      const grade = Grade.C;
      const score = 750;

      const tx = await carbonNFT.mintCarbonNFT(
        user1.address,
        tokenURI,
        theme,
        grade,
        score
      );

      await expect(tx)
        .to.emit(carbonNFT, "NFTMinted")
        .withArgs(0, user1.address, grade, theme);

      const nftData = await carbonNFT.getNFTData(0);
      expect(nftData.currentGrade).to.equal(grade);
      expect(nftData.carbonScore).to.equal(score);
      expect(nftData.theme).to.equal(theme);
      expect(nftData.isActive).to.be.true;
      expect(nftData.endorsements).to.equal(0);
    });

    it("Should not mint for unregistered users", async function () {
      await expect(
        carbonNFT.mintCarbonNFT(
          user2.address, // Unregistered
          "test-uri",
          "test-theme",
          Grade.F,
          100
        )
      ).to.be.revertedWith("User must be registered first");
    });

    it("Should add NFT to user's collection", async function () {
      await carbonNFT.mintCarbonNFT(
        user1.address,
        "test-uri",
        "test-theme",
        Grade.F,
        100
      );

      const userNFTs = await carbonNFT.getUserNFTs(user1.address);
      expect(userNFTs.length).to.equal(1);
      expect(userNFTs[0]).to.equal(0);
    });

    it("Should set correct token URI", async function () {
      const tokenURI = "https://ipfs.io/ipfs/QmTest123";
      await carbonNFT.mintCarbonNFT(
        user1.address,
        tokenURI,
        "test-theme",
        Grade.F,
        100
      );

      expect(await carbonNFT.tokenURI(0)).to.equal(tokenURI);
    });
  });

  describe("Grade Updates", function () {
    beforeEach(async function () {
      await carbonNFT.connect(user1).registerUser(UserType.Individual);
      await carbonNFT.mintCarbonNFT(
        user1.address,
        "test-uri",
        "test-theme",
        Grade.F,
        100
      );
    });

    it("Should update NFT grade successfully", async function () {
      const newGrade = Grade.C;
      const newScore = 750;
      const newURI = "https://ipfs.io/ipfs/new-hash";

      const tx = await carbonNFT.updateGrade(0, newGrade, newScore, newURI);

      await expect(tx)
        .to.emit(carbonNFT, "GradeUpdated")
        .withArgs(0, Grade.F, newGrade, newScore);

      await expect(tx)
        .to.emit(carbonNFT, "WeeklyUploadSubmitted");

      const nftData = await carbonNFT.getNFTData(0);
      expect(nftData.currentGrade).to.equal(newGrade);
      expect(nftData.carbonScore).to.equal(newScore);
      
      // Check URI was updated
      expect(await carbonNFT.tokenURI(0)).to.equal(newURI);
    });

    it("Should track weekly uploads correctly", async function () {
      await carbonNFT.updateGrade(0, Grade.D, 500, "new-uri");
      
      const remainingUploads = await carbonNFT.getRemainingWeeklyUploads(user1.address);
      expect(remainingUploads).to.equal(0); // Used 1 out of 1
      
      const canUpload = await carbonNFT.canUserUpload(user1.address);
      expect(canUpload).to.be.false;
    });

    it("Should prevent exceeding weekly upload limit", async function () {
      // First update should work
      await carbonNFT.updateGrade(0, Grade.D, 500, "new-uri-1");
      
      // Second update in same week should fail
      await expect(
        carbonNFT.updateGrade(0, Grade.C, 600, "new-uri-2")
      ).to.be.revertedWith("Weekly upload limit reached for NFT owner");
    });

    it("Should not update non-existent token", async function () {
      await expect(
        carbonNFT.updateGrade(999, Grade.A, 1000, "new-uri")
      ).to.be.revertedWith("Token does not exist");
    });
  });

  describe("NFT Endorsements", function () {
    beforeEach(async function () {
      await carbonNFT.connect(user1).registerUser(UserType.Individual);
      await carbonNFT.connect(user2).registerUser(UserType.Individual);
      
      // Mint NFTs for both users
      await carbonNFT.mintCarbonNFT(user1.address, "uri1", "theme1", Grade.C, 500);
      await carbonNFT.mintCarbonNFT(user2.address, "uri2", "theme2", Grade.D, 400);
    });

    it("Should allow endorsing other user's NFT", async function () {
      const initialData = await carbonNFT.getNFTData(0);
      const initialScore = initialData.carbonScore;
      
      const tx = await carbonNFT.connect(user2).endorseNFT(0);
      
      await expect(tx)
        .to.emit(carbonNFT, "NFTEndorsed")
        .withArgs(0, user2.address, 1);

      const nftData = await carbonNFT.getNFTData(0);
      expect(nftData.endorsements).to.equal(1);
      expect(nftData.carbonScore).to.equal(initialScore.add(10)); // +10 endorsement reward
    });

    it("Should not allow self-endorsement", async function () {
      await expect(
        carbonNFT.connect(user1).endorseNFT(0)
      ).to.be.revertedWith("Cannot endorse own NFT");
    });

    it("Should not allow double endorsement", async function () {
      await carbonNFT.connect(user2).endorseNFT(0);
      
      await expect(
        carbonNFT.connect(user2).endorseNFT(0)
      ).to.be.revertedWith("Already endorsed this NFT");
    });

    it("Should track endorsement status", async function () {
      expect(await carbonNFT.hasEndorsed(0, user2.address)).to.be.false;
      
      await carbonNFT.connect(user2).endorseNFT(0);
      
      expect(await carbonNFT.hasEndorsed(0, user2.address)).to.be.true;
    });
  });

  describe("Weekly Upload System", function () {
    beforeEach(async function () {
      await carbonNFT.connect(user1).registerUser(UserType.Individual);
      await carbonNFT.mintCarbonNFT(user1.address, "uri", "theme", Grade.F, 100);
    });

    it("Should show correct remaining uploads", async function () {
      let remaining = await carbonNFT.getRemainingWeeklyUploads(user1.address);
      expect(remaining).to.equal(1);
      
      await carbonNFT.updateGrade(0, Grade.D, 200, "new-uri");
      
      remaining = await carbonNFT.getRemainingWeeklyUploads(user1.address);
      expect(remaining).to.equal(0);
    });

    it("Should return correct current week", async function () {
      const currentWeek = await carbonNFT.getCurrentWeek();
      const expectedWeek = Math.floor(Date.now() / 1000 / 604800); // 604800 = seconds per week
      expect(currentWeek).to.be.closeTo(expectedWeek, 1);
    });

    it("Should have correct weekly upload constants", async function () {
      expect(await carbonNFT.MAX_WEEKLY_UPLOADS()).to.equal(1);
      expect(await carbonNFT.ENDORSEMENT_REWARD()).to.equal(10);
      expect(await carbonNFT.SECONDS_PER_WEEK()).to.equal(604800);
    });
  });

  describe("Pagination and Queries", function () {
    beforeEach(async function () {
      await carbonNFT.connect(user1).registerUser(UserType.Individual);
      
      // Mint multiple NFTs
      for (let i = 0; i < 5; i++) {
        await carbonNFT.mintCarbonNFT(
          user1.address,
          `uri-${i}`,
          `theme-${i}`,
          i % 5, // Different grades (0-4 maps to F-A)
          100 + i * 50
        );
      }
    });

    it("Should return active NFTs with pagination", async function () {
      const [tokenIds, nftDataArray] = await carbonNFT.getActiveNFTs(0, 3);
      
      expect(tokenIds.length).to.equal(3);
      expect(nftDataArray.length).to.equal(3);
      
      for (let i = 0; i < 3; i++) {
        expect(tokenIds[i]).to.equal(i);
        expect(nftDataArray[i].isActive).to.be.true;
        expect(nftDataArray[i].theme).to.equal(`theme-${i}`);
      }
    });

    it("Should handle pagination beyond available tokens", async function () {
      const [tokenIds, nftDataArray] = await carbonNFT.getActiveNFTs(10, 5);
      
      expect(tokenIds.length).to.equal(0);
      expect(nftDataArray.length).to.equal(0);
    });

    it("Should return all user NFTs", async function () {
      const userNFTs = await carbonNFT.getUserNFTs(user1.address);
      expect(userNFTs.length).to.equal(5);
      
      for (let i = 0; i < 5; i++) {
        expect(userNFTs[i]).to.equal(i);
      }
    });
  });

  describe("Contract Utilities", function () {
    it("Should support required interfaces", async function () {
      // ERC721 interface
      expect(await carbonNFT.supportsInterface("0x80ac58cd")).to.be.true;
      // ERC721Metadata interface  
      expect(await carbonNFT.supportsInterface("0x5b5e139f")).to.be.true;
    });

    it("Should have correct name and symbol", async function () {
      expect(await carbonNFT.name()).to.equal("CarbonNFT");
      expect(await carbonNFT.symbol()).to.equal("CNFT");
    });

    it("Should return correct owner", async function () {
      expect(await carbonNFT.owner()).to.equal(owner.address);
    });
  });

  describe("Error Cases", function () {
    it("Should revert when getting data for non-existent token", async function () {
      await expect(
        carbonNFT.getNFTData(999)
      ).to.be.revertedWith("Token does not exist");
    });

    it("Should revert when endorsing non-existent token", async function () {
      await carbonNFT.connect(user1).registerUser(UserType.Individual);
      
      await expect(
        carbonNFT.connect(user1).endorseNFT(999)
      ).to.be.revertedWith("Token does not exist");
    });

    it("Should handle empty user NFT arrays", async function () {
      const userNFTs = await carbonNFT.getUserNFTs(user1.address);
      expect(userNFTs.length).to.equal(0);
    });
  });
}); 