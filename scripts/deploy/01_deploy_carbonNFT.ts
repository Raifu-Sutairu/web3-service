import { ethers } from "hardhat";
import { CarbonNFT } from "../../typechain-types";
import ENV from "../../src/config/env.config";

async function main(): Promise<void> {
  console.log("🚀 Deploying CarbonNFT contract...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Get account balance
  const balance = await deployer.getBalance();
  console.log("Account balance:", ethers.utils.formatEther(balance), "ETH");

  // Deploy the contract
  const CarbonNFTFactory = await ethers.getContractFactory("CarbonNFT");
  const carbonNFT: CarbonNFT = await CarbonNFTFactory.deploy();
  
  await carbonNFT.deployed();

  console.log("✅ CarbonNFT deployed to:", carbonNFT.address);
  console.log("🔗 Transaction hash:", carbonNFT.deployTransaction.hash);
  
  // Save contract address to environment
  console.log(`\n📝 Add this to your .env.${ENV.NODE_ENV}.local file:`);
  console.log(`CARBON_NFT_ADDRESS=${carbonNFT.address}`);
  
  // Test basic functionality
  console.log("\n🧪 Testing basic functions...");
  
  try {
    // Test user registration
    console.log("Testing user registration...");
    const registerTx = await carbonNFT.registerUser(0); // 0 = Individual
    await registerTx.wait();
    console.log("✅ User registered successfully");
    
    // Test NFT minting
    console.log("Testing NFT minting...");
    const mintTx = await carbonNFT.mintCarbonNFT(
      deployer.address,
      "https://ipfs.io/ipfs/test-metadata-hash", // placeholder URI
      "Forest Nature Theme",
      4, // Grade F (4 in enum)
      100 // initial score
    );
    const mintReceipt = await mintTx.wait();
    console.log("✅ NFT minted successfully");
    console.log("Gas used for minting:", mintReceipt.gasUsed.toString());
    
    // Check user's NFTs
    const userNFTs = await carbonNFT.getUserNFTs(deployer.address);
    console.log("User's NFTs:", userNFTs.map(id => id.toString()));
    
    // Get NFT data
    if (userNFTs.length > 0) {
      const nftData = await carbonNFT.getNFTData(userNFTs[0]);
      console.log("NFT Data:", {
        grade: nftData.currentGrade.toString(),
        score: nftData.carbonScore.toString(),
        endorsements: nftData.endorsements.toString(),
        theme: nftData.theme,
        isActive: nftData.isActive,
        mintedAt: new Date(nftData.mintedAt.toNumber() * 1000).toISOString()
      });
    }
    
    // Test weekly upload check
    const canUpload = await carbonNFT.canUserUpload(deployer.address);
    console.log("Can user upload this week?", canUpload);
    
    const remainingUploads = await carbonNFT.getRemainingWeeklyUploads(deployer.address);
    console.log("Remaining weekly uploads:", remainingUploads.toString());

    // Test grade update
    console.log("\nTesting grade update...");
    const updateTx = await carbonNFT.updateGrade(
      userNFTs[0],
      3, // Grade D
      250,
      "https://ipfs.io/ipfs/updated-metadata-hash"
    );
    await updateTx.wait();
    console.log("✅ Grade updated successfully");

    // Check updated data
    const updatedNFTData = await carbonNFT.getNFTData(userNFTs[0]);
    console.log("Updated NFT Grade:", updatedNFTData.currentGrade.toString());
    console.log("Updated NFT Score:", updatedNFTData.carbonScore.toString());

  } catch (error) {
    console.error("❌ Testing failed:", error);
  }

  console.log("\n🎉 Deployment and testing completed!");
  console.log("📝 Contract Address:", carbonNFT.address);
  console.log("🔗 Etherscan:", `https://sepolia.etherscan.io/address/${carbonNFT.address}`);

  // Return deployment info
  return;
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });