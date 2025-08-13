# Web3 EcoNFT Services

This directory contains the service layer implementations for the Web3 EcoNFT platform, including IPFS storage, external service integrations, and data validation.

## Overview

The services are organized into four main categories:

- **IPFS Service**: Decentralized storage for NFT metadata and images
- **External Services**: AI artwork generation and ML carbon analysis
- **Validation Service**: Data validation and sanitization
- **Blockchain Services**: Smart contract interactions (separate implementation)

## Services

### IPFS Service (`./ipfs/`)

Handles decentralized storage using Pinata as the IPFS provider.

**Features:**
- Upload NFT metadata to IPFS
- Upload images to IPFS
- Retrieve content by hash
- Pin/unpin content management

**Usage:**
```typescript
import { ipfsService } from './ipfs';

// Upload metadata
const metadata = {
  name: 'EcoNFT #1',
  description: 'Carbon footprint NFT',
  image: 'QmImageHash',
  attributes: {
    grade: Grade.A,
    carbonScore: 85,
    theme: 'nature',
    generatedAt: Date.now(),
    lastUpdated: Date.now()
  }
};

const result = await ipfsService.uploadMetadata(metadata);
console.log('IPFS Hash:', result.hash);
console.log('Gateway URL:', result.url);
```

**Configuration:**
Set the following environment variables:
- `PINATA_API_KEY`: Your Pinata API key
- `PINATA_SECRET_API_KEY`: Your Pinata secret key
- `PINATA_JWT`: Your Pinata JWT token

### External Services (`./external/`)

#### Gemini AI Service

Generates themed artwork for NFTs based on carbon grades and user preferences.

**Features:**
- Theme validation
- AI artwork generation (mock implementation)
- Customizable styles and color schemes

**Usage:**
```typescript
import { geminiService } from './external';

const artwork = await geminiService.generateArtwork('nature', Grade.A, {
  style: 'artistic',
  colorScheme: 'vibrant',
  elements: ['trees', 'clean air']
});

console.log('Generated artwork URL:', artwork.imageUrl);
```

#### ML Service

Analyzes carbon footprint data and documents to calculate environmental grades.

**Features:**
- Document analysis (mock implementation)
- Carbon score calculation
- Grade recommendations
- Data format validation

**Usage:**
```typescript
import { mlService } from './external';

const carbonData = {
  transportation: { carMiles: 100, publicTransportMiles: 50 },
  energy: { electricityKwh: 300, renewablePercentage: 40 }
};

const score = await mlService.calculateCarbonScore(carbonData);
const analysis = await mlService.analyzeDocuments(documents);
```

**Configuration:**
Set the following environment variables:
- `GEMINI_API_KEY`: Your Gemini API key
- `ML_SERVICE_URL`: ML service endpoint URL
- `ML_SERVICE_API_KEY`: ML service API key

### Validation Service (`./validation/`)

Provides comprehensive data validation and sanitization.

**Features:**
- Carbon data validation
- Document validation
- NFT metadata validation
- Input sanitization

**Usage:**
```typescript
import { dataValidator } from './validation';

const result = dataValidator.validateCarbonData(carbonData);
if (result.isValid) {
  console.log('Data is valid');
  console.log('Sanitized data:', result.sanitizedData);
} else {
  console.log('Validation errors:', result.errors);
}
```

## Data Types

### Grade Enum
```typescript
enum Grade {
  A = 0,  // Excellent (90-100)
  B = 1,  // Good (80-89)
  C = 2,  // Average (70-79)
  D = 3,  // Below Average (60-69)
  F = 4   // Poor (0-59)
}
```

### Carbon Data Structure
```typescript
interface CarbonData {
  transportation?: {
    carMiles?: number;
    publicTransportMiles?: number;
    flightMiles?: number;
    bikeWalkMiles?: number;
  };
  energy?: {
    electricityKwh?: number;
    gasUsage?: number;
    renewablePercentage?: number;
  };
  waste?: {
    recyclingPercentage?: number;
    compostingPercentage?: number;
    totalWasteKg?: number;
  };
  consumption?: {
    meatConsumption?: number;
    localFoodPercentage?: number;
    newPurchases?: number;
    secondHandPercentage?: number;
  };
}
```

### NFT Metadata Structure
```typescript
interface NFTMetadata {
  name: string;
  description: string;
  image: string; // IPFS hash
  attributes: {
    grade: Grade;
    carbonScore: number;
    theme: string;
    generatedAt: number;
    lastUpdated: number;
  };
  external_url?: string;
}
```

## Error Handling

All services implement comprehensive error handling:

- **Network Errors**: Automatic retry mechanisms
- **Validation Errors**: Detailed error messages
- **Service Failures**: Graceful degradation
- **Rate Limiting**: Respect API limits

## Testing

Run the service tests:

```bash
npm test -- test/services/
```

Test files are located in:
- `test/services/ipfs/IPFSService.test.ts`
- `test/services/external/GeminiService.test.ts`
- `test/services/external/MLService.test.ts`
- `test/services/validation/DataValidator.test.ts`

## Development Notes

### Mock Implementations

The external services (Gemini AI and ML Service) currently use mock implementations for development and testing. To integrate with real services:

1. **Gemini Service**: Uncomment the `callGeminiAPI` method and configure with real API credentials
2. **ML Service**: Uncomment the `callMLService` method and configure with real ML service endpoint

### IPFS Configuration

The IPFS service is configured to use Pinata. For production:

1. Sign up for a Pinata account
2. Generate API keys and JWT token
3. Configure environment variables
4. Test uploads with real credentials

### Security Considerations

- All user inputs are sanitized
- API keys are stored in environment variables
- File size limits are enforced
- Input validation prevents malicious data

## Integration Example

See `./example.ts` for a complete demonstration of all services working together:

```bash
npx ts-node src/services/example.ts
```

This will run through the complete NFT creation workflow using all implemented services.