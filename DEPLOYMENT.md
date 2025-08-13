# EcoNFT Platform Deployment Guide

This guide covers the complete deployment process for the EcoNFT platform smart contracts.

## Prerequisites

1. **Node.js** (v18 or higher)
2. **npm** or **yarn**
3. **Hardhat** development environment
4. **Wallet** with sufficient funds for deployment
5. **RPC URL** for target network (Alchemy, Infura, etc.)
6. **Etherscan API Key** for contract verification

## Environment Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create or update your `.env` file:

```bash
# Basic Environment
PORT=3001
NODE_ENV=development

# Blockchain Configuration
PRIVATE_KEY=your_private_key_here
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-api-key
ETHERSCAN_API_KEY=your_etherscan_api_key

# IPFS Configuration (Pinata)
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_API_KEY=your_pinata_secret_key
PINATA_JWT=your_pinata_jwt_token

# External Services
GEMINI_API_KEY=your_gemini_api_key
ML_SERVICE_URL=http://localhost:5000
ML_SERVICE_API_KEY=your_ml_service_key

# Contract Addresses (filled automatically after deployment)
CARBON_NFT_ADDRESS=
COMMUNITY_ADDRESS=
MARKETPLACE_ADDRESS=
GOVERNANCE_ADDRESS=
```

### 3. Verify Network Configuration

Check your Hardhat configuration in `hardhat.config.ts`:

```typescript
networks: {
  sepolia: {
    url: ENV.RPC_URL,
    accounts: ENV.PRIVATE_KEY ? [ENV.PRIVATE_KEY] : [],
    chainId: 11155111,
    gasPrice: 20000000000, // 20 gwei
    gas: 6000000
  }
}
```

## Deployment Process

### Step 1: Compile Contracts

```bash
npm run compile
```

This will:
- Compile all Solidity contracts
- Generate TypeScript types
- Create artifacts for deployment

### Step 2: Run Deployment Tests (Optional but Recommended)

```bash
npm run test:deployment
```

This will:
- Test contract deployment on local network
- Verify gas usage optimization
- Ensure all contracts deploy correctly
- Test basic functionality

### Step 3: Deploy to Target Network

#### Deploy to Sepolia Testnet (Recommended for testing)

```bash
npm run deploy:sepolia
```

#### Deploy to Mainnet (Production)

```bash
npm run deploy:mainnet
```

#### Deploy to Local Network (Development)

```bash
# Start local Hardhat node in separate terminal
npm run node

# Deploy to local network
npm run deploy:local
```

### Step 4: Verify Contracts on Etherscan

After successful deployment, verify your contracts:

```bash
# For Sepolia
npm run verify:sepolia

# For Mainnet
npm run verify:mainnet
```

### Step 5: Check Deployment Status

Verify everything deployed correctly:

```bash
# Check Sepolia deployment
npm run status:sepolia

# Check Mainnet deployment
npm run status:mainnet
```

## Deployment Script Features

### Comprehensive Deployment (`deploy-all.ts`)

The main deployment script provides:

- **Sequential Deployment**: Deploys contracts in correct order
- **Gas Estimation**: Estimates gas before deployment
- **Error Handling**: Graceful error handling with partial deployment recovery
- **Configuration Management**: Saves deployment info to JSON files
- **Environment Updates**: Automatically updates `.env` with contract addresses
- **Cross-Contract Setup**: Configures contract interactions

### Contract Verification (`verify-contracts.ts`)

The verification script:

- **Automatic Verification**: Verifies all deployed contracts
- **Constructor Arguments**: Handles constructor arguments correctly
- **Batch Processing**: Verifies multiple contracts efficiently
- **Error Recovery**: Handles already-verified contracts gracefully

### Deployment Status Checker (`check-deployment.ts`)

The status checker provides:

- **Comprehensive Status**: Shows deployment and verification status
- **Gas Usage Analysis**: Reports gas consumption
- **Environment Validation**: Checks required environment variables
- **Recommendations**: Provides next steps based on current status

## Network-Specific Considerations

### Sepolia Testnet

- **Faucet**: Get test ETH from [Sepolia Faucet](https://sepoliafaucet.com/)
- **Gas Price**: 20 gwei (configured automatically)
- **Confirmations**: 2 blocks
- **Explorer**: https://sepolia.etherscan.io

### Ethereum Mainnet

- **Gas Price**: Dynamic (set to "auto")
- **Confirmations**: 5 blocks
- **Cost**: Real ETH required (~0.1-0.2 ETH for full deployment)
- **Explorer**: https://etherscan.io

### Polygon Mumbai (Alternative Testnet)

- **Faucet**: Get test MATIC from [Mumbai Faucet](https://faucet.polygon.technology/)
- **Gas Price**: 30 gwei
- **Explorer**: https://mumbai.polygonscan.com

## Gas Optimization

### Target Gas Limits

The deployment is optimized for the following gas limits:

- **CarbonNFT**: < 3,000,000 gas
- **Community**: < 2,000,000 gas
- **Governance**: < 2,500,000 gas
- **Marketplace**: < 2,500,000 gas
- **Total**: < 10,000,000 gas

### Optimization Strategies

1. **Compiler Optimization**: Enabled with 200 runs
2. **Packed Structs**: Efficient storage layout
3. **Custom Errors**: Gas-efficient error handling
4. **Batch Operations**: Minimize transaction count

## Troubleshooting

### Common Issues

#### 1. Insufficient Funds

```
Error: insufficient funds for intrinsic transaction cost
```

**Solution**: Add more ETH to your deployer wallet

#### 2. Gas Price Too Low

```
Error: replacement transaction underpriced
```

**Solution**: Increase gas price in network configuration

#### 3. RPC Rate Limiting

```
Error: too many requests
```

**Solution**: Use a premium RPC provider or add delays

#### 4. Contract Already Deployed

```
Error: contract creation code storage out of gas
```

**Solution**: Check if contracts are already deployed using status checker

### Recovery Procedures

#### Partial Deployment Recovery

If deployment fails partway through:

1. Check deployment status:
   ```bash
   npm run status:sepolia
   ```

2. The script will show which contracts deployed successfully

3. Re-run deployment - it will skip already deployed contracts

#### Environment Variable Issues

If contract addresses aren't updated in `.env`:

1. Check the deployment configuration file:
   ```bash
   cat deployments/sepolia.json
   ```

2. Manually update `.env` with the addresses

3. Or re-run the deployment script

## Post-Deployment Checklist

### ✅ Deployment Verification

- [ ] All contracts deployed successfully
- [ ] Contract addresses saved to `.env`
- [ ] Deployment configuration saved to `deployments/`
- [ ] Gas usage within expected limits

### ✅ Contract Verification

- [ ] All contracts verified on Etherscan
- [ ] Source code published
- [ ] Constructor arguments correct
- [ ] Contract names match

### ✅ Functionality Testing

- [ ] Basic contract functions work
- [ ] Cross-contract interactions functional
- [ ] Access controls properly configured
- [ ] Initial parameters set correctly

### ✅ Integration Setup

- [ ] Frontend updated with contract addresses
- [ ] Backend services configured
- [ ] API endpoints updated
- [ ] Documentation updated

## Security Considerations

### Pre-Deployment

1. **Code Audit**: Ensure contracts are audited
2. **Test Coverage**: Verify comprehensive test coverage
3. **Access Controls**: Review all access modifiers
4. **Upgrade Patterns**: Consider upgrade mechanisms

### Post-Deployment

1. **Monitor Transactions**: Watch for unusual activity
2. **Verify Interactions**: Test all contract interactions
3. **Backup Keys**: Secure private keys properly
4. **Emergency Procedures**: Have pause/emergency mechanisms ready

## Monitoring and Maintenance

### Ongoing Monitoring

1. **Transaction Monitoring**: Watch contract interactions
2. **Gas Usage**: Monitor gas consumption trends
3. **Error Rates**: Track failed transactions
4. **Performance**: Monitor response times

### Maintenance Tasks

1. **Regular Backups**: Backup deployment configurations
2. **Update Dependencies**: Keep dependencies current
3. **Security Updates**: Apply security patches
4. **Documentation**: Keep deployment docs updated

## Support and Resources

### Documentation

- [Hardhat Documentation](https://hardhat.org/docs)
- [Ethers.js Documentation](https://docs.ethers.io/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)

### Tools

- [Etherscan](https://etherscan.io) - Contract verification and monitoring
- [Tenderly](https://tenderly.co) - Transaction simulation and debugging
- [Defender](https://defender.openzeppelin.com) - Contract monitoring and automation

### Community

- [Hardhat Discord](https://discord.gg/hardhat)
- [Ethereum Stack Exchange](https://ethereum.stackexchange.com)
- [OpenZeppelin Forum](https://forum.openzeppelin.com)

---

For additional support or questions about deployment, please refer to the project documentation or contact the development team.