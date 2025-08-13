import axios, { AxiosError } from 'axios';
import { Grade } from '../ipfs/types';
import { UserPreferences, ArtworkResult } from './types';
import { ErrorHandler } from '../errors/ErrorHandler';
import { 
    Web3ServiceError, 
    ErrorCode, 
    createExternalServiceError 
} from '../errors/ErrorTypes';

export interface IGeminiService {
    generateArtwork(theme: string, grade: Grade, userPreferences?: UserPreferences): Promise<ArtworkResult>;
    validateTheme(theme: string): boolean;
    getAvailableThemes(): string[];
}

export class GeminiService implements IGeminiService {
    private readonly baseUrl = 'http://localhost:3002/api/ai';
    private readonly availableThemes = [
        'nature', 'ocean', 'forest', 'renewable-energy', 'sustainability',
        'green-city', 'wildlife', 'clean-air', 'solar-power', 'recycling'
    ];
    private readonly errorHandler = new ErrorHandler();
    private readonly timeout = 30000; // 30 seconds
    private readonly maxRetries = 3;

    /**
     * Generate AI artwork by calling external AI service endpoint
     */
    async generateArtwork(
        theme: string, 
        grade: Grade, 
        userPreferences: UserPreferences = {}
    ): Promise<ArtworkResult> {
        return this.errorHandler.executeWithRetry(
            async () => {
                // Validate inputs
                if (!this.validateTheme(theme)) {
                    throw new Web3ServiceError(
                        ErrorCode.INVALID_PARAMETERS,
                        `Invalid theme: ${theme}. Available themes: ${this.availableThemes.join(', ')}`,
                        { 
                            operation: 'generate-artwork',
                            parameters: { theme, grade, userPreferences },
                            timestamp: Date.now()
                        }
                    );
                }

                if (grade < 0 || grade > 4) {
                    throw new Web3ServiceError(
                        ErrorCode.INVALID_GRADE,
                        `Invalid grade: ${grade}. Must be between 0 and 4`,
                        { 
                            operation: 'generate-artwork',
                            parameters: { theme, grade, userPreferences },
                            timestamp: Date.now()
                        }
                    );
                }

                // Rate limiting check
                await this.errorHandler.checkRateLimit('gemini-api', 10, 60000); // 10 requests per minute

                const response = await axios.post(`${this.baseUrl}/generate-artwork`, {
                    theme,
                    grade: Grade[grade],
                    preferences: userPreferences
                }, {
                    timeout: this.timeout,
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Web3EcoNFT/1.0'
                    },
                    validateStatus: (status) => status < 500 // Only retry on 5xx errors
                });

                // Validate response structure
                if (!response.data || !response.data.imageUrl || !response.data.ipfsHash) {
                    throw new Web3ServiceError(
                        ErrorCode.EXTERNAL_SERVICE_ERROR,
                        'Invalid response from AI service: missing required fields',
                        { 
                            operation: 'generate-artwork',
                            parameters: { theme, grade },
                            timestamp: Date.now()
                        }
                    );
                }

                return {
                    imageUrl: response.data.imageUrl,
                    ipfsHash: response.data.ipfsHash,
                    metadata: {
                        theme,
                        grade,
                        style: userPreferences.style || 'artistic',
                        prompt: response.data.prompt || 'Generated artwork',
                        generatedAt: Date.now()
                    }
                };
            },
            {
                operation: 'generate-artwork',
                timestamp: Date.now()
            },
            {
                maxAttempts: this.maxRetries,
                baseDelay: 2000,
                maxDelay: 10000
            }
        ).catch(error => {
            if (error instanceof Web3ServiceError) {
                throw error;
            }
            
            // Handle axios-specific errors
            if (error instanceof AxiosError) {
                if (error.code === 'ECONNABORTED') {
                    throw createExternalServiceError(
                        'Gemini AI Service',
                        'generate-artwork',
                        new Error('Request timeout - AI service took too long to respond')
                    );
                }
                
                if (error.response?.status === 429) {
                    throw new Web3ServiceError(
                        ErrorCode.RATE_LIMIT_EXCEEDED,
                        'AI service rate limit exceeded',
                        { operation: 'generate-artwork', timestamp: Date.now() },
                        { retryable: true }
                    );
                }
                
                if (error.response?.status && error.response.status >= 400) {
                    throw createExternalServiceError(
                        'Gemini AI Service',
                        'generate-artwork',
                        new Error(`HTTP ${error.response.status}: ${error.response.data?.message || error.message}`)
                    );
                }
            }
            
            throw createExternalServiceError('Gemini AI Service', 'generate-artwork', error as Error);
        });
    }

    /**
     * Validate if theme is supported
     */
    validateTheme(theme: string): boolean {
        return this.availableThemes.includes(theme.toLowerCase());
    }

    /**
     * Get list of available themes
     */
    getAvailableThemes(): string[] {
        return [...this.availableThemes];
    }
}