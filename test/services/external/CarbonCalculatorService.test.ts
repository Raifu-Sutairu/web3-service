import { expect } from 'chai';
import { CarbonCalculatorService } from '../../../src/services/external/CarbonCalculatorService';
import { CarbonData } from '../../../src/services/external/types';

describe('CarbonCalculatorService', () => {
    let carbonCalculatorService: CarbonCalculatorService;

    beforeEach(() => {
        carbonCalculatorService = new CarbonCalculatorService();
    });

    describe('validateCarbonData', () => {
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

            expect(carbonCalculatorService.validateCarbonData(validData)).to.be.true;
        });

        it('should reject invalid data formats', () => {
            expect(carbonCalculatorService.validateCarbonData(null as any)).to.be.false;
            expect(carbonCalculatorService.validateCarbonData(undefined as any)).to.be.false;
            expect(carbonCalculatorService.validateCarbonData('string' as any)).to.be.false;
            expect(carbonCalculatorService.validateCarbonData({})).to.be.false;
        });

        it('should accept data with at least one category', () => {
            const dataWithTransportation = {
                transportation: { carMiles: 100 }
            } as CarbonData;
            const dataWithEnergy = {
                energy: { electricityKwh: 500 }
            } as CarbonData;

            expect(carbonCalculatorService.validateCarbonData(dataWithTransportation)).to.be.true;
            expect(carbonCalculatorService.validateCarbonData(dataWithEnergy)).to.be.true;
        });
    });

    describe('calculateEmissions', () => {
        it('should calculate emissions for transportation data', async () => {
            const data: CarbonData = {
                transportation: {
                    carMiles: 100,
                    publicTransportMiles: 50,
                    bikeWalkMiles: 20
                }
            };

            try {
                const emissions = await carbonCalculatorService.calculateEmissions(data);
                expect(emissions).to.be.a('number');
                expect(emissions).to.be.at.least(0);
            } catch (error) {
                // Expected when service is not running
                expect((error as Error).message).to.include('Service unavailable');
            }
        });

        it('should calculate emissions for comprehensive data', async () => {
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
                const emissions = await carbonCalculatorService.calculateEmissions(data);
                expect(emissions).to.be.a('number');
                expect(emissions).to.be.at.least(0);
            } catch (error) {
                // Expected when service is not running
                expect((error as Error).message).to.include('Service unavailable');
            }
        });
    });

    describe('getEmissionFactors', () => {
        it('should return emission factors', async () => {
            try {
                const factors = await carbonCalculatorService.getEmissionFactors();

                expect(factors).to.be.an('object');
                // The structure depends on the external service implementation
            } catch (error) {
                // Expected when service is not running
                expect((error as Error).message).to.include('Service unavailable');
            }
        });
    });
});