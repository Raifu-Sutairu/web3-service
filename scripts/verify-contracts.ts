import { run } from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";

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
  };
}

async function verifyContract(
  contractAddress: string,
  constructorArguments: any[] = [],
  contractName?: string
): Promise<boolean> {
  try {
    console.log(`🔍 Verifying ${contractName || 'contract'} at ${contractAddress}...`);
    
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: constructorArguments,
    });
    
    console.log(`✅ ${contractName || 'Contract'} verified successfully!`);
    return true;
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log(`✅ ${contractName || 'Contract'} already verified`);
      return true;
    } else {
      console.error(`❌ Failed to verify ${contractName || 'contract'}:`, error.message);
      return false;
    }
  }
}

async function main(): Promise<void> {
  console.log("🔍 Starting contract verification...");
  
  // Get network name
  const network = await require("hardhat").ethers.provider.getNetwork();
  const networkName = network.name;
  
  console.log("Network:", networkName);
  
  // Load deployment configuration
  const configPath = join(__dirname, `../deployments/${networkName}.json`);
  let deploymentConfig: DeploymentConfig;
  
  try {
    const configContent = readFileSync(configPath, "utf8");
    deploymentConfig = JSON.parse(configContent);
  } catch (error) {
    console.error("❌ Could not load deployment configuration:", error);
    console.log("Make sure you have deployed contracts first using the deployment script");
    process.exit(1);
  }
  
  const { contracts } = deploymentConfig;
  const verificationResults: Record<string, boolean> = {};
  
  // Verify CarbonNFT (no constructor arguments)
  if (contracts.carbonNFT) {
    verificationResults.carbonNFT = await verifyContract(
      contracts.carbonNFT,
      [], // CarbonNFT has no constructor arguments
      "CarbonNFT"
    );
  }
  
  // Verify Community (constructor argument: carbonNFT address)
  if (contracts.community && contracts.carbonNFT) {
    verificationResults.community = await verifyContract(
      contracts.community,
      [contracts.carbonNFT], // Community constructor takes CarbonNFT address
      "Community"
    );
  }
  
  // Verify Governance (constructor argument: carbonNFT address)
  if (contracts.governance && contracts.carbonNFT) {
    verificationResults.governance = await verifyContract(
      contracts.governance,
      [contracts.carbonNFT], // Governance constructor takes CarbonNFT address
      "Governance"
    );
  }
  
  // Verify Marketplace (constructor argument: carbonNFT address)
  if (contracts.marketplace && contracts.carbonNFT) {
    verificationResults.marketplace = await verifyContract(
      contracts.marketplace,
      [contracts.carbonNFT], // Marketplace constructor takes CarbonNFT address
      "Marketplace"
    );
  }
  
  // Summary
  console.log("\n📊 Verification Summary");
  console.log("======================");
  
  const totalContracts = Object.keys(verificationResults).length;
  const verifiedContracts = Object.values(verificationResults).filter(Boolean).length;
  
  Object.entries(verificationResults).forEach(([contract, verified]) => {
    const status = verified ? "✅ Verified" : "❌ Failed";
    const address = contracts[contract as keyof typeof contracts];
    console.log(`${contract}: ${status} (${address})`);
  });
  
  console.log(`\nTotal: ${verifiedContracts}/${totalContracts} contracts verified`);
  
  if (verifiedContracts === totalContracts) {
    console.log("🎉 All contracts verified successfully!");
    
    // Display Etherscan links
    if (networkName === "sepolia") {
      console.log("\n🔗 Etherscan Links:");
      Object.entries(contracts).forEach(([contract, address]) => {
        if (address) {
          console.log(`${contract}: https://sepolia.etherscan.io/address/${address}#code`);
        }
      });
    }
  } else {
    console.log("⚠️  Some contracts failed verification. Check the errors above.");
    process.exit(1);
  }
}

// Handle both direct execution and module import
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Verification failed:", error);
      process.exit(1);
    });
}

export { main as verifyContracts };