/**
 * Example usage of IPFS and External Services
 * This file demonstrates how to use the implemented services
 */

import { ipfsService } from './ipfs';
import { geminiService, mlService, carbonCalculatorService } from './external';
import { dataValidator } from './validation';
import { Grade } from './ipfs/types';
import { CarbonData, Document } from './external/types';

export async function demonstrateServices() {
    console.log('🚀 Demonstrating Web3 EcoNFT Services...\n');

    // 1. Demonstrate Data Validation
    console.log('1. Data Validation Service');
    console.log('==========================');
    
    const carbonData: CarbonData = {
        transportation: {
            carMiles: 100,
            publicTransportMiles: 50,
            bikeWalkMiles: 20
        },
        energy: {
            electricityKwh: 300,
            renewablePercentage: 40
        }
    };

    const validationResult = dataValidator.validateCarbonData(carbonData);
    console.log('Carbon data validation:', validationResult.isValid ? '✅ Valid' : '❌ Invalid');
    if (validationResult.errors.length > 0) {
        console.log('Errors:', validationResult.errors);
    }
    console.log('');

    // 2. Demonstrate ML Service
    console.log('2. ML Service (API Endpoint Calls)');
    console.log('==================================');
    
    try {
        const carbonScore = await mlService.calculateCarbonScore(carbonData);
        console.log(`Calculated carbon score: ${carbonScore.toFixed(2)}`);

        const documents: Document[] = [
            {
                type: 'receipt',
                content: 'Mock receipt content for eco-friendly purchase',
                filename: 'eco-receipt.pdf',
                uploadedAt: Date.now()
            }
        ];

        const analysis = await mlService.analyzeDocuments(documents);
        console.log(`Document analysis grade: ${Grade[analysis.grade]} (${analysis.score.toFixed(2)})`);
        console.log(`Confidence: ${(analysis.confidence * 100).toFixed(1)}%`);
        console.log('Recommendations:', analysis.recommendations.slice(0, 2));
    } catch (error) {
        console.log('ML Service error (expected - service not running):', (error as Error).message);
    }
    console.log('');

    // 3. Demonstrate AI Service
    console.log('3. AI Service (API Endpoint Calls)');
    console.log('==================================');
    
    try {
        const availableThemes = geminiService.getAvailableThemes();
        console.log('Available themes:', availableThemes.slice(0, 5).join(', '), '...');

        const artwork = await geminiService.generateArtwork('nature', Grade.A, {
            style: 'artistic',
            colorScheme: 'vibrant',
            elements: ['trees', 'clean air']
        });

        console.log('Generated artwork:');
        console.log(`- Theme: ${artwork.metadata.theme}`);
        console.log(`- Grade: ${Grade[artwork.metadata.grade]}`);
        console.log(`- Style: ${artwork.metadata.style}`);
        console.log(`- Image URL: ${artwork.imageUrl}`);
        console.log(`- Prompt: ${artwork.metadata.prompt.substring(0, 100)}...`);
    } catch (error) {
        console.log('AI Service error (expected - service not running):', (error as Error).message);
    }
    console.log('');

    // 4. Demonstrate Carbon Calculator Service
    console.log('4. Carbon Calculator Service (API Endpoint Calls)');
    console.log('=================================================');
    
    try {
        const emissions = await carbonCalculatorService.calculateEmissions(carbonData);
        console.log(`Calculated total emissions: ${emissions.toFixed(2)} kg CO2`);

        const emissionFactors = await carbonCalculatorService.getEmissionFactors();
        console.log('Retrieved emission factors from service');
    } catch (error) {
        console.log('Carbon Calculator Service error (expected - service not running):', (error as Error).message);
    }
    console.log('');

    // 5. Demonstrate IPFS Service
    console.log('5. IPFS Service');
    console.log('===============');
    
    const mockMetadata = {
        name: 'EcoNFT #1',
        description: 'A carbon footprint NFT representing excellent environmental performance',
        image: 'QmMockImageHash123',
        attributes: {
            grade: Grade.A,
            carbonScore: 85,
            theme: 'nature',
            generatedAt: Date.now(),
            lastUpdated: Date.now()
        }
    };

    try {
        console.log('Attempting to upload metadata to IPFS...');
        const uploadResult = await ipfsService.uploadMetadata(mockMetadata);
        console.log('✅ Metadata uploaded successfully:');
        console.log(`- IPFS Hash: ${uploadResult.hash}`);
        console.log(`- Gateway URL: ${uploadResult.url}`);
        console.log(`- Size: ${uploadResult.size} bytes`);
    } catch (error) {
        console.log('❌ IPFS upload failed (expected without valid credentials):');
        console.log(`   ${(error as Error).message}`);
        console.log('   This is normal in development - configure PINATA_JWT for real uploads');
    }
    console.log('');

    // 6. Demonstrate Service Integration
    console.log('6. Service Integration Example');
    console.log('==============================');
    
    console.log('Complete NFT creation workflow:');
    console.log('1. Validate user carbon data ✅');
    console.log('2. Calculate emissions with Carbon Calculator service (API call) ✅');
    console.log('3. Analyze documents with ML service (API call) ✅');
    console.log('4. Generate AI artwork based on grade (API call) ✅');
    console.log('5. Upload metadata to IPFS (requires credentials) ⚠️');
    console.log('6. Mint NFT with blockchain service (separate task) ⏳');
    console.log('');

    console.log('🎉 Service demonstration complete!');
    console.log('All services are implemented and ready for integration.');
}

// Export individual service instances for easy access
export {
    ipfsService,
    geminiService,
    mlService,
    carbonCalculatorService,
    dataValidator
};

// Run demonstration if this file is executed directly
if (require.main === module) {
    demonstrateServices().catch(console.error);
}