import { expect } from "chai";
import { ethers } from "hardhat";
import { CarbonNFT, Marketplace } from "../../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Marketplace", function () {
  let carbonNFT: CarbonNFT;
  let marketplace: Marketplace;
  let owner: SignerWithAddress;
  let seller: SignerWithAddress;
  let buyer: SignerWithAddress;
  let user3: SignerWithAddress;
  
  // Enums matching the contract
  enum UserType { Individual, Company }
  enum Grade { F, D, C, B, A }
  
  const BASE_PRICE = ethers.parseEther("0.01");
  const LISTING_PRICE = ethers.parseEther("0.1");
  
  beforeEach(async function () {
    [owner, seller, buyer, user3] = await ethers.getSigners();
    
    // Deploy CarbonNFT
    const CarbonNFTFactory = await ethers.getContractFactory("CarbonNFT");
    carbonNFT = await CarbonNFTFactory.deploy() as CarbonNFT;
    await carbonNFT.deployed();
    
    // Deploy Marketplace
    const MarketplaceFactory = await ethers.getContractFactory("Marketplace");
    marketplace = await MarketplaceFactory.deploy(carbonNFT.address) as Marketplace;
    await marketplace.deployed();
    
    // Register users and mint test NFTs
    await carbonNFT.connect(seller).registerUser(UserType.Individual);
    await carbonNFT.connect(buyer).registerUser(UserType.Individual);
    await carbonNFT.connect(user3).registerUser(UserType.Individual);
    
    // Mint NFTs with different grades for testing
    await carbonNFT.mintCarbonNFT(seller.address, "uri-0", "Ocean", Grade.C, 500);
    await carbonNFT.mintCarbonNFT(seller.address, "uri-1", "Forest", Grade.A, 900);
    await carbonNFT.mintCarbonNFT(buyer.address, "uri-2", "Mountain", Grade.B, 750);
  });

  describe("Deployment", function () {
    it("Should set correct CarbonNFT address", async function () {
      expect(await marketplace.carbonNFT()).to.equal(carbonNFT.address);
    });

    it("Should set correct initial fees", async function () {
      expect(await marketplace.marketplaceFeePercent()).to.equal(250); // 2.5%
      expect(await marketplace.royaltyPercent()).to.equal(500); // 5%
    });

    it("Should set correct grade multipliers", async function () {
      expect(await marketplace.gradeMultipliers(Grade.F)).to.equal(5000);  // 0.5x
      expect(await marketplace.gradeMultipliers(Grade.D)).to.equal(7500);  // 0.75x
      expect(await marketplace.gradeMultipliers(Grade.C)).to.equal(10000); // 1.0x
      expect(await marketplace.gradeMultipliers(Grade.B)).to.equal(15000); // 1.5x
      expect(await marketplace.gradeMultipliers(Grade.A)).to.equal(20000); // 2.0x
    });

    it("Should set correct owner", async function () {
      expect(await marketplace.owner()).to.equal(owner.address);
    });
  });

  describe("NFT Listing", function () {
    it("Should list NFT successfully", async function () {
      // Approve marketplace to transfer NFT
      await carbonNFT.connect(seller).approve(marketplace.address, 0);
      
      const tx = await marketplace.connect(seller).listNFT(0, LISTING_PRICE);
      
      await expect(tx)
        .to.emit(marketplace, "NFTListed")
        .withArgs(1, 0, seller.address, LISTING_PRICE);
      
      // Check NFT is now owned by marketplace (escrow)
      expect(await carbonNFT.ownerOf(0)).to.equal(marketplace.address);
      
      // Check listing details
      const listing = await marketplace.getListing(1);
      expect(listing.tokenId).to.equal(0);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.price).to.equal(LISTING_PRICE);
      expect(listing.isActive).to.be.true;
    });

    it("Should update token to listing mapping", async function () {
      await carbonNFT.connect(seller).approve(marketplace.address, 0);
      await marketplace.connect(seller).listNFT(0, LISTING_PRICE);
      
      expect(await marketplace.tokenToListing(0)).to.equal(1);
      expect(await marketplace.isTokenListed(0)).to.be.true;
    });

    it("Should add listing to seller's listings", async function () {
      await carbonNFT.connect(seller).approve(marketplace.address, 0);
      await marketplace.connect(seller).listNFT(0, LISTING_PRICE);
      
      const sellerListings = await marketplace.getSellerListings(seller.address);
      expect(sellerListings.length).to.equal(1);
      expect(sellerListings[0]).to.equal(1);
    });

    it("Should revert if price is zero", async function () {
      await carbonNFT.connect(seller).approve(marketplace.address, 0);
      
      await expect(
        marketplace.connect(seller).listNFT(0, 0)
      ).to.be.revertedWithCustomError(marketplace, "InvalidPrice");
    });

    it("Should revert if not token owner", async function () {
      await expect(
        marketplace.connect(buyer).listNFT(0, LISTING_PRICE)
      ).to.be.revertedWithCustomError(marketplace, "NotTokenOwner");
    });

    it("Should revert if token already listed", async function () {
      await carbonNFT.connect(seller).approve(marketplace.address, 0);
      await marketplace.connect(seller).listNFT(0, LISTING_PRICE);
      
      // Try to list the same token again (need to approve again since it's in escrow)
      await expect(
        marketplace.connect(seller).listNFT(0, LISTING_PRICE)
      ).to.be.revertedWithCustomError(marketplace, "TokenAlreadyListed");
    });

    it("Should handle multiple listings from same seller", async function () {
      // List first NFT
      await carbonNFT.connect(seller).approve(marketplace.address, 0);
      await marketplace.connect(seller).listNFT(0, LISTING_PRICE);
      
      // List second NFT
      await carbonNFT.connect(seller).approve(marketplace.address, 1);
      await marketplace.connect(seller).listNFT(1, LISTING_PRICE * 2n);
      
      const sellerListings = await marketplace.getSellerListings(seller.address);
      expect(sellerListings.length).to.equal(2);
      expect(sellerListings[0]).to.equal(1);
      expect(sellerListings[1]).to.equal(2);
    });
  });

  describe("NFT Purchase", function () {
    beforeEach(async function () {
      // List NFT for testing
      await carbonNFT.connect(seller).approve(marketplace.address, 0);
      await marketplace.connect(seller).listNFT(0, LISTING_PRICE);
    });

    it("Should purchase NFT successfully", async function () {
      const sellerBalanceBefore = await seller.getBalance();
      const ownerBalanceBefore = await owner.getBalance();
      const carbonNFTOwnerBalanceBefore = await carbonNFT.owner().then(addr => ethers.provider.getBalance(addr));
      
      const tx = await marketplace.connect(buyer).buyNFT(1, { value: LISTING_PRICE });
      
      await expect(tx)
        .to.emit(marketplace, "NFTSold")
        .withArgs(1, 0, seller.address, buyer.address, LISTING_PRICE, LISTING_PRICE * 250n / 10000n, LISTING_PRICE * 500n / 10000n);
      
      // Check NFT ownership transferred
      expect(await carbonNFT.ownerOf(0)).to.equal(buyer.address);
      
      // Check listing is inactive
      const listing = await marketplace.getListing(1);
      expect(listing.isActive).to.be.false;
      expect(await marketplace.tokenToListing(0)).to.equal(0);
      expect(await marketplace.isTokenListed(0)).to.be.false;
      
      // Check payment distribution
      const marketplaceFee = LISTING_PRICE * 250n / 10000n; // 2.5%
      const royalty = LISTING_PRICE * 500n / 10000n; // 5%
      const sellerAmount = LISTING_PRICE - marketplaceFee - royalty;
      
      const sellerBalanceAfter = await seller.getBalance();
      const ownerBalanceAfter = await owner.getBalance();
      const carbonNFTOwnerBalanceAfter = await carbonNFT.owner().then(addr => ethers.provider.getBalance(addr));
      
      expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(sellerAmount);
      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(marketplaceFee);
      expect(carbonNFTOwnerBalanceAfter - carbonNFTOwnerBalanceBefore).to.equal(royalty);
    });

    it("Should refund excess payment", async function () {
      const excessAmount = ethers.parseEther("0.05");
      const totalPayment = LISTING_PRICE + excessAmount;
      
      const buyerBalanceBefore = await buyer.getBalance();
      
      const tx = await marketplace.connect(buyer).buyNFT(1, { value: totalPayment });
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.effectiveGasPrice;
      
      const buyerBalanceAfter = await buyer.getBalance();
      
      // Buyer should only pay the listing price + gas
      expect(buyerBalanceBefore - buyerBalanceAfter).to.equal(LISTING_PRICE + gasUsed);
    });

    it("Should revert if listing not found", async function () {
      await expect(
        marketplace.connect(buyer).buyNFT(999, { value: LISTING_PRICE })
      ).to.be.revertedWithCustomError(marketplace, "ListingNotFound");
    });

    it("Should revert if listing not active", async function () {
      // Buy the NFT first
      await marketplace.connect(buyer).buyNFT(1, { value: LISTING_PRICE });
      
      // Try to buy again
      await expect(
        marketplace.connect(user3).buyNFT(1, { value: LISTING_PRICE })
      ).to.be.revertedWithCustomError(marketplace, "ListingNotActive");
    });

    it("Should revert if insufficient funds", async function () {
      const insufficientAmount = LISTING_PRICE - ethers.parseEther("0.01");
      
      await expect(
        marketplace.connect(buyer).buyNFT(1, { value: insufficientAmount })
      ).to.be.revertedWithCustomError(marketplace, "InsufficientFunds");
    });
  });

  describe("Listing Management", function () {
    beforeEach(async function () {
      await carbonNFT.connect(seller).approve(marketplace.address, 0);
      await marketplace.connect(seller).listNFT(0, LISTING_PRICE);
    });

    it("Should cancel listing successfully", async function () {
      const tx = await marketplace.connect(seller).cancelListing(1);
      
      await expect(tx)
        .to.emit(marketplace, "ListingCancelled")
        .withArgs(1, 0, seller.address);
      
      // Check NFT returned to seller
      expect(await carbonNFT.ownerOf(0)).to.equal(seller.address);
      
      // Check listing is inactive
      const listing = await marketplace.getListing(1);
      expect(listing.isActive).to.be.false;
      expect(await marketplace.tokenToListing(0)).to.equal(0);
    });

    it("Should update listing price", async function () {
      const newPrice = ethers.parseEther("0.2");
      
      const tx = await marketplace.connect(seller).updateListingPrice(1, newPrice);
      
      await expect(tx)
        .to.emit(marketplace, "PriceUpdated")
        .withArgs(1, 0, LISTING_PRICE, newPrice);
      
      const listing = await marketplace.getListing(1);
      expect(listing.price).to.equal(newPrice);
    });

    it("Should revert cancel if not seller", async function () {
      await expect(
        marketplace.connect(buyer).cancelListing(1)
      ).to.be.revertedWithCustomError(marketplace, "UnauthorizedAccess");
    });

    it("Should revert price update if not seller", async function () {
      await expect(
        marketplace.connect(buyer).updateListingPrice(1, ethers.parseEther("0.2"))
      ).to.be.revertedWithCustomError(marketplace, "UnauthorizedAccess");
    });

    it("Should revert price update with zero price", async function () {
      await expect(
        marketplace.connect(seller).updateListingPrice(1, 0)
      ).to.be.revertedWithCustomError(marketplace, "InvalidPrice");
    });
  });

  describe("Price Suggestions", function () {
    it("Should calculate correct suggested prices for different grades", async function () {
      // Grade F (0.5x multiplier)
      const priceF = await marketplace.getSuggestedPrice(0); // Grade C NFT, but let's test with different grades
      
      // We need to check the actual NFT grades
      const nftData0 = await carbonNFT.getNFTData(0); // Grade C
      const nftData1 = await carbonNFT.getNFTData(1); // Grade A
      const nftData2 = await carbonNFT.getNFTData(2); // Grade B
      
      const expectedPriceC = BASE_PRICE * 10000n / 10000n; // 1.0x for Grade C
      const expectedPriceA = BASE_PRICE * 20000n / 10000n; // 2.0x for Grade A
      const expectedPriceB = BASE_PRICE * 15000n / 10000n; // 1.5x for Grade B
      
      expect(await marketplace.getSuggestedPrice(0)).to.equal(expectedPriceC);
      expect(await marketplace.getSuggestedPrice(1)).to.equal(expectedPriceA);
      expect(await marketplace.getSuggestedPrice(2)).to.equal(expectedPriceB);
    });
  });

  describe("Listing Queries", function () {
    beforeEach(async function () {
      // Create multiple listings
      await carbonNFT.connect(seller).approve(marketplace.address, 0);
      await marketplace.connect(seller).listNFT(0, LISTING_PRICE);
      
      await carbonNFT.connect(seller).approve(marketplace.address, 1);
      await marketplace.connect(seller).listNFT(1, LISTING_PRICE * 2n);
      
      await carbonNFT.connect(buyer).approve(marketplace.address, 2);
      await marketplace.connect(buyer).listNFT(2, LISTING_PRICE / 2n);
    });

    it("Should get active listings with pagination", async function () {
      const listings = await marketplace.getActiveListings(0, 2);
      
      expect(listings.length).to.equal(2);
      expect(listings[0].tokenId).to.equal(0);
      expect(listings[0].seller).to.equal(seller.address);
      expect(listings[1].tokenId).to.equal(1);
      expect(listings[1].seller).to.equal(seller.address);
    });

    it("Should get listing by token ID", async function () {
      const listing = await marketplace.getListingByToken(0);
      
      expect(listing.tokenId).to.equal(0);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.price).to.equal(LISTING_PRICE);
      expect(listing.isActive).to.be.true;
    });

    it("Should revert when getting listing for unlisted token", async function () {
      // Mint a new NFT that's not listed
      await carbonNFT.mintCarbonNFT(user3.address, "uri-3", "Desert", Grade.D, 300);
      
      await expect(
        marketplace.getListingByToken(3)
      ).to.be.revertedWithCustomError(marketplace, "ListingNotFound");
    });

    it("Should get seller listings", async function () {
      const sellerListings = await marketplace.getSellerListings(seller.address);
      const buyerListings = await marketplace.getSellerListings(buyer.address);
      
      expect(sellerListings.length).to.equal(2);
      expect(sellerListings[0]).to.equal(1);
      expect(sellerListings[1]).to.equal(2);
      
      expect(buyerListings.length).to.equal(1);
      expect(buyerListings[0]).to.equal(3);
    });

    it("Should get marketplace statistics", async function () {
      const [totalListings, activeListings, totalVolume] = await marketplace.getMarketplaceStats();
      
      expect(totalListings).to.equal(3);
      expect(activeListings).to.equal(3);
      expect(totalVolume).to.equal(0); // Not tracked in current version
    });

    it("Should get total listings count", async function () {
      expect(await marketplace.getTotalListings()).to.equal(3);
    });
  });

  describe("Admin Functions", function () {
    it("Should update marketplace fee", async function () {
      const newFee = 300; // 3%
      
      const tx = await marketplace.connect(owner).setMarketplaceFee(newFee);
      
      await expect(tx)
        .to.emit(marketplace, "MarketplaceFeeUpdated")
        .withArgs(250, newFee);
      
      expect(await marketplace.marketplaceFeePercent()).to.equal(newFee);
    });

    it("Should update royalty percent", async function () {
      const newRoyalty = 750; // 7.5%
      
      const tx = await marketplace.connect(owner).setRoyaltyPercent(newRoyalty);
      
      await expect(tx)
        .to.emit(marketplace, "RoyaltyUpdated")
        .withArgs(500, newRoyalty);
      
      expect(await marketplace.royaltyPercent()).to.equal(newRoyalty);
    });

    it("Should update grade multiplier", async function () {
      const newMultiplier = 25000; // 2.5x
      
      const tx = await marketplace.connect(owner).setGradeMultiplier(Grade.A, newMultiplier);
      
      await expect(tx)
        .to.emit(marketplace, "GradeMultiplierUpdated")
        .withArgs(Grade.A, newMultiplier);
      
      expect(await marketplace.gradeMultipliers(Grade.A)).to.equal(newMultiplier);
    });

    it("Should revert fee update if too high", async function () {
      await expect(
        marketplace.connect(owner).setMarketplaceFee(1001) // > 10%
      ).to.be.revertedWithCustomError(marketplace, "InvalidFeePercent");
    });

    it("Should revert royalty update if too high", async function () {
      await expect(
        marketplace.connect(owner).setRoyaltyPercent(1001) // > 10%
      ).to.be.revertedWithCustomError(marketplace, "InvalidFeePercent");
    });

    it("Should revert admin functions if not owner", async function () {
      await expect(
        marketplace.connect(seller).setMarketplaceFee(300)
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      await expect(
        marketplace.connect(seller).setRoyaltyPercent(600)
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      await expect(
        marketplace.connect(seller).setGradeMultiplier(Grade.A, 25000)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should withdraw accumulated fees", async function () {
      // Create and complete a sale to generate fees
      await carbonNFT.connect(seller).approve(marketplace.address, 0);
      await marketplace.connect(seller).listNFT(0, LISTING_PRICE);
      await marketplace.connect(buyer).buyNFT(1, { value: LISTING_PRICE });
      
      const ownerBalanceBefore = await owner.getBalance();
      
      const tx = await marketplace.connect(owner).withdrawFees();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.effectiveGasPrice;
      
      const ownerBalanceAfter = await owner.getBalance();
      
      // Owner should have received marketplace fees minus gas costs
      // (Note: marketplace fees were already transferred during the sale, so this tests the withdraw function structure)
      expect(ownerBalanceAfter - ownerBalanceBefore + gasUsed).to.equal(0);
    });

    it("Should emergency cancel listing", async function () {
      await carbonNFT.connect(seller).approve(marketplace.address, 0);
      await marketplace.connect(seller).listNFT(0, LISTING_PRICE);
      
      const tx = await marketplace.connect(owner).emergencyCancelListing(1);
      
      await expect(tx)
        .to.emit(marketplace, "ListingCancelled")
        .withArgs(1, 0, seller.address);
      
      // Check NFT returned to seller
      expect(await carbonNFT.ownerOf(0)).to.equal(seller.address);
      
      // Check listing is inactive
      const listing = await marketplace.getListing(1);
      expect(listing.isActive).to.be.false;
    });
  });

  describe("Edge Cases and Error Handling", function () {
    it("Should handle ERC721 received correctly", async function () {
      // This is tested implicitly when listing NFTs, but we can test the function directly
      const selector = await marketplace.onERC721Received(
        owner.address,
        seller.address,
        0,
        "0x"
      );
      
      expect(selector).to.equal("0x150b7a02"); // ERC721Receiver selector
    });

    it("Should handle empty active listings", async function () {
      const listings = await marketplace.getActiveListings(0, 10);
      expect(listings.length).to.equal(0);
    });

    it("Should handle pagination beyond available listings", async function () {
      await carbonNFT.connect(seller).approve(marketplace.address, 0);
      await marketplace.connect(seller).listNFT(0, LISTING_PRICE);
      
      const listings = await marketplace.getActiveListings(10, 5);
      expect(listings.length).to.equal(0);
    });

    it("Should handle seller with no listings", async function () {
      const listings = await marketplace.getSellerListings(user3.address);
      expect(listings.length).to.equal(0);
    });

    it("Should revert operations on cancelled listings", async function () {
      await carbonNFT.connect(seller).approve(marketplace.address, 0);
      await marketplace.connect(seller).listNFT(0, LISTING_PRICE);
      await marketplace.connect(seller).cancelListing(1);
      
      await expect(
        marketplace.connect(seller).cancelListing(1)
      ).to.be.revertedWithCustomError(marketplace, "ListingNotActive");
      
      await expect(
        marketplace.connect(seller).updateListingPrice(1, LISTING_PRICE * 2n)
      ).to.be.revertedWithCustomError(marketplace, "ListingNotActive");
    });

    it("Should handle contract with zero balance withdrawal", async function () {
      // Should not revert even if balance is 0
      await expect(marketplace.connect(owner).withdrawFees()).to.not.be.reverted;
    });
  });

  describe("Integration with CarbonNFT", function () {
    it("Should correctly read NFT data for price suggestions", async function () {
      // Test that marketplace correctly interfaces with CarbonNFT
      const nftData = await carbonNFT.getNFTData(1); // Grade A NFT
      expect(nftData.currentGrade).to.equal(Grade.A);
      
      const suggestedPrice = await marketplace.getSuggestedPrice(1);
      const expectedPrice = BASE_PRICE * 20000n / 10000n; // 2.0x for Grade A
      expect(suggestedPrice).to.equal(expectedPrice);
    });

    it("Should handle NFT transfers correctly", async function () {
      await carbonNFT.connect(seller).approve(marketplace.address, 0);
      await marketplace.connect(seller).listNFT(0, LISTING_PRICE);
      
      // NFT should be in marketplace escrow
      expect(await carbonNFT.ownerOf(0)).to.equal(marketplace.address);
      
      // Complete purchase
      await marketplace.connect(buyer).buyNFT(1, { value: LISTING_PRICE });
      
      // NFT should be with buyer
      expect(await carbonNFT.ownerOf(0)).to.equal(buyer.address);
    });

    it("Should prevent listing NFTs not owned by caller", async function () {
      // Try to list NFT owned by buyer
      await expect(
        marketplace.connect(seller).listNFT(2, LISTING_PRICE)
      ).to.be.revertedWithCustomError(marketplace, "NotTokenOwner");
    });
  });
});