import axios from 'axios';
import { Grade } from '../ipfs/types';
import { CarbonData, Document, GradeAnalysis } from './types';

export interface IMLService {
    analyzeDocuments(documents: Document[]): Promise<GradeAnalysis>;
    calculateCarbonScore(data: CarbonData): Promise<number>;
    validateDataFormat(data: any): boolean;
    getCarbonFactors(): Promise<any>;
}

export class MLService implements IMLService {
    private readonly baseUrl = 'http://localhost:3003/api/ml';

    /**
     * Analyze uploaded documents by calling external ML service endpoint
     */
    async analyzeDocuments(documents: Document[]): Promise<GradeAnalysis> {
        try {
            const response = await axios.post(`${this.baseUrl}/analyze-documents`, {
                documents: documents.map(doc => ({
                    type: doc.type,
                    filename: doc.filename,
                    content: doc.content.toString('base64')
                }))
            }, {
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return {
                grade: this.stringToGrade(response.data.grade),
                score: response.data.score,
                confidence: response.data.confidence,
                factors: response.data.factors,
                recommendations: response.data.recommendations,
                improvement: response.data.improvement
            };
        } catch (error) {
            console.error('Error calling ML document analysis service:', error);
            throw new Error(`Failed to analyze documents: ${error instanceof Error ? error.message : 'Service unavailable'}`);
        }
    }

    /**
     * Calculate carbon score by calling external ML service endpoint
     */
    async calculateCarbonScore(data: CarbonData): Promise<number> {
        try {
            const response = await axios.post(`${this.baseUrl}/calculate-score`, {
                carbonData: data
            }, {
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return response.data.score;
        } catch (error) {
            console.error('Error calling ML carbon score service:', error);
            throw new Error(`Failed to calculate carbon score: ${error instanceof Error ? error.message : 'Service unavailable'}`);
        }
    }

    /**
     * Validate carbon data format
     */
    validateDataFormat(data: any): boolean {
        try {
            if (!data || typeof data !== 'object') {
                return false;
            }

            const requiredCategories = ['transportation', 'energy', 'waste', 'consumption'];
            const hasValidCategories = requiredCategories.some(category => 
                data[category] && typeof data[category] === 'object'
            );

            return hasValidCategories;
        } catch (error) {
            console.error('Error validating data format:', error);
            return false;
        }
    }

    /**
     * Get carbon emission factors by calling external service endpoint
     */
    async getCarbonFactors(): Promise<any> {
        try {
            const response = await axios.get(`${this.baseUrl}/carbon-factors`, {
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return response.data;
        } catch (error) {
            console.error('Error calling carbon factors service:', error);
            throw new Error(`Failed to get carbon factors: ${error instanceof Error ? error.message : 'Service unavailable'}`);
        }
    }

    /**
     * Convert string grade to Grade enum
     */
    private stringToGrade(gradeStr: string): Grade {
        switch (gradeStr.toUpperCase()) {
            case 'A': return Grade.A;
            case 'B': return Grade.B;
            case 'C': return Grade.C;
            case 'D': return Grade.D;
            case 'F': return Grade.F;
            default: return Grade.F;
        }
    }
}