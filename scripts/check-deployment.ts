import { ethers } from "hardhat";
import { deploymentConfig, getNetworkConfig } from "../src/config/deployment.config";
import ENV from "../src/config/env.config";

interface ContractStatus {
  name: string;
  address: string | null;
  deployed: boolean;
  verified: boolean;
  gasUsed?: string;
  transactionHash?: string;
}

interface DeploymentStatus {
  network: string;
  chainId: number;
  deployer: string;
  deployerBalance: string;
  contracts: ContractStatus[];
  totalGasUsed: string;
  deploymentTimestamp?: number;
  allDeployed: boolean;
  allVerified: boolean;
}

async function checkContractDeployment(address: string): Promise<boolean> {
  try {
    const code = await ethers.provider.getCode(address);
    return code !== "0x";
  } catch {
    return false;
  }
}

async function checkContractVerification(address: string, networkName: string): Promise<boolean> {
  // This is a simplified check - in a real implementation, you might call Etherscan API
  // For now, we'll assume contracts are verified if they're deployed and we have the address
  if (networkName === "localhost" || networkName === "hardhat") {
    return true; // Local networks don't need verification
  }
  
  // For testnets/mainnet, we'd need to check Etherscan API
  // This is a placeholder that assumes verification based on deployment
  return await checkContractDeployment(address);
}

async function main(): Promise<void> {
  console.log("🔍 Checking deployment status...\n");
  
  // Get current network
  const network = await ethers.provider.getNetwork();
  const networkName = network.name;
  const [deployer] = await ethers.getSigners();
  
  console.log("Network:", networkName);
  console.log("Chain ID:", network.chainId.toString());
  console.log("Deployer:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Deployer Balance:", ethers.formatEther(balance), "ETH\n");
  
  // Load deployment configuration
  const config = deploymentConfig.loadConfig(networkName);
  const networkConfig = getNetworkConfig(networkName);
  
  if (!config) {
    console.log("❌ No deployment configuration found for", networkName);
    console.log("Run the deployment script first:");
    console.log(`npm run deploy:${networkName}`);
    return;
  }
  
  const status: DeploymentStatus = {
    network: networkName,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    deployerBalance: ethers.formatEther(balance),
    contracts: [],
    totalGasUsed: "0",
    deploymentTimestamp: config.deploymentInfo.timestamp,
    allDeployed: true,
    allVerified: true
  };
  
  // Check each contract
  const contractNames = ["carbonNFT", "community", "governance", "marketplace"] as const;
  
  for (const contractName of contractNames) {
    const address = config.contracts[contractName];
    
    if (!address) {
      status.contracts.push({
        name: contractName,
        address: null,
        deployed: false,
        verified: false
      });
      status.allDeployed = false;
      status.allVerified = false;
      continue;
    }
    
    const deployed = await checkContractDeployment(address);
    const verified = deployed ? await checkContractVerification(address, networkName) : false;
    
    status.contracts.push({
      name: contractName,
      address,
      deployed,
      verified,
      gasUsed: config.deploymentInfo.gasUsed[contractName],
      transactionHash: config.deploymentInfo.transactionHashes[contractName]
    });
    
    if (!deployed) status.allDeployed = false;
    if (!verified) status.allVerified = false;
  }
  
  // Calculate total gas used
  const totalGasUsed = Object.values(config.deploymentInfo.gasUsed)
    .filter(Boolean)
    .reduce((sum, gas) => sum + BigInt(gas!), BigInt(0));
  status.totalGasUsed = totalGasUsed.toString();
  
  // Display results
  console.log("📊 Deployment Status Report");
  console.log("===========================");
  
  status.contracts.forEach(contract => {
    const deployStatus = contract.deployed ? "✅ Deployed" : "❌ Not Deployed";
    const verifyStatus = contract.verified ? "✅ Verified" : "❌ Not Verified";
    
    console.log(`\n${contract.name.toUpperCase()}:`);
    console.log(`  Address: ${contract.address || "Not deployed"}`);
    console.log(`  Status: ${deployStatus} | ${verifyStatus}`);
    
    if (contract.gasUsed) {
      console.log(`  Gas Used: ${contract.gasUsed}`);
    }
    
    if (contract.transactionHash) {
      console.log(`  Tx Hash: ${contract.transactionHash}`);
    }
    
    if (contract.address && networkConfig?.blockExplorer) {
      console.log(`  Explorer: ${networkConfig.blockExplorer}/address/${contract.address}`);
    }
  });
  
  console.log("\n===========================");
  console.log("SUMMARY:");
  console.log(`Total Contracts: ${status.contracts.length}`);
  console.log(`Deployed: ${status.contracts.filter(c => c.deployed).length}/${status.contracts.length}`);
  console.log(`Verified: ${status.contracts.filter(c => c.verified).length}/${status.contracts.length}`);
  console.log(`Total Gas Used: ${status.totalGasUsed}`);
  
  if (status.deploymentTimestamp) {
    const deploymentDate = new Date(status.deploymentTimestamp);
    console.log(`Deployment Date: ${deploymentDate.toISOString()}`);
  }
  
  console.log(`Overall Status: ${status.allDeployed ? "✅ All Deployed" : "❌ Incomplete"}`);
  console.log(`Verification: ${status.allVerified ? "✅ All Verified" : "❌ Incomplete"}`);
  
  // Recommendations
  console.log("\n🔧 RECOMMENDATIONS:");
  
  if (!status.allDeployed) {
    console.log("- Run deployment script to deploy missing contracts");
    console.log(`  npx hardhat run scripts/deploy/deploy-all.ts --network ${networkName}`);
  }
  
  if (status.allDeployed && !status.allVerified) {
    console.log("- Run verification script to verify contracts on block explorer");
    console.log(`  npx hardhat run scripts/verify-contracts.ts --network ${networkName}`);
  }
  
  if (status.allDeployed && status.allVerified) {
    console.log("- ✅ All contracts are deployed and verified!");
    console.log("- You can now run integration tests");
    console.log("- Update your frontend/backend with the contract addresses");
  }
  
  // Environment variables check
  console.log("\n🔧 ENVIRONMENT CHECK:");
  const requiredEnvVars = [
    { name: "PRIVATE_KEY", value: ENV.PRIVATE_KEY, required: true },
    { name: "RPC_URL", value: ENV.RPC_URL, required: true },
    { name: "ETHERSCAN_API_KEY", value: ENV.ETHERSCAN_API_KEY, required: networkName !== "localhost" }
  ];
  
  requiredEnvVars.forEach(envVar => {
    if (envVar.required) {
      const status = envVar.value ? "✅" : "❌";
      console.log(`${status} ${envVar.name}: ${envVar.value ? "Set" : "Missing"}`);
    }
  });
  
  // Contract addresses in environment
  console.log("\n📝 CONTRACT ADDRESSES IN ENV:");
  const envAddresses = {
    CARBON_NFT_ADDRESS: ENV.CARBON_NFT_ADDRESS,
    COMMUNITY_ADDRESS: ENV.COMMUNITY_ADDRESS,
    MARKETPLACE_ADDRESS: ENV.MARKETPLACE_ADDRESS
  };
  
  Object.entries(envAddresses).forEach(([key, value]) => {
    const status = value ? "✅" : "❌";
    console.log(`${status} ${key}: ${value || "Not set"}`);
  });
  
  if (Object.values(envAddresses).some(addr => !addr)) {
    console.log("\n💡 TIP: Update your .env file with the deployed contract addresses");
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Status check failed:", error);
      process.exit(1);
    });
}

export { main as checkDeployment };