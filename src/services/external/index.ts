import { GeminiService } from './GeminiService';
import { MLService } from './MLService';
import { CarbonCalculatorService } from './CarbonCalculatorService';

// Create and export service instances (no configuration needed - using direct API calls)
export const geminiService = new GeminiService();
export const mlService = new MLService();
export const carbonCalculatorService = new CarbonCalculatorService();

export * from './GeminiService';
export * from './MLService';
export * from './CarbonCalculatorService';
export * from './types';