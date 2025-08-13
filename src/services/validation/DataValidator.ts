import { CarbonData, Document, ValidationResult } from '../external/types';

export interface IDataValidator {
    validateCarbonData(data: CarbonData): ValidationResult;
    validateDocuments(documents: Document[]): ValidationResult;
    sanitizeInput(input: any): any;
    validateNFTMetadata(metadata: any): ValidationResult;
}

export class DataValidator implements IDataValidator {
    private readonly maxFileSize = 10 * 1024 * 1024; // 10MB
    private readonly allowedFileTypes = ['image/jpeg', 'image/png', 'application/pdf', 'text/plain'];
    private readonly maxDocuments = 10;

    /**
     * Validate carbon footprint data structure and values
     */
    validateCarbonData(data: CarbonData): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            // Check if data exists
            if (!data || typeof data !== 'object') {
                errors.push('Carbon data must be a valid object');
                return { isValid: false, errors, warnings };
            }

            // Validate transportation data
            if (data.transportation) {
                const transport = data.transportation;
                if (transport.carMiles !== undefined && (transport.carMiles < 0 || transport.carMiles > 100000)) {
                    errors.push('Car miles must be between 0 and 100,000');
                }
                if (transport.flightMiles !== undefined && (transport.flightMiles < 0 || transport.flightMiles > 500000)) {
                    errors.push('Flight miles must be between 0 and 500,000');
                }
                if (transport.publicTransportMiles !== undefined && transport.publicTransportMiles < 0) {
                    errors.push('Public transport miles cannot be negative');
                }
                if (transport.bikeWalkMiles !== undefined && transport.bikeWalkMiles < 0) {
                    errors.push('Bike/walk miles cannot be negative');
                }
            }

            // Validate energy data
            if (data.energy) {
                const energy = data.energy;
                if (energy.electricityKwh !== undefined && (energy.electricityKwh < 0 || energy.electricityKwh > 50000)) {
                    errors.push('Electricity usage must be between 0 and 50,000 kWh');
                }
                if (energy.gasUsage !== undefined && energy.gasUsage < 0) {
                    errors.push('Gas usage cannot be negative');
                }
                if (energy.renewablePercentage !== undefined && (energy.renewablePercentage < 0 || energy.renewablePercentage > 100)) {
                    errors.push('Renewable percentage must be between 0 and 100');
                }
            }

            // Validate waste data
            if (data.waste) {
                const waste = data.waste;
                if (waste.recyclingPercentage !== undefined && (waste.recyclingPercentage < 0 || waste.recyclingPercentage > 100)) {
                    errors.push('Recycling percentage must be between 0 and 100');
                }
                if (waste.compostingPercentage !== undefined && (waste.compostingPercentage < 0 || waste.compostingPercentage > 100)) {
                    errors.push('Composting percentage must be between 0 and 100');
                }
                if (waste.totalWasteKg !== undefined && waste.totalWasteKg < 0) {
                    errors.push('Total waste cannot be negative');
                }
            }

            // Validate consumption data
            if (data.consumption) {
                const consumption = data.consumption;
                if (consumption.meatConsumption !== undefined && consumption.meatConsumption < 0) {
                    errors.push('Meat consumption cannot be negative');
                }
                if (consumption.localFoodPercentage !== undefined && (consumption.localFoodPercentage < 0 || consumption.localFoodPercentage > 100)) {
                    errors.push('Local food percentage must be between 0 and 100');
                }
                if (consumption.secondHandPercentage !== undefined && (consumption.secondHandPercentage < 0 || consumption.secondHandPercentage > 100)) {
                    errors.push('Second-hand percentage must be between 0 and 100');
                }
            }

            // Add warnings for missing data
            if (!data.transportation && !data.energy && !data.waste && !data.consumption) {
                warnings.push('No carbon data categories provided');
            }

