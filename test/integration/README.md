# Integration Tests Documentation

This directory contains comprehensive integration tests for the Web3 EcoNFT platform, covering end-to-end user workflows, cross-contract interactions, performance optimization, and service integration.

## Test Structure

### 1. End-to-End Tests (`end-to-end.test.ts`)

**Purpose**: Test complete user journeys from registration to trading

**Key Test Scenarios**:
- **Complete User Journey**: Registration → Minting → Community → Trading
- **Governance Workflow**: Proposal → Voting → Execution  
- **Multi-User Concurrent Operations**: Multiple users performing actions simultaneously
- **Complex Multi-Contract Scenarios**: Interactions affecting multiple contracts

**Coverage**:
- User registration and NFT minting
- Community gallery and leaderboard functionality
- Marketplace listing and trading
- Governance proposal creation and voting
- Cross-contract state consistency
- Error handling for edge cases

### 2. Cross-Contract Interaction Tests (`cross-contract.test.ts`)

**Purpose**: Verify proper communication between all smart contracts

**Key Test Areas**:
- **Community ↔ CarbonNFT**: Reading NFT data, leaderboard generation, endorsements
- **Marketplace ↔ CarbonNFT**: Escrow handling, ownership transfers, pricing
- **Governance ↔ CarbonNFT**: Voting power calculation, proposal restrictions
- **Multi-Contract State Consistency**: Ensuring data integrity across contracts
- **Event Synchronization**: Cross-contract event handling

**Verification Points**:
- Data accuracy across contract boundaries
- Proper access control enforcement
- State synchronization during complex operations
- Event emission and handling

### 3. Performance Tests (`performance.test.ts`)

**Purpose**: Ensure optimal gas usage and system performance

**Performance Metrics**:
- **Gas Usage Optimization**: All operations within defined limits
- **Batch Operations**: Efficient handling of multiple concurrent operations
- **Large Dataset Performance**: Gallery, leaderboard, and marketplace with many items
- **Memory and Storage Optimization**: Efficient data storage patterns
- **Concurrent Operations**: Multiple users performing actions simultaneously

**Gas Limits (Target Thresholds)**:
- NFT Mint: < 200,000 gas
- NFT Transfer: < 100,000 gas
- Marketplace List: < 150,000 gas
- Marketplace Buy: < 200,000 gas
- Community Visibility: < 80,000 gas
- Governance Vote: < 120,000 gas
- Governance Proposal: < 180,000 gas

### 4. Service Workflow Tests (`service-workflow.test.ts`)

**Purpose**: Test integration between blockchain contracts and external services

**Service Integration Coverage**:
- **Complete NFT Creation Workflow**: Data validation → ML analysis → AI artwork → IPFS upload → Blockchain minting
- **Error Handling**: Graceful handling of service failures and invalid data
- **Multi-User Workflows**: Concurrent service usage by multiple users
- **Performance and Reliability**: Service timeout handling and fallback mechanisms
- **Data Consistency**: Maintaining consistency across all services

**External Services Tested**:
- IPFS Service (metadata and image storage)
- Gemini Service (AI artwork generation)
- ML Service (carbon footprint analysis and grading)
- Data Validator (input validation and sanitization)
- Blockchain Services (contract interaction and event handling)

## Running the Tests

### Individual Test Suites

```bash
# Run all integration tests
npm run test:integration

# Run specific test suites
npm run test:integration:e2e          # End-to-end workflows
npm run test:integration:cross        # Cross-contract interactions
npm run test:integration:performance  # Performance and gas optimization
npm run test:integration:services     # Service integration workflows

# Run all tests (unit + integration)
npm run test:all
```

### Test Environment Setup

The integration tests require:
1. **Hardhat Network**: Local blockchain for testing
2. **Contract Deployment**: All contracts deployed fresh for each test
3. **Service Mocks**: Mock implementations of external services
4. **Multiple Signers**: At least 5 test accounts for multi-user scenarios

### Test Data and Scenarios

**User Types Tested**:
- Individual users (type 0)
- Company users (type 1)
- Multiple concurrent users
- Users with different NFT grades and scores

**NFT Scenarios**:
- Different grades (A, B, C, D, F)
- Various themes (nature, renewable-energy, solar-power, etc.)
- Score ranges (0-1000)
- Public and private visibility settings

**Marketplace Scenarios**:
- Grade-based pricing
- Royalty distribution
- Escrow handling
- Listing cancellation
- Concurrent trading

**Governance Scenarios**:
- Proposal creation and voting
- Different proposal types
- Voting power based on NFT ownership
- Proposal execution and failure handling

## Test Requirements Coverage

The integration tests fulfill the following requirements from the specification:

### Requirement 5.1: Unit Tests for All Functions
- ✅ Comprehensive unit test coverage through integration scenarios
- ✅ All contract functions tested in realistic contexts
- ✅ Edge cases and error conditions covered

### Requirement 5.2: Integration Test Verification
- ✅ Cross-contract interactions thoroughly tested
- ✅ Service layer integration verified
- ✅ End-to-end workflows validated

### Requirement 5.4: Gas Optimization Testing
- ✅ Gas usage benchmarks for all operations
- ✅ Performance testing with large datasets
- ✅ Batch operation efficiency verification
- ✅ Concurrent operation handling

### Requirement 5.5: Security and Error Handling
- ✅ Unauthorized access prevention
- ✅ Input validation and sanitization
- ✅ Graceful error handling and recovery
- ✅ State consistency during failures

## Performance Benchmarks

The tests establish performance benchmarks for:

**Response Times**:
- Gallery retrieval (50 NFTs): < 5 seconds
- Leaderboard generation (10 users): < 3 seconds
- Marketplace listings (30 items): < 2 seconds
- Concurrent operations (5 users): < 10 seconds

**Gas Efficiency**:
- All operations within defined gas limits
- Consistent gas usage across similar operations
- Optimized storage patterns
- Efficient batch processing

**Scalability**:
- Support for 50+ NFTs in community gallery
- Handle 10+ concurrent users
- Process 30+ marketplace listings
- Manage multiple governance proposals

## Error Scenarios Tested

**Contract-Level Errors**:
- Unauthorized access attempts
- Invalid token IDs
- Insufficient permissions
- Double voting prevention
- Invalid grade values

**Service-Level Errors**:
- Network connectivity issues
- Invalid input data
- External service failures
- Timeout handling
- Data validation failures

**Integration Errors**:
- Cross-contract communication failures
- State inconsistency scenarios
- Event handling failures
- Transaction failures and rollbacks

## Continuous Integration

These integration tests are designed to be run in CI/CD pipelines:

1. **Pre-deployment Testing**: Verify all functionality before deployment
2. **Regression Testing**: Ensure new changes don't break existing functionality
3. **Performance Monitoring**: Track gas usage and performance over time
4. **Security Validation**: Verify security measures remain effective

## Test Maintenance

**Regular Updates Required**:
- Update gas limits as contracts are optimized
- Add new test scenarios for new features
- Update service mocks as external APIs change
- Maintain test data relevance

**Performance Monitoring**:
- Track gas usage trends
- Monitor test execution times
- Identify performance regressions
- Optimize test efficiency

The integration tests provide comprehensive coverage of the Web3 EcoNFT platform, ensuring reliability, performance, and security across all components and user workflows.