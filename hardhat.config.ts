import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import ENV from "./src/config/env.config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    // Local development (Hardhat node)
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    },
    // Local development (Ganache)
    ganache: {
      url: "http://127.0.0.1:7545",
      chainId: 1337
    },
    // Sepolia Testnet (recommended for testing)
    sepolia: {
      url: ENV.RPC_URL,
      accounts: ENV.PRIVATE_KEY ? [ENV.PRIVATE_KEY] : [],
      chainId: 11155111,
      gasPrice: 20000000000, // 20 gwei
      gas: 6000000
    },
    // Polygon Mumbai Testnet (alternative)
    mumbai: {
      url: "https://rpc-mumbai.maticvigil.com",
      accounts: ENV.PRIVATE_KEY ? [ENV.PRIVATE_KEY] : [],
      chainId: 80001
    },
    // Ethereum Mainnet (for production)
    mainnet: {
      url: ENV.RPC_URL || "https://mainnet.infura.io/v3/YOUR-PROJECT-ID",
      accounts: ENV.PRIVATE_KEY ? [ENV.PRIVATE_KEY] : [],
      chainId: 1,
      gasPrice: "auto"
    }
  },
  etherscan: {
    apiKey: {
      mainnet: ENV.ETHERSCAN_API_KEY,
      sepolia: ENV.ETHERSCAN_API_KEY,
      polygon: ENV.ETHERSCAN_API_KEY,
      polygonMumbai: ENV.ETHERSCAN_API_KEY
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  gasReporter: {
    enabled: ENV.NODE_ENV === "test",
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY
  }
};

export default config;