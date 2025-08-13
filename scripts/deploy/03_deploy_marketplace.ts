import { ethers } from "hardhat";

async function main() {
  console.log("Deploying Marketplace contract...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Get the CarbonNFT contract address (assuming it's already deployed)
  // In a real deployment, you would get this from a previous deployment or config
  const CarbonNFTFactory = await ethers.getContractFactory("CarbonNFT");
  const carbonNFT = await CarbonNFTFactory.deploy();
  await carbonNFT.deployed();
  console.log("CarbonNFT deployed to:", carbonNFT.address);

  // Deploy the Marketplace contract
  const MarketplaceFactory = await ethers.getContractFactory("Marketplace");
  const marketplace = await MarketplaceFactory.deploy(carbonNFT.address);
  await marketplace.deployed();

  console.log("Marketplace deployed to:", marketplace.address);
  console.log("CarbonNFT address set to:", await marketplace.carbonNFT());
  
  // Verify initial configuration
  console.log("Marketplace fee:", await marketplace.marketplaceFeePercent(), "basis points");
  console.log("Royalty percent:", await marketplace.royaltyPercent(), "basis points");
  
  // Check grade multipliers
  console.log("Grade multipliers:");
  for (let i = 0; i < 5; i++) {
    const multiplier = await marketplace.gradeMultipliers(i);
    console.log(`  Grade ${i}: ${multiplier} basis points`);
  }

  console.log("Deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });