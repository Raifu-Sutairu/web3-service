# Blockchain Services Layer

This directory contains the blockchain services layer for the Web3 EcoNFT platform. The services provide a high-level interface for interacting with smart contracts, managing transactions, and monitoring blockchain events.

## Architecture

The blockchain services layer consists of three main components:

1. **ContractService** - Direct contract interactions with gas optimization
2. **TransactionService** - Transaction management and batching
3. **EventService** - Contract event listening and processing

## Services Overview

### ContractService

Provides methods for interacting with deployed smart contracts:

- **CarbonNFT Contract**: User registration, NFT minting, grade updates, endorsements
- **Community Contract**: NFT visibility, public galleries, leaderboards, community stats
- **Marketplace Contract**: NFT listing, buying, selling, price suggestions
- **Governance Contract**: Proposal creation, voting, execution

#### Key Features:
- Gas optimization for all transactions
- Error handling and retry mechanisms
- Type-safe contract interactions
- Automatic transaction configuration

#### Example Usage:
```typescript
import { blockchainServices, Grade, UserType } from './services/blockchain';

// Register a user
const result = await blockchainServices.contractService.registerUser(UserType.Individual);

// Mint an NFT
const mintResult = await blockchainServices.contractService.mintNFT(
    '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A',
    'ipfs://QmExampleHash',
    'renewable-energy',
    Grade.B,
    85
);
```

### TransactionService

Handles transaction management, gas optimization, and batching:

#### Key Features:
- Automatic gas price optimization
- Transaction batching for efficiency
- Retry mechanisms for failed transactions
- Network congestion detection
- Nonce management

#### Example Usage:
```typescript
// Get optimal gas price
const gasPrice = await blockchainServices.transactionService.getOptimalGasPrice();

// Batch multiple transactions
const batchTxs = [
    { id: 'tx1', to: '0x...', data: '0x1234' },
    { id: 'tx2', to: '0x...', data: '0x5678' }
];
const batchResult = await blockchainServices.transactionService.batchTransactions(batchTxs);

// Retry a failed transaction
const retryResult = await blockchainServices.transactionService.retryTransaction(txRequest, 3);
```

### EventService

Provides event subscription and historical event querying:

#### Key Features:
- Real-time event monitoring
- Historical event queries
- Event filtering and processing
- Subscription management
- Automatic event parsing

#### Example Usage:
```typescript
// Subscribe to NFT minting events
const subscriptionId = blockchainServices.eventService.subscribeToEvents(
    ContractName.CARBON_NFT,
    'NFTMinted',
    (event) => {
        console.log('New NFT minted:', event.args);
    }
);

// Get historical events
const events = await blockchainServices.eventService.getHistoricalEvents(
    ContractName.CARBON_NFT,
    'NFTMinted',
    12000000,
    'latest'
);
```

## Service Manager

The `BlockchainServiceManager` provides a unified interface to all services:

```typescript
import { blockchainServices } from './services/blockchain';

// Initialize all services
await blockchainServices.initialize();

// Health check
const health = await blockchainServices.healthCheck();

// Access individual services
const contractService = blockchainServices.contractService;
const transactionService = blockchainServices.transactionService;
const eventService = blockchainServices.eventService;

// Cleanup when done
await blockchainServices.cleanup();
```

## Configuration

Services are configured through environment variables in `.env`:

```env
# Blockchain Configuration
PRIVATE_KEY=your_private_key
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your_key
ETHERSCAN_API_KEY=your_etherscan_key

# Contract Addresses (set after deployment)
CARBON_NFT_ADDRESS=0x...
COMMUNITY_ADDRESS=0x...
MARKETPLACE_ADDRESS=0x...
GOVERNANCE_ADDRESS=0x...
```

## Error Handling

All services implement comprehensive error handling:

- **Network Errors**: Automatic retry with exponential backoff
- **Gas Errors**: Dynamic gas price adjustment
- **Contract Errors**: Detailed error messages and context
- **Validation Errors**: Input validation and sanitization

## Testing

The services include comprehensive unit tests and integration tests:

```bash
# Run all blockchain service tests
npm test -- --grep "Blockchain Services"

# Run specific service tests
npm test -- test/services/blockchain/ContractService.test.ts
npm test -- test/services/blockchain/TransactionService.test.ts
npm test -- test/services/blockchain/EventService.test.ts
```

## Gas Optimization

The services implement several gas optimization strategies:

1. **Dynamic Gas Pricing**: Automatically adjusts gas prices based on network conditions
2. **Gas Estimation**: Accurate gas estimation with safety buffers
3. **Batch Transactions**: Combines multiple operations to reduce gas costs
4. **EIP-1559 Support**: Uses modern gas pricing when available
5. **Network Monitoring**: Detects congestion and adjusts accordingly

## Security Considerations

- Private keys are managed securely through environment variables
- All transactions are validated before submission
- Input sanitization prevents injection attacks
- Access control is enforced at the contract level
- Event data is validated before processing

## Performance Features

- **Connection Pooling**: Efficient RPC connection management
- **Caching**: Smart caching of contract instances and metadata
- **Parallel Processing**: Concurrent transaction processing where safe
- **Event Batching**: Efficient event processing and notification

## Monitoring and Observability

The services provide comprehensive monitoring capabilities:

- Transaction status tracking
- Gas usage analytics
- Event subscription monitoring
- Service health checks
- Performance metrics

## Future Enhancements

Planned improvements include:

1. **Multi-chain Support**: Support for multiple blockchain networks
2. **Advanced Caching**: Redis-based caching for improved performance
3. **Metrics Dashboard**: Real-time monitoring dashboard
4. **Circuit Breakers**: Automatic failover mechanisms
5. **Load Balancing**: Multiple RPC endpoint support

## Contributing

When contributing to the blockchain services:

1. Follow TypeScript best practices
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Consider gas optimization in all implementations
5. Implement proper error handling and logging

## License

This code is part of the Web3 EcoNFT platform and follows the project's licensing terms.