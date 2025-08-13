import { ethers } from "hardhat";

async function main() {
  console.log("Deploying Community contract...");

  // Get the contract factories
  const CarbonNFT = await ethers.getContractFactory("CarbonNFT");
  const Community = await ethers.getContractFactory("Community");

  // Deploy CarbonNFT first (or use existing address)
  console.log("Deploying CarbonNFT...");
  const carbonNFT = await CarbonNFT.deploy();
  await carbonNFT.deployed();
  console.log("CarbonNFT deployed to:", carbonNFT.address);

  // Deploy Community contract
  console.log("Deploying Community...");
  const community = await Community.deploy(carbonNFT.address);
  await community.deployed();
  console.log("Community deployed to:", community.address);

  // Verify deployment
  console.log("Verifying deployment...");
  const carbonNFTAddress = await community.carbonNFT();
  console.log("Community contract references CarbonNFT at:", carbonNFTAddress);
  
  if (carbonNFTAddress === carbonNFT.address) {
    console.log("✅ Community contract successfully deployed and configured!");
  } else {
    console.log("❌ Community contract configuration error!");
  }

  return {
    carbonNFT: carbonNFT.address,
    community: community.address
  };
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then((addresses) => {
    console.log("Deployment completed successfully!");
    console.log("Contract addresses:", addresses);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });