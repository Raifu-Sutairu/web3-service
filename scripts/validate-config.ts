import { ethers } from "hardhat";
import ENV from "../src/config/env.config";
import { getNetworkConfig } from "../src/config/deployment.config";

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface ConfigValidation {
  environment: ValidationResult;
  network: ValidationResult;
  wallet: ValidationResult;
  services: ValidationResult;
  overall: ValidationResult;
}

async function validateEnvironment(): Promise<ValidationResult> {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };
  
  // Check required environment variables
  const requiredVars = [
    { name: "PRIVATE_KEY", value: ENV.PRIVATE_KEY },
    { name: "RPC_URL", value: ENV.RPC_URL }
  ];
  
  requiredVars.forEach(({ name, value }) => {
    if (!value) {
      result.errors.push(`Missing required environment variable: ${name}`);
      result.valid = false;
    }
  });
  
  // Check optional but recommended variables
  const recommendedVars = [
    { name: "ETHERSCAN_API_KEY", value: ENV.ETHERSCAN_API_KEY },
    { name: "PINATA_API_KEY", value: ENV.PINATA_API_KEY },
    { name: "GEMINI_API_KEY", value: ENV.GEMINI_API_KEY }
  ];
  
  recommendedVars.forEach(({ name, value }) => {
    if (!value) {
      result.warnings.push(`Missing recommended environment variable: ${name}`);
    }
  });
  
  // Validate private key format
  if (ENV.PRIVATE_KEY) {
    if (!ENV.PRIVATE_KEY.startsWith("0x") && ENV.PRIVATE_KEY.length !== 64) {
      if (ENV.PRIVATE_KEY.length !== 66) {
        result.errors.push("PRIVATE_KEY must be 64 characters (without 0x) or 66 characters (with 0x)");
        result.valid = false;
      }
    }
  }
  
  return result;
}

async function validateNetwork(): Promise<ValidationResult> {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };
  
  try {
    // Test network connection
    const network = await ethers.provider.getNetwork();
    console.log(`Connected to network: ${network.name} (Chain ID: ${network.chainId})`);
    
    // Validate network configuration
    const networkConfig = getNetworkConfig(network.name);
    if (!networkConfig) {
      result.warnings.push(`No configuration found for network: ${network.name}`);
    }
    
    // Test RPC connection
    const blockNumber = await ethers.provider.getBlockNumber();
    if (blockNumber === 0) {
      result.warnings.push("Connected to network but block number is 0");
    }
    
    console.log(`Current block number: ${blockNumber}`);
    
  } catch (error) {
    result.errors.push(`Network connection failed: ${error}`);
    result.valid = false;
  }
  
  return result;
}

async function validateWallet(): Promise<ValidationResult> {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };
  
  try {
    const [deployer] = await ethers.getSigners();
    console.log(`Deployer address: ${deployer.address}`);
    
    // Check wallet balance
    const balance = await deployer.provider.getBalance(deployer.address);
    const balanceEth = parseFloat(ethers.formatEther(balance));
    
    console.log(`Deployer balance: ${balanceEth} ETH`);
    
    // Minimum balance recommendations by network
    const network = await ethers.provider.getNetwork();
    const minBalances: Record<string, number> = {
      mainnet: 0.2,    // 0.2 ETH for mainnet
      sepolia: 0.1,    // 0.1 ETH for Sepolia
      mumbai: 1.0,     // 1 MATIC for Mumbai
      localhost: 0.0   // No minimum for localhost
    };
    
    const minBalance = minBalances[network.name] || 0.1;
    
    if (balanceEth < minBalance) {
      if (network.name === "localhost") {
        result.warnings.push(`Low balance: ${balanceEth} ETH (minimum recommended: ${minBalance} ETH)`);
      } else {
        result.errors.push(`Insufficient balance: ${balanceEth} ETH (minimum required: ${minBalance} ETH)`);
        result.valid = false;
      }
    }
    
    // Test signing capability
    try {
      const message = "Test message for deployment validation";
      await deployer.signMessage(message);
      console.log("✅ Wallet signing test successful");
    } catch (error) {
      result.errors.push(`Wallet signing failed: ${error}`);
      result.valid = false;
    }
    
  } catch (error) {
    result.errors.push(`Wallet validation failed: ${error}`);
    result.valid = false;
  }
  
  return result;
}

