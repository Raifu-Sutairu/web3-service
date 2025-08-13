import { readFileSync } from "fs";
import { join } from "path";
import ENV from "./env.config";

export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  blockExplorer: string;
  gasPrice?: string;
  gasLimit?: number;
  confirmations: number;
}

export interface ContractAddresses {
  carbonNFT: string;
  community: string;
  governance: string;
  marketplace: string;
}

export interface DeploymentConfig {
  network: NetworkConfig;
  contracts: ContractAddresses;
  deploymentInfo: {
    deployer: string;
    timestamp: number;
    gasUsed: Record<string, string>;
    transactionHashes: Record<string, string>;
  };
}

export const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  localhost: {
    name: "localhost",
    chainId: 31337,
    rpcUrl: "http://127.0.0.1:8545",
    blockExplorer: "",
    gasLimit: 6000000,
    confirmations: 1
  },
  sepolia: {
    name: "sepolia",
    chainId: 11155111,
    rpcUrl: ENV.RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY",
    blockExplorer: "https://sepolia.etherscan.io",
    gasPrice: "20000000000", // 20 gwei
    gasLimit: 6000000,
    confirmations: 2
  },
  mainnet: {
    name: "mainnet",
    chainId: 1,
    rpcUrl: ENV.RPC_URL || "https://mainnet.infura.io/v3/YOUR-PROJECT-ID",
    blockExplorer: "https://etherscan.io",
    gasPrice: "auto",
    gasLimit: 6000000,
    confirmations: 5
  },
  mumbai: {
    name: "mumbai",
    chainId: 80001,
    rpcUrl: "https://rpc-mumbai.maticvigil.com",
    blockExplorer: "https://mumbai.polygonscan.com",
    gasPrice: "30000000000", // 30 gwei
    gasLimit: 6000000,
    confirmations: 2
  }
};

export class DeploymentConfigManager {
  private static instance: DeploymentConfigManager;
  private configs: Map<string, DeploymentConfig> = new Map();

  private constructor() {}

  public static getInstance(): DeploymentConfigManager {
    if (!DeploymentConfigManager.instance) {
      DeploymentConfigManager.instance = new DeploymentConfigManager();
    }
    return DeploymentConfigManager.instance;
  }

  /**
   * Load deployment configuration for a specific network
   */
  public loadConfig(networkName: string): DeploymentConfig | null {
    try {
      const configPath = join(__dirname, `../../deployments/${networkName}.json`);
      const configContent = readFileSync(configPath, "utf8");
      const config = JSON.parse(configContent) as DeploymentConfig;
      
      this.configs.set(networkName, config);
      return config;
    } catch (error) {
      console.warn(`Could not load deployment config for ${networkName}:`, error);
      return null;
    }
  }

  /**
   * Get contract addresses for a specific network
   */
  public getContractAddresses(networkName: string): ContractAddresses | null {
    let config = this.configs.get(networkName);
    
    if (!config) {
      config = this.loadConfig(networkName);
    }
    
    return config?.contracts || null;
  }

  /**
   * Get network configuration
   */
  public getNetworkConfig(networkName: string): NetworkConfig | null {
    return NETWORK_CONFIGS[networkName] || null;
  }

  /**
   * Get all available networks
   */
  public getAvailableNetworks(): string[] {
    return Object.keys(NETWORK_CONFIGS);
  }

  /**
   * Validate network configuration
   */
  public validateNetworkConfig(networkName: string): boolean {
    const config = this.getNetworkConfig(networkName);
    if (!config) return false;

    // Check required fields
    return !!(config.name && config.chainId && config.rpcUrl && config.blockExplorer !== undefined);
  }

  /**
   * Get contract address by name and network
   */
  public getContractAddress(networkName: string, contractName: keyof ContractAddresses): string | null {
    const addresses = this.getContractAddresses(networkName);
    return addresses?.[contractName] || null;
  }

  /**
   * Check if contracts are deployed on a network
   */
  public areContractsDeployed(networkName: string): boolean {
    const addresses = this.getContractAddresses(networkName);
    if (!addresses) return false;

    return !!(addresses.carbonNFT && addresses.community && addresses.governance && addresses.marketplace);
  }

  /**
   * Get deployment info for a network
   */
  public getDeploymentInfo(networkName: string): DeploymentConfig['deploymentInfo'] | null {
    let config = this.configs.get(networkName);
    
    if (!config) {
      config = this.loadConfig(networkName);
    }
    
    return config?.deploymentInfo || null;
  }

  /**
   * Get block explorer URL for a contract
   */
  public getBlockExplorerUrl(networkName: string, contractAddress: string): string | null {
    const networkConfig = this.getNetworkConfig(networkName);
    if (!networkConfig || !networkConfig.blockExplorer) return null;

    return `${networkConfig.blockExplorer}/address/${contractAddress}`;
  }

  /**
   * Get all contract explorer URLs for a network
   */
  public getAllExplorerUrls(networkName: string): Record<string, string> | null {
    const addresses = this.getContractAddresses(networkName);
    const networkConfig = this.getNetworkConfig(networkName);
    
    if (!addresses || !networkConfig?.blockExplorer) return null;

    const urls: Record<string, string> = {};
    
    Object.entries(addresses).forEach(([contractName, address]) => {
      if (address) {
        urls[contractName] = `${networkConfig.blockExplorer}/address/${address}`;
      }
    });

    return urls;
  }
}

// Export singleton instance
export const deploymentConfig = DeploymentConfigManager.getInstance();

// Helper functions for common operations
export function getContractAddresses(networkName: string): ContractAddresses | null {
  return deploymentConfig.getContractAddresses(networkName);
}

export function getNetworkConfig(networkName: string): NetworkConfig | null {
  return deploymentConfig.getNetworkConfig(networkName);
}

export function getContractAddress(networkName: string, contractName: keyof ContractAddresses): string | null {
  return deploymentConfig.getContractAddress(networkName, contractName);
}

export function areContractsDeployed(networkName: string): boolean {
  return deploymentConfig.areContractsDeployed(networkName);
}

// Environment-based helpers
export function getCurrentNetworkConfig(): NetworkConfig | null {
  // Determine current network from environment or hardhat config
  const currentNetwork = process.env.HARDHAT_NETWORK || ENV.NODE_ENV === 'production' ? 'mainnet' : 'sepolia';
  return getNetworkConfig(currentNetwork);
}

export function getCurrentContractAddresses(): ContractAddresses | null {
  const currentNetwork = process.env.HARDHAT_NETWORK || ENV.NODE_ENV === 'production' ? 'mainnet' : 'sepolia';
  return getContractAddresses(currentNetwork);
}