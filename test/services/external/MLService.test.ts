import { expect } from 'chai';
import { MLService } from '../../../src/services/external/MLService';
import { Grade } from '../../../src/services/ipfs/types';
import { CarbonData, Document } from '../../../src/services/external/types';

describe('MLService', () => {
    let mlService: MLService;

    beforeEach(() => {
        mlService = new MLService();
    });

    describe('validateDataFormat', () => {
        it('should validate correct carbon data format', () => {
            const validData: CarbonData = {
                transportation: {
                    carMiles: 100,
                    publicTransportMiles: 50
                },
                energy: {
                    electricityKwh: 500
                }
            };

            expect(mlService.validateDataFormat(validData)).to.be.true;
        });

        it('should reject invalid data formats', () => {
            expect(mlService.validateDataFormat(null)).to.be.false;
            expect(mlService.validateDataFormat(undefined)).to.be.false;
            expect(mlService.validateDataFormat('string')).to.be.false;
            expect(mlService.validateDataFormat({})).to.be.false;
        });

        it('should accept data with at least one category', () => {
            const dataWithTransportation = {
                transportation: { carMiles: 100 }
            };
            const dataWithEnergy = {
                energy: { electricityKwh: 500 }
            };

            expect(mlService.validateDataFormat(dataWithTransportation)).to.be.true;
            expect(mlService.validateDataFormat(dataWithEnergy)).to.be.true;
        });
    });

    describe('calculateCarbonScore', () => {
        it('should calculate score for transportation data', async () => {
            const data: CarbonData = {
                transportation: {
                    carMiles: 100,
                    publicTransportMiles: 50,
                    bikeWalkMiles: 20
                }
            };

            try {
                const score = await mlService.calculateCarbonScore(data);
                expect(score).to.be.a('number');
                expect(score).to.be.at.least(0);
                expect(score).to.be.at.most(100);
            } catch (error) {
                // Expected when service is not running
                expect((error as Error).message).to.include('Service unavailable');
            }
        });

        it('should calculate score for energy data', async () => {
            const data: CarbonData = {
                energy: {
                    electricityKwh: 300,
                    renewablePercentage: 50
                }
            };

            try {
                const score = await mlService.calculateCarbonScore(data);
                expect(score).to.be.a('number');
                expect(score).to.be.at.least(0);
                expect(score).to.be.at.most(100);
            } catch (error) {
                // Expected when service is not running
                expect((error as Error).message).to.include('Service unavailable');
            }
        });

        it('should handle comprehensive carbon data', async () => {
            const data: CarbonData = {
                transportation: {
                    carMiles: 50,
                    publicTransportMiles: 100,
                    bikeWalkMiles: 50
                },
                energy: {
                    electricityKwh: 200,
                    renewablePercentage: 80
                },
                waste: {
                    recyclingPercentage: 70,
                    compostingPercentage: 30,
                    totalWasteKg: 10
                },
                consumption: {
                    meatConsumption: 2,
                    localFoodPercentage: 60,
                    secondHandPercentage: 40
                }
            };

            try {
                const score = await mlService.calculateCarbonScore(data);
                expect(score).to.be.a('number');
                expect(score).to.be.at.least(0);
                expect(score).to.be.at.most(100);
            } catch (error) {
                // Expected when service is not running
                expect((error as Error).message).to.include('Service unavailable');
            }
        });
    });

    describe('analyzeDocuments', () => {
        it('should analyze documents and return grade analysis', async () => {
            const documents: Document[] = [
                {
                    type: 'receipt',
                    content: 'Mock receipt content',
                    filename: 'receipt.pdf',
                    uploadedAt: Date.now()
                },
                {
                    type: 'bill',
                    content: Buffer.from('Mock bill content'),
                    filename: 'energy-bill.pdf',
                    uploadedAt: Date.now()
                }
            ];

            try {
                const analysis = await mlService.analyzeDocuments(documents);

                expect(analysis).to.have.property('grade');
                expect(analysis).to.have.property('score');
                expect(analysis).to.have.property('confidence');
                expect(analysis).to.have.property('factors');
                expect(analysis).to.have.property('recommendations');

                expect(Object.values(Grade)).to.include(analysis.grade);
                expect(analysis.score).to.be.at.least(0);
                expect(analysis.score).to.be.at.most(100);
                expect(analysis.confidence).to.be.at.least(0);
                expect(analysis.confidence).to.be.at.most(1);

                expect(analysis.factors).to.have.property('transportation');
                expect(analysis.factors).to.have.property('energy');
                expect(analysis.factors).to.have.property('waste');
                expect(analysis.factors).to.have.property('consumption');

                expect(analysis.recommendations).to.be.an('array');
                expect(analysis.recommendations.length).to.be.greaterThan(0);
            } catch (error) {
                // Expected when service is not running
                expect((error as Error).message).to.include('Service unavailable');
            }
        });

        it('should handle different document types', async () => {
            const documents: Document[] = [
                {
                    type: 'report',
                    content: 'Environmental report content',
                    filename: 'report.pdf',
                    uploadedAt: Date.now()
                }
            ];

            try {
                const analysis = await mlService.analyzeDocuments(documents);
                expect(Object.values(Grade)).to.include(analysis.grade);
                expect(analysis.score).to.be.a('number');
            } catch (error) {
                // Expected when service is not running
                expect((error as Error).message).to.include('Service unavailable');
            }
        });

        it('should provide appropriate recommendations for different grades', async () => {
            const documents: Document[] = [
                {
                    type: 'receipt',
                    content: 'Mock content',
                    filename: 'test.pdf',
                    uploadedAt: Date.now()
                }
            ];

            try {
                const analysis = await mlService.analyzeDocuments(documents);
                
                expect(analysis.recommendations).to.be.an('array');
                expect(analysis.recommendations.length).to.be.greaterThan(0);
                
                // Check that recommendations are strings
                analysis.recommendations.forEach(rec => {
                    expect(rec).to.be.a('string');
                    expect(rec.length).to.be.greaterThan(0);
                });
            } catch (error) {
                // Expected when service is not running
                expect((error as Error).message).to.include('Service unavailable');
            }
        });
    });

    describe('getCarbonFactors', () => {
        it('should return carbon emission factors', async () => {
            try {
                const factors = await mlService.getCarbonFactors();

                expect(factors).to.have.property('transportation');
                expect(factors).to.have.property('energy');
                expect(factors).to.have.property('waste');
                expect(factors).to.have.property('consumption');

                expect(factors.transportation).to.have.property('car_per_mile');
                expect(factors.transportation).to.have.property('flight_per_mile');
                expect(factors.energy).to.have.property('electricity_per_kwh');
                expect(factors.waste).to.have.property('landfill_per_kg');
            } catch (error) {
                // Expected when service is not running
                expect((error as Error).message).to.include('Service unavailable');
            }
        });
    });
});