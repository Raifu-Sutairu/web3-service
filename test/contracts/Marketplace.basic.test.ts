import { expect } from "chai";
import { ethers } from "hardhat";
import { CarbonNFT, Marketplace } from "../../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Marketplace Basic Tests", function () {
  let carbonNFT: CarbonNFT;
  let marketplace: Marketplace;
  let owner: SignerWithAddress;
  let seller: SignerWithAddress;
  let buyer: SignerWithAddress;
  
  // Enums matching the contract
  enum UserType { Individual, Company }
  enum Grade { F, D, C, B, A }
  
  beforeEach(async function () {
    [owner, seller, buyer] = await ethers.getSigners();
    
    // Deploy CarbonNFT
    const CarbonNFTFactory = await ethers.getContractFactory("CarbonNFT");
    carbonNFT = await CarbonNFTFactory.deploy() as CarbonNFT;
    await carbonNFT.deployed();
    
    // Deploy Marketplace
    const MarketplaceFactory = await ethers.getContractFactory("Marketplace");
    marketplace = await MarketplaceFactory.deploy(carbonNFT.address) as Marketplace;
    await marketplace.deployed();
  });

  describe("Basic Deployment", function () {
    it("Should deploy successfully", async function () {
      expect(marketplace.address).to.not.equal(ethers.ZeroAddress);
      expect(await marketplace.carbonNFT()).to.equal(carbonNFT.address);
    });

    it("Should have correct initial configuration", async function () {
      expect(await marketplace.marketplaceFeePercent()).to.equal(250);
      expect(await marketplace.royaltyPercent()).to.equal(500);
      expect(await marketplace.owner()).to.equal(owner.address);
    });
  });
});