            return {
                isValid: errors.length === 0,
                errors,
                warnings,
                sanitizedData: this.sanitizeCarbonData(data)
            };
        } catch (error) {
            errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return { isValid: false, errors, warnings };
        }
    }

    /**
     * Validate uploaded documents
     */
    validateDocuments(documents: Document[]): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            // Check document count
            if (!documents || !Array.isArray(documents)) {
                errors.push('Documents must be provided as an array');
                return { isValid: false, errors, warnings };
            }

            if (documents.length === 0) {
                errors.push('At least one document must be provided');
                return { isValid: false, errors, warnings };
            }

            if (documents.length > this.maxDocuments) {
                errors.push(`Maximum ${this.maxDocuments} documents allowed`);
            }

            // Validate each document
            documents.forEach((doc, index) => {
                if (!doc.type || !['receipt', 'bill', 'report', 'photo'].includes(doc.type)) {
                    errors.push(`Document ${index + 1}: Invalid type. Must be receipt, bill, report, or photo`);
                }

                if (!doc.filename || typeof doc.filename !== 'string') {
                    errors.push(`Document ${index + 1}: Filename is required`);
                }

                if (!doc.content) {
                    errors.push(`Document ${index + 1}: Content is required`);
                }

                // Check file size if content is Buffer
                if (Buffer.isBuffer(doc.content) && doc.content.length > this.maxFileSize) {
                    errors.push(`Document ${index + 1}: File size exceeds ${this.maxFileSize / 1024 / 1024}MB limit`);
                }

                if (!doc.uploadedAt || typeof doc.uploadedAt !== 'number') {
                    warnings.push(`Document ${index + 1}: Upload timestamp missing or invalid`);
                }
            });

            return {
                isValid: errors.length === 0,
                errors,
                warnings,
                sanitizedData: this.sanitizeDocuments(documents)
            };
        } catch (error) {
            errors.push(`Document validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return { isValid: false, errors, warnings };
        }
    }

    /**
     * Sanitize and clean input data
     */
    sanitizeInput(input: any): any {
        if (input === null || input === undefined) {
            return input;
        }

        if (typeof input === 'string') {
            return input.trim().replace(/[<>]/g, ''); // Basic XSS prevention
        }

        if (typeof input === 'number') {
            return isNaN(input) ? 0 : input;
        }

        if (Array.isArray(input)) {
            return input.map(item => this.sanitizeInput(item));
        }

        if (typeof input === 'object') {
            const sanitized: any = {};
            for (const [key, value] of Object.entries(input)) {
                sanitized[key] = this.sanitizeInput(value);
            }
            return sanitized;
        }

        return input;
    }

    /**
     * Validate NFT metadata structure
     */
    validateNFTMetadata(metadata: any): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            if (!metadata || typeof metadata !== 'object') {
                errors.push('Metadata must be a valid object');
                return { isValid: false, errors, warnings };
            }

            // Required fields
            if (!metadata.name || typeof metadata.name !== 'string') {
                errors.push('Name is required and must be a string');
            }

            if (!metadata.description || typeof metadata.description !== 'string') {
                errors.push('Description is required and must be a string');
            }

            if (!metadata.image || typeof metadata.image !== 'string') {
                errors.push('Image URL/hash is required and must be a string');
            }

            // Validate attributes
            if (!metadata.attributes || typeof metadata.attributes !== 'object') {
                errors.push('Attributes object is required');
            } else {
                const attrs = metadata.attributes;
                
                if (attrs.grade === undefined || ![0, 1, 2, 3, 4].includes(attrs.grade)) {
                    errors.push('Grade must be a number between 0-4 (A-F)');
                }

                if (attrs.carbonScore === undefined || typeof attrs.carbonScore !== 'number' || attrs.carbonScore < 0) {
                    errors.push('Carbon score must be a non-negative number');
                }

                if (!attrs.theme || typeof attrs.theme !== 'string') {
                    errors.push('Theme is required and must be a string');
                }

                if (!attrs.generatedAt || typeof attrs.generatedAt !== 'number') {
                    warnings.push('Generated timestamp missing or invalid');
                }
            }

            return {
                isValid: errors.length === 0,
                errors,
                warnings,
                sanitizedData: this.sanitizeInput(metadata)
            };
        } catch (error) {
            errors.push(`Metadata validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return { isValid: false, errors, warnings };
        }
    }

    /**
     * Sanitize carbon data
     */
    private sanitizeCarbonData(data: CarbonData): CarbonData {
        const sanitized: CarbonData = {};

        if (data.transportation) {
            sanitized.transportation = {
                carMiles: this.sanitizeNumber(data.transportation.carMiles),
                publicTransportMiles: this.sanitizeNumber(data.transportation.publicTransportMiles),
                flightMiles: this.sanitizeNumber(data.transportation.flightMiles),
                bikeWalkMiles: this.sanitizeNumber(data.transportation.bikeWalkMiles)
            };
        }

        if (data.energy) {
            sanitized.energy = {
                electricityKwh: this.sanitizeNumber(data.energy.electricityKwh),
                gasUsage: this.sanitizeNumber(data.energy.gasUsage),
                renewablePercentage: this.sanitizePercentage(data.energy.renewablePercentage)
            };
        }

        if (data.waste) {
            sanitized.waste = {
                recyclingPercentage: this.sanitizePercentage(data.waste.recyclingPercentage),
                compostingPercentage: this.sanitizePercentage(data.waste.compostingPercentage),
                totalWasteKg: this.sanitizeNumber(data.waste.totalWasteKg)
            };
        }

        if (data.consumption) {
            sanitized.consumption = {
                meatConsumption: this.sanitizeNumber(data.consumption.meatConsumption),
                localFoodPercentage: this.sanitizePercentage(data.consumption.localFoodPercentage),
                newPurchases: this.sanitizeNumber(data.consumption.newPurchases),
                secondHandPercentage: this.sanitizePercentage(data.consumption.secondHandPercentage)
            };
        }

        return sanitized;
    }

    /**
     * Sanitize documents array
     */
    private sanitizeDocuments(documents: Document[]): Document[] {
        return documents.map(doc => ({
            type: doc.type,
            content: doc.content,
            filename: typeof doc.filename === 'string' ? doc.filename.trim() : '',
            uploadedAt: typeof doc.uploadedAt === 'number' ? doc.uploadedAt : Date.now()
        }));
    }

    /**
     * Sanitize number values
     */
    private sanitizeNumber(value: number | undefined): number | undefined {
        if (value === undefined) return undefined;
        const num = Number(value);
        return isNaN(num) ? undefined : Math.max(0, num);
    }

    /**
     * Sanitize percentage values (0-100)
     */
    private sanitizePercentage(value: number | undefined): number | undefined {
        if (value === undefined) return undefined;
        const num = Number(value);
        return isNaN(num) ? undefined : Math.max(0, Math.min(100, num));
    }
}