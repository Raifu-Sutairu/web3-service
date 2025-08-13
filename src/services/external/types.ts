import { Grade } from '../ipfs/types';

// Gemini AI Service Types
export interface UserPreferences {
    colorScheme?: 'vibrant' | 'earth' | 'minimal' | 'dark';
    style?: 'abstract' | 'realistic' | 'cartoon' | 'artistic';
    elements?: string[];
}

export interface ArtworkResult {
    imageUrl: string;
    ipfsHash?: string;
    metadata: {
        theme: string;
        grade: Grade;
        style: string;
        prompt: string;
        generatedAt: number;
    };
}

// ML Service Types
export interface CarbonData {
    transportation: {
        carMiles?: number;
        publicTransportMiles?: number;
        flightMiles?: number;
        bikeWalkMiles?: number;
    };
    energy: {
        electricityKwh?: number;
        gasUsage?: number;
        renewablePercentage?: number;
    };
    waste: {
        recyclingPercentage?: number;
        compostingPercentage?: number;
        totalWasteKg?: number;
    };
    consumption: {
        meatConsumption?: number;
        localFoodPercentage?: number;
        newPurchases?: number;
        secondHandPercentage?: number;
    };
}

export interface Document {
    type: 'receipt' | 'bill' | 'report' | 'photo';
    content: string | Buffer;
    filename: string;
    uploadedAt: number;
}

export interface GradeAnalysis {
    grade: Grade;
    score: number;
    confidence: number;
    factors: {
        transportation: number;
        energy: number;
        waste: number;
        consumption: number;
    };
    recommendations: string[];
    previousGrade?: Grade;
    improvement?: number;
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    sanitizedData?: any;
}

// Service Configuration Types (removed - using direct API calls now)