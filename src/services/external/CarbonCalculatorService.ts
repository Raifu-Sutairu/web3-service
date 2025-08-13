import axios from 'axios';
import { CarbonData } from './types';

export interface ICarbonCalculatorService {
    calculateEmissions(data: CarbonData): Promise<number>;
    getEmissionFactors(): Promise<any>;
    validateCarbonData(data: CarbonData): boolean;
}

export class CarbonCalculatorService implements ICarbonCalculatorService {
    private readonly baseUrl = 'http://localhost:3004/api/carbon';

    /**
     * Calculate carbon emissions by calling external carbon calculator service
     */
    async calculateEmissions(data: CarbonData): Promise<number> {
        try {
            const response = await axios.post(`${this.baseUrl}/calculate-emissions`, {
                carbonData: data
            }, {
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return response.data.totalEmissions;
        } catch (error) {
            console.error('Error calling carbon calculator service:', error);
            throw new Error(`Failed to calculate emissions: ${error instanceof Error ? error.message : 'Service unavailable'}`);
        }
    }

    /**
     * Get emission factors by calling external service endpoint
     */
    async getEmissionFactors(): Promise<any> {
        try {
            const response = await axios.get(`${this.baseUrl}/emission-factors`, {
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return response.data;
        } catch (error) {
            console.error('Error calling emission factors service:', error);
            throw new Error(`Failed to get emission factors: ${error instanceof Error ? error.message : 'Service unavailable'}`);
        }
    }

    /**
     * Validate carbon data format
     */
    validateCarbonData(data: CarbonData): boolean {
        try {
            if (!data || typeof data !== 'object') {
                return false;
            }

            // Check if at least one category has data
            const categories = ['transportation', 'energy', 'waste', 'consumption'];
            return categories.some(category => 
                data[category as keyof CarbonData] && 
                typeof data[category as keyof CarbonData] === 'object'
            );
        } catch (error) {
            console.error('Error validating carbon data:', error);
            return false;
        }
    }
}