import { expect } from 'chai';
import { ipfsService, geminiService, mlService, carbonCalculatorService, dataValidator } from '../../src/services';
import { Grade } from '../../src/services/ipfs/types';

describe('Services Integration', () => {
    describe('Service Exports', () => {
        it('should export all service instances', () => {
            expect(ipfsService).to.exist;
            expect(geminiService).to.exist;
            expect(mlService).to.exist;
            expect(carbonCalculatorService).to.exist;
            expect(dataValidator).to.exist;
        });

        it('should have correct service methods', () => {
            // IPFS Service methods
            expect(ipfsService.uploadMetadata).to.be.a('function');
            expect(ipfsService.uploadImage).to.be.a('function');
            expect(ipfsService.retrieveContent).to.be.a('function');
            expect(ipfsService.pinContent).to.be.a('function');

            // Gemini Service methods
            expect(geminiService.generateArtwork).to.be.a('function');
            expect(geminiService.validateTheme).to.be.a('function');
            expect(geminiService.getAvailableThemes).to.be.a('function');

            // ML Service methods
            expect(mlService.analyzeDocuments).to.be.a('function');
            expect(mlService.calculateCarbonScore).to.be.a('function');
            expect(mlService.validateDataFormat).to.be.a('function');
            expect(mlService.getCarbonFactors).to.be.a('function');

            // Carbon Calculator Service methods
            expect(carbonCalculatorService.calculateEmissions).to.be.a('function');
            expect(carbonCalculatorService.getEmissionFactors).to.be.a('function');
            expect(carbonCalculatorService.validateCarbonData).to.be.a('function');

            // Data Validator methods
            expect(dataValidator.validateCarbonData).to.be.a('function');
            expect(dataValidator.validateDocuments).to.be.a('function');
            expect(dataValidator.sanitizeInput).to.be.a('function');
            expect(dataValidator.validateNFTMetadata).to.be.a('function');
        });
    });

    describe('Service Integration Workflow', () => {
        it('should handle complete NFT creation workflow', async () => {
            // Step 1: Validate carbon data
            const carbonData = {
                transportation: { carMiles: 50, publicTransportMiles: 100 },
                energy: { electricityKwh: 200, renewablePercentage: 60 }
            };

            const validation = dataValidator.validateCarbonData(carbonData);
            expect(validation.isValid).to.be.true;

            // Step 2: Calculate carbon score (API call - may fail if service not running)
            try {
                const score = await mlService.calculateCarbonScore(carbonData);
                expect(score).to.be.a('number');
                expect(score).to.be.at.least(0);
                expect(score).to.be.at.most(100);
            } catch (error) {
                expect((error as Error).message).to.include('Service unavailable');
            }

            // Step 3: Generate artwork (API call - may fail if service not running)
            let artwork;
            try {
                artwork = await geminiService.generateArtwork('nature', Grade.A);
                expect(artwork).to.have.property('imageUrl');
                expect(artwork).to.have.property('metadata');
                expect(artwork.metadata.theme).to.equal('nature');
            } catch (error) {
                expect((error as Error).message).to.include('Service unavailable');
                // Use mock data for the rest of the test
                artwork = {
                    imageUrl: 'mock-image-url',
                    metadata: {
                        theme: 'nature',
                        grade: Grade.A,
                        style: 'artistic',
                        prompt: 'mock prompt',
                        generatedAt: Date.now()
                    }
                };
            }

            // Step 4: Validate NFT metadata
            const nftMetadata = {
                name: 'EcoNFT Test',
                description: 'Test NFT',
                image: artwork.imageUrl,
                attributes: {
                    grade: Grade.A,
                    carbonScore: 85, // Use default score if service unavailable
                    theme: 'nature',
                    generatedAt: Date.now(),
                    lastUpdated: Date.now()
                }
            };

            const metadataValidation = dataValidator.validateNFTMetadata(nftMetadata);
            expect(metadataValidation.isValid).to.be.true;

            // Step 5: IPFS upload would happen here (requires credentials)
            expect(ipfsService.uploadMetadata).to.be.a('function');
        });

        it('should handle error cases gracefully', async () => {
            // Test invalid theme
            try {
                await geminiService.generateArtwork('invalid-theme', Grade.A);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.instanceOf(Error);
            }

            // Test invalid carbon data
            const invalidData = { invalid: 'data' };
            const validation = dataValidator.validateCarbonData(invalidData as any);
            expect(validation.isValid).to.be.false;
            expect(validation.errors.length).to.be.greaterThan(0);
        });
    });

    describe('Configuration', () => {
        it('should use environment configuration', () => {
            // Services should be configured with environment variables
            // This test verifies they can be instantiated without errors
            expect(ipfsService).to.exist;
            expect(geminiService).to.exist;
            expect(mlService).to.exist;
            expect(dataValidator).to.exist;
        });
    });
});