# External Services

This directory contains cleaned up external service integrations that make simple API calls to localhost endpoints.

## Services

### GeminiService (AI Artwork Generation)
- **Endpoint**: `http://localhost:3002/api/ai`
- **Purpose**: Generate AI artwork based on themes and grades
- **Methods**:
  - `generateArtwork(theme, grade, preferences)` - POST `/generate-artwork`
  - `validateTheme(theme)` - Client-side validation
  - `getAvailableThemes()` - Client-side list

### MLService (Machine Learning Analysis)
- **Endpoint**: `http://localhost:3003/api/ml`
- **Purpose**: Analyze documents and calculate carbon scores
- **Methods**:
  - `analyzeDocuments(documents)` - POST `/analyze-documents`
  - `calculateCarbonScore(data)` - POST `/calculate-score`
  - `getCarbonFactors()` - GET `/carbon-factors`
  - `validateDataFormat(data)` - Client-side validation

### CarbonCalculatorService (Carbon Emissions Calculator)
- **Endpoint**: `http://localhost:3004/api/carbon`
- **Purpose**: Calculate carbon emissions from user data
- **Methods**:
  - `calculateEmissions(data)` - POST `/calculate-emissions`
  - `getEmissionFactors()` - GET `/emission-factors`
  - `validateCarbonData(data)` - Client-side validation

## Usage

```typescript
import { geminiService, mlService, carbonCalculatorService } from './external';

// Generate AI artwork
const artwork = await geminiService.generateArtwork('nature', Grade.A, {
    style: 'artistic',
    colorScheme: 'vibrant'
});

// Analyze documents for carbon footprint
const analysis = await mlService.analyzeDocuments(documents);

// Calculate carbon emissions
const emissions = await carbonCalculatorService.calculateEmissions(carbonData);
```

## Error Handling

All services include proper error handling and will throw descriptive errors when:
- External services are unavailable
- Invalid data is provided
- Network timeouts occur

## Testing

Tests are included for all services but expect the external services to be unavailable in CI/CD environments. The tests will pass with appropriate error handling when services are not running.

## Configuration

No configuration is required - services use hardcoded localhost URLs as placeholders. In production, these would be replaced with actual service endpoints.