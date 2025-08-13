import { expect } from 'chai';
import { DataValidator } from '../../../src/services/validation/DataValidator';
import { CarbonData, Document } from '../../../src/services/external/types';
import { Grade } from '../../../src/services/ipfs/types';

describe('DataValidator', () => {
    let validator: DataValidator;

    beforeEach(() => {
        validator = new DataValidator();
    });

    describe('validateCarbonData', () => {
        it('should validate correct carbon data', () => {
            const validData: CarbonData = {
                transportation: {
                    carMiles: 100,
                    publicTransportMiles: 50,
                    flightMiles: 1000,
                    bikeWalkMiles: 20
                },
                energy: {
                    electricityKwh: 500,
                    gasUsage: 100,
                    renewablePercentage: 30
                },
                waste: {
                    recyclingPercentage: 70,
                    compostingPercentage: 20,
                    totalWasteKg: 50
                },
                consumption: {
                    meatConsumption: 5,
                    localFoodPercentage: 40,
                    secondHandPercentage: 30
                }
            };

            const result = validator.validateCarbonData(validData);

            expect(result.isValid).to.be.true;
            expect(result.errors).to.have.length(0);
            expect(result.sanitizedData).to.exist;
        });

        it('should reject invalid data types', () => {
            const result1 = validator.validateCarbonData(null as any);
            const result2 = validator.validateCarbonData('invalid' as any);

            expect(result1.isValid).to.be.false;
            expect(result1.errors).to.include('Carbon data must be a valid object');

            expect(result2.isValid).to.be.false;
            expect(result2.errors).to.include('Carbon data must be a valid object');
        });

        it('should validate transportation data ranges', () => {
            const invalidData: CarbonData = {
                transportation: {
                    carMiles: -10, // Invalid: negative
                    flightMiles: 600000 // Invalid: too high
                }
            };

            const result = validator.validateCarbonData(invalidData);

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Car miles must be between 0 and 100,000');
            expect(result.errors).to.include('Flight miles must be between 0 and 500,000');
        });

        it('should validate energy data ranges', () => {
            const invalidData: CarbonData = {
                energy: {
                    electricityKwh: -100, // Invalid: negative
                    renewablePercentage: 150 // Invalid: over 100%
                }
            };

            const result = validator.validateCarbonData(invalidData);

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Electricity usage must be between 0 and 50,000 kWh');
            expect(result.errors).to.include('Renewable percentage must be between 0 and 100');
        });

        it('should validate percentage ranges', () => {
            const invalidData: CarbonData = {
                waste: {
                    recyclingPercentage: -10,
                    compostingPercentage: 150
                },
                consumption: {
                    localFoodPercentage: -5,
                    secondHandPercentage: 120
                }
            };

            const result = validator.validateCarbonData(invalidData);

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Recycling percentage must be between 0 and 100');
            expect(result.errors).to.include('Composting percentage must be between 0 and 100');
            expect(result.errors).to.include('Local food percentage must be between 0 and 100');
            expect(result.errors).to.include('Second-hand percentage must be between 0 and 100');
        });

        it('should warn about missing data', () => {
            const emptyData: CarbonData = {};

            const result = validator.validateCarbonData(emptyData);

            expect(result.isValid).to.be.true; // No errors, but warnings
            expect(result.warnings).to.include('No carbon data categories provided');
        });
    });

    describe('validateDocuments', () => {
        it('should validate correct documents', () => {
            const validDocuments: Document[] = [
                {
                    type: 'receipt',
                    content: 'Receipt content',
                    filename: 'receipt.pdf',
                    uploadedAt: Date.now()
                },
                {
                    type: 'bill',
                    content: Buffer.from('Bill content'),
                    filename: 'energy-bill.pdf',
                    uploadedAt: Date.now()
                }
            ];

            const result = validator.validateDocuments(validDocuments);

            expect(result.isValid).to.be.true;
            expect(result.errors).to.have.length(0);
            expect(result.sanitizedData).to.exist;
        });

        it('should reject invalid document arrays', () => {
            const result1 = validator.validateDocuments(null as any);
            const result2 = validator.validateDocuments([] as any);

            expect(result1.isValid).to.be.false;
            expect(result1.errors).to.include('Documents must be provided as an array');

            expect(result2.isValid).to.be.false;
            expect(result2.errors).to.include('At least one document must be provided');
        });

        it('should validate document types', () => {
            const invalidDocuments: Document[] = [
                {
                    type: 'invalid' as any,
                    content: 'Content',
                    filename: 'test.pdf',
                    uploadedAt: Date.now()
                }
            ];

            const result = validator.validateDocuments(invalidDocuments);

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Document 1: Invalid type. Must be receipt, bill, report, or photo');
        });

        it('should validate required fields', () => {
            const invalidDocuments: Document[] = [
                {
                    type: 'receipt',
                    content: '',
                    filename: '',
                    uploadedAt: Date.now()
                }
            ];

            const result = validator.validateDocuments(invalidDocuments);

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Document 1: Filename is required');
            expect(result.errors).to.include('Document 1: Content is required');
        });

        it('should limit document count', () => {
            const tooManyDocuments: Document[] = Array(15).fill(null).map((_, i) => ({
                type: 'receipt' as const,
                content: `Content ${i}`,
                filename: `file${i}.pdf`,
                uploadedAt: Date.now()
            }));

            const result = validator.validateDocuments(tooManyDocuments);

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Maximum 10 documents allowed');
        });
    });

    describe('validateNFTMetadata', () => {
        it('should validate correct NFT metadata', () => {
            const validMetadata = {
                name: 'Test NFT',
                description: 'Test Description',
                image: 'QmTestHash',
                attributes: {
                    grade: Grade.A,
                    carbonScore: 85,
                    theme: 'nature',
                    generatedAt: Date.now(),
                    lastUpdated: Date.now()
                }
            };

            const result = validator.validateNFTMetadata(validMetadata);

            expect(result.isValid).to.be.true;
            expect(result.errors).to.have.length(0);
        });

        it('should reject invalid metadata structure', () => {
            const result1 = validator.validateNFTMetadata(null);
            const result2 = validator.validateNFTMetadata('invalid');

            expect(result1.isValid).to.be.false;
            expect(result1.errors).to.include('Metadata must be a valid object');

            expect(result2.isValid).to.be.false;
            expect(result2.errors).to.include('Metadata must be a valid object');
        });

        it('should validate required fields', () => {
            const invalidMetadata = {
                // Missing required fields
                attributes: {}
            };

            const result = validator.validateNFTMetadata(invalidMetadata);

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Name is required and must be a string');
            expect(result.errors).to.include('Description is required and must be a string');
            expect(result.errors).to.include('Image URL/hash is required and must be a string');
        });

        it('should validate attributes', () => {
            const invalidMetadata = {
                name: 'Test',
                description: 'Test',
                image: 'test',
                attributes: {
                    grade: 10, // Invalid grade
                    carbonScore: -5, // Invalid score
                    theme: '', // Empty theme
                }
            };

            const result = validator.validateNFTMetadata(invalidMetadata);

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Grade must be a number between 0-4 (A-F)');
            expect(result.errors).to.include('Carbon score must be a non-negative number');
            expect(result.errors).to.include('Theme is required and must be a string');
        });
    });

    describe('sanitizeInput', () => {
        it('should sanitize string inputs', () => {
            const input = '  <script>alert("xss")</script>  ';
            const result = validator.sanitizeInput(input);

            expect(result).to.equal('scriptalert("xss")/script');
        });

        it('should handle numbers', () => {
            expect(validator.sanitizeInput(42)).to.equal(42);
            expect(validator.sanitizeInput(NaN)).to.equal(0);
        });

        it('should handle arrays', () => {
            const input = ['  test  ', '<script>', 42];
            const result = validator.sanitizeInput(input);

            expect(result).to.deep.equal(['test', 'script', 42]);
        });

        it('should handle objects', () => {
            const input = {
                name: '  test  ',
                value: '<script>',
                number: 42
            };
            const result = validator.sanitizeInput(input);

            expect(result).to.deep.equal({
                name: 'test',
                value: 'script',
                number: 42
            });
        });

        it('should handle null and undefined', () => {
            expect(validator.sanitizeInput(null)).to.equal(null);
            expect(validator.sanitizeInput(undefined)).to.equal(undefined);
        });
    });
});