async function validateServices(): Promise<ValidationResult> {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };
  
  // Test RPC endpoint
  if (ENV.RPC_URL) {
    try {
      const response = await fetch(ENV.RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1
        })
      });
      
      if (!response.ok) {
        result.warnings.push(`RPC endpoint returned status: ${response.status}`);
      } else {
        console.log("✅ RPC endpoint test successful");
      }
    } catch (error) {
      result.warnings.push(`RPC endpoint test failed: ${error}`);
    }
  }
  
  // Test Etherscan API (if provided)
  if (ENV.ETHERSCAN_API_KEY) {
    try {
      const network = await ethers.provider.getNetwork();
      let apiUrl = "https://api.etherscan.io/api";
      
      if (network.name === "sepolia") {
        apiUrl = "https://api-sepolia.etherscan.io/api";
      }
      
      const response = await fetch(
        `${apiUrl}?module=stats&action=ethsupply&apikey=${ENV.ETHERSCAN_API_KEY}`
      );
      
      if (!response.ok) {
        result.warnings.push(`Etherscan API test failed with status: ${response.status}`);
      } else {
        const data = await response.json();
        if (data.status === "1") {
          console.log("✅ Etherscan API test successful");
        } else {
          result.warnings.push(`Etherscan API returned error: ${data.message}`);
        }
      }
    } catch (error) {
      result.warnings.push(`Etherscan API test failed: ${error}`);
    }
  }
  
  return result;
}

async function main(): Promise<void> {
  console.log("🔍 Validating deployment configuration...\n");
  
  const validation: ConfigValidation = {
    environment: await validateEnvironment(),
    network: await validateNetwork(),
    wallet: await validateWallet(),
    services: await validateServices(),
    overall: { valid: true, errors: [], warnings: [] }
  };
  
  // Aggregate results
  const allResults = [
    validation.environment,
    validation.network,
    validation.wallet,
    validation.services
  ];
  
  validation.overall.errors = allResults.flatMap(r => r.errors);
  validation.overall.warnings = allResults.flatMap(r => r.warnings);
  validation.overall.valid = allResults.every(r => r.valid);
  
  // Display results
  console.log("\n📊 Validation Results");
  console.log("=====================");
  
  const sections = [
    { name: "Environment Variables", result: validation.environment },
    { name: "Network Connection", result: validation.network },
    { name: "Wallet Configuration", result: validation.wallet },
    { name: "External Services", result: validation.services }
  ];
  
  sections.forEach(({ name, result }) => {
    const status = result.valid ? "✅ PASS" : "❌ FAIL";
    console.log(`\n${name}: ${status}`);
    
    if (result.errors.length > 0) {
      console.log("  Errors:");
      result.errors.forEach(error => console.log(`    ❌ ${error}`));
    }
    
    if (result.warnings.length > 0) {
      console.log("  Warnings:");
      result.warnings.forEach(warning => console.log(`    ⚠️  ${warning}`));
    }
  });
  
  console.log("\n=====================");
  console.log(`Overall Status: ${validation.overall.valid ? "✅ READY FOR DEPLOYMENT" : "❌ NOT READY"}`);
  
  if (validation.overall.errors.length > 0) {
    console.log(`\n❌ ${validation.overall.errors.length} error(s) must be fixed before deployment`);
  }
  
  if (validation.overall.warnings.length > 0) {
    console.log(`\n⚠️  ${validation.overall.warnings.length} warning(s) - deployment possible but not recommended`);
  }
  
  if (validation.overall.valid && validation.overall.warnings.length === 0) {
    console.log("\n🎉 Configuration is valid! Ready to deploy.");
    console.log("\nNext steps:");
    console.log("1. npm run compile");
    console.log("2. npm run test:deployment (optional)");
    console.log("3. npm run deploy:sepolia (for testnet)");
    console.log("4. npm run verify:sepolia (after deployment)");
  }
  
  // Exit with appropriate code
  process.exit(validation.overall.valid ? 0 : 1);
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Validation failed:", error);
    process.exit(1);
  });
}

export { main as validateConfig };