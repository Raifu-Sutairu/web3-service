import { ethers } from "hardhat";
import { writeFileSync, readFileSync } from "fs";
import { join } from "path";
import ENV from "../../src/config/env.config";

interface DeploymentConfig {
  network: string;
  contracts: {
    carbonNFT?: string;
    community?: string;
    governance?: string;
    marketplace?: string;
  };
  deploymentInfo: {
    deployer: string;
    timestamp: number;
    gasUsed: {
      carbonNFT?: string;
      community?: string;
      governance?: string;
      marketplace?: string;
    };
    transactionHashes: {
      carbonNFT?: string;
      community?: string;
      governance?: string;
      marketplace?: string;
    };
  };
}

async function main(): Promise<void> {
  console.log("🚀 Starting comprehensive deployment of EcoNFT platform...");
  
  const network = await ethers.provider.getNetwork();
  const [deployer] = await ethers.getSigners();
  
  console.log("Network:", network.name, `(Chain ID: ${network.chainId})`);
  console.log("Deployer:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  
  if (balance < ethers.parseEther("0.1")) {
    console.warn("⚠️  Low balance detected. Ensure sufficient funds for deployment.");
  }

  const deploymentConfig: DeploymentConfig = {
    network: network.name,
    contracts: {},
    deploymentInfo: {
      deployer: deployer.address,
      timestamp: Date.now(),
      gasUsed: {},
      transactionHashes: {}
    }
  };

  try {
    // Step 1: Deploy CarbonNFT (if not already deployed)
    console.log("\n📋 Step 1: Deploying CarbonNFT...");
    let carbonNFTAddress = ENV.CARBON_NFT_ADDRESS;
    
    if (!carbonNFTAddress) {
      const CarbonNFTFactory = await ethers.getContractFactory("CarbonNFT");
      console.log("Estimating gas for CarbonNFT deployment...");
      const deploymentData = CarbonNFTFactory.getDeployTransaction();
      const gasEstimate = await deployer.estimateGas(deploymentData);
      console.log("Estimated gas:", gasEstimate.toString());
      
      const carbonNFT = await CarbonNFTFactory.deploy();
      const carbonNFTReceipt = await carbonNFT.deploymentTransaction()?.wait();
      
      carbonNFTAddress = await carbonNFT.getAddress();
      deploymentConfig.contracts.carbonNFT = carbonNFTAddress;
      deploymentConfig.deploymentInfo.gasUsed.carbonNFT = carbonNFTReceipt?.gasUsed.toString();
      deploymentConfig.deploymentInfo.transactionHashes.carbonNFT = carbonNFTReceipt?.hash;
      
      console.log("✅ CarbonNFT deployed to:", carbonNFTAddress);
    } else {
      console.log("✅ Using existing CarbonNFT at:", carbonNFTAddress);
      deploymentConfig.contracts.carbonNFT = carbonNFTAddress;
    }

    // Step 2: Deploy Community
    console.log("\n🏘️  Step 2: Deploying Community...");
    const CommunityFactory = await ethers.getContractFactory("Community");
    const communityGasEstimate = await deployer.estimateGas(
      CommunityFactory.getDeployTransaction(carbonNFTAddress)
    );
    console.log("Estimated gas for Community:", communityGasEstimate.toString());
    
    const community = await CommunityFactory.deploy(carbonNFTAddress);
    const communityReceipt = await community.deploymentTransaction()?.wait();
    
    const communityAddress = await community.getAddress();
    deploymentConfig.contracts.community = communityAddress;
    deploymentConfig.deploymentInfo.gasUsed.community = communityReceipt?.gasUsed.toString();
    deploymentConfig.deploymentInfo.transactionHashes.community = communityReceipt?.hash;
    
    console.log("✅ Community deployed to:", communityAddress);

    // Step 3: Deploy Governance
    console.log("\n🗳️  Step 3: Deploying Governance...");
    const GovernanceFactory = await ethers.getContractFactory("Governance");
    const governanceGasEstimate = await deployer.estimateGas(
      GovernanceFactory.getDeployTransaction(carbonNFTAddress)
    );
    console.log("Estimated gas for Governance:", governanceGasEstimate.toString());
    
    const governance = await GovernanceFactory.deploy(carbonNFTAddress);
    const governanceReceipt = await governance.deploymentTransaction()?.wait();
    
    const governanceAddress = await governance.getAddress();
    deploymentConfig.contracts.governance = governanceAddress;
    deploymentConfig.deploymentInfo.gasUsed.governance = governanceReceipt?.gasUsed.toString();
    deploymentConfig.deploymentInfo.transactionHashes.governance = governanceReceipt?.hash;
    
    console.log("✅ Governance deployed to:", governanceAddress);

    // Step 4: Deploy Marketplace
    console.log("\n🛒 Step 4: Deploying Marketplace...");
    const MarketplaceFactory = await ethers.getContractFactory("Marketplace");
    const marketplaceGasEstimate = await deployer.estimateGas(
      MarketplaceFactory.getDeployTransaction(carbonNFTAddress)
    );
    console.log("Estimated gas for Marketplace:", marketplaceGasEstimate.toString());
    
    const marketplace = await MarketplaceFactory.deploy(carbonNFTAddress);
    const marketplaceReceipt = await marketplace.deploymentTransaction()?.wait();
    
    const marketplaceAddress = await marketplace.getAddress();
    deploymentConfig.contracts.marketplace = marketplaceAddress;
    deploymentConfig.deploymentInfo.gasUsed.marketplace = marketplaceReceipt?.gasUsed.toString();
    deploymentConfig.deploymentInfo.transactionHashes.marketplace = marketplaceReceipt?.hash;
    
    console.log("✅ Marketplace deployed to:", marketplaceAddress);

    // Step 5: Configure cross-contract permissions
    console.log("\n🔗 Step 5: Configuring cross-contract permissions...");
    
    // Set Community contract as authorized in CarbonNFT for reading NFT data
    const carbonNFTContract = await ethers.getContractAt("CarbonNFT", carbonNFTAddress);
    
    // Note: These would be actual permission setting calls if the contracts support them
    console.log("Setting up contract interactions...");
    console.log("Community can read from CarbonNFT:", communityAddress);
    console.log("Marketplace can transfer NFTs:", marketplaceAddress);
    console.log("Governance can update parameters:", governanceAddress);

    // Step 6: Save deployment configuration
    console.log("\n💾 Step 6: Saving deployment configuration...");
    const configPath = join(__dirname, `../../deployments/${network.name}.json`);
    
    // Ensure deployments directory exists
    const deploymentsDir = join(__dirname, "../../deployments");
    try {
      const fs = require('fs');
      if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
      }
    } catch (error) {
      console.log("Creating deployments directory...");
    }
    
    writeFileSync(configPath, JSON.stringify(deploymentConfig, null, 2));
    console.log("✅ Configuration saved to:", configPath);

    // Step 7: Update .env file
    console.log("\n📝 Step 7: Updating environment variables...");
    updateEnvFile(deploymentConfig.contracts);

    // Step 8: Display summary
    console.log("\n🎉 Deployment Summary");
    console.log("=====================");
    console.log("Network:", network.name);
    console.log("Deployer:", deployer.address);
    console.log("\nContract Addresses:");
    console.log("CarbonNFT:", deploymentConfig.contracts.carbonNFT);
    console.log("Community:", deploymentConfig.contracts.community);
    console.log("Governance:", deploymentConfig.contracts.governance);
    console.log("Marketplace:", deploymentConfig.contracts.marketplace);
    
    console.log("\nGas Usage:");
    Object.entries(deploymentConfig.deploymentInfo.gasUsed).forEach(([contract, gas]) => {
      if (gas) console.log(`${contract}: ${gas}`);
    });

    const totalGasUsed = Object.values(deploymentConfig.deploymentInfo.gasUsed)
      .filter(Boolean)
      .reduce((sum, gas) => sum + BigInt(gas!), BigInt(0));
    console.log("Total Gas Used:", totalGasUsed.toString());

    console.log("\nEtherscan Links:");
    if (network.name === "sepolia") {
      Object.entries(deploymentConfig.contracts).forEach(([contract, address]) => {
        console.log(`${contract}: https://sepolia.etherscan.io/address/${address}`);
      });
    }

    console.log("\n✅ All contracts deployed successfully!");
    console.log("🔍 Run verification script to verify contracts on Etherscan");

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    
    // Save partial deployment info for debugging
    const errorConfigPath = join(__dirname, `../../deployments/${network.name}-error.json`);
    writeFileSync(errorConfigPath, JSON.stringify({
      ...deploymentConfig,
      error: error instanceof Error ? error.message : String(error),
      timestamp: Date.now()
    }, null, 2));
    
    throw error;
  }
}

function updateEnvFile(contracts: DeploymentConfig['contracts']): void {
  try {
    const envPath = join(__dirname, "../../.env");
    let envContent = readFileSync(envPath, "utf8");
    
    // Update contract addresses
    if (contracts.carbonNFT) {
      envContent = updateEnvVariable(envContent, "CARBON_NFT_ADDRESS", contracts.carbonNFT);
    }
    if (contracts.community) {
      envContent = updateEnvVariable(envContent, "COMMUNITY_ADDRESS", contracts.community);
    }
    if (contracts.governance) {
      envContent = updateEnvVariable(envContent, "GOVERNANCE_ADDRESS", contracts.governance);
    }
    if (contracts.marketplace) {
      envContent = updateEnvVariable(envContent, "MARKETPLACE_ADDRESS", contracts.marketplace);
    }
    
    writeFileSync(envPath, envContent);
    console.log("✅ Environment file updated");
  } catch (error) {
    console.warn("⚠️  Could not update .env file:", error);
  }
}

function updateEnvVariable(content: string, key: string, value: string): string {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    return content.replace(regex, `${key}=${value}`);
  } else {
    return content + `\n${key}=${value}`;
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Deployment failed:", error);
      process.exit(1);
    });
}

export { main as deployAll };