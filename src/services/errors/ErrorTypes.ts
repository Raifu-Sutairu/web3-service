/**
 * Comprehensive error handling types and classes for the Web3 EcoNFT service
 */

export enum ErrorCode {
    // Network errors
    NETWORK_ERROR = 'NETWORK_ERROR',
    RPC_ERROR = 'RPC_ERROR',
    CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
    
    // Contract errors
    CONTRACT_NOT_FOUND = 'CONTRACT_NOT_FOUND',
    CONTRACT_CALL_FAILED = 'CONTRACT_CALL_FAILED',
    TRANSACTION_FAILED = 'TRANSACTION_FAILED',
    GAS_ESTIMATION_FAILED = 'GAS_ESTIMATION_FAILED',
    INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
    
    // Validation errors
    INVALID_ADDRESS = 'INVALID_ADDRESS',
    INVALID_TOKEN_ID = 'INVALID_TOKEN_ID',
    INVALID_GRADE = 'INVALID_GRADE',
    INVALID_SCORE = 'INVALID_SCORE',
    INVALID_PRICE = 'INVALID_PRICE',
    INVALID_PARAMETERS = 'INVALID_PARAMETERS',
    
    // Business logic errors
    USER_NOT_REGISTERED = 'USER_NOT_REGISTERED',
    USER_ALREADY_REGISTERED = 'USER_ALREADY_REGISTERED',
    WEEKLY_LIMIT_EXCEEDED = 'WEEKLY_LIMIT_EXCEEDED',
    UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
    TOKEN_NOT_FOUND = 'TOKEN_NOT_FOUND',
    LISTING_NOT_FOUND = 'LISTING_NOT_FOUND',
    
    // External service errors
    EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
    AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
    ML_SERVICE_ERROR = 'ML_SERVICE_ERROR',
    IPFS_SERVICE_ERROR = 'IPFS_SERVICE_ERROR',
    CARBON_CALCULATOR_ERROR = 'CARBON_CALCULATOR_ERROR',
    
    // Rate limiting and throttling
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
    SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
    
    // Data integrity errors
    DATA_CORRUPTION = 'DATA_CORRUPTION',
    CHECKSUM_MISMATCH = 'CHECKSUM_MISMATCH',
    
    // Unknown errors
    UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export enum ErrorSeverity {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL'
}

export interface ErrorContext {
    operation: string;
    contractName?: string;
    functionName?: string;
    parameters?: any;
    transactionHash?: string;
    blockNumber?: number;
    gasUsed?: number;
    timestamp: number;
    userId?: string;
    requestId?: string;
}

export class Web3ServiceError extends Error {
    public readonly code: ErrorCode;
    public readonly severity: ErrorSeverity;
    public readonly context: ErrorContext;
    public readonly originalError?: Error;
    public readonly retryable: boolean;
    public readonly userMessage: string;

    constructor(
        code: ErrorCode,
        message: string,
        context: ErrorContext,
        options: {
            severity?: ErrorSeverity;
            originalError?: Error;
            retryable?: boolean;
            userMessage?: string;
        } = {}
    ) {
        super(message);
        this.name = 'Web3ServiceError';
        this.code = code;
        this.severity = options.severity || ErrorSeverity.MEDIUM;
        this.context = context;
        this.originalError = options.originalError;
        this.retryable = options.retryable || false;
        this.userMessage = options.userMessage || this.getDefaultUserMessage();
    }

    private getDefaultUserMessage(): string {
        switch (this.code) {
            case ErrorCode.NETWORK_ERROR:
                return 'Network connection issue. Please check your internet connection and try again.';
            case ErrorCode.INSUFFICIENT_FUNDS:
                return 'Insufficient funds to complete the transaction. Please check your wallet balance.';
            case ErrorCode.USER_NOT_REGISTERED:
                return 'Please register your account before performing this action.';
            case ErrorCode.WEEKLY_LIMIT_EXCEEDED:
                return 'You have reached your weekly upload limit. Please try again next week.';
            case ErrorCode.UNAUTHORIZED_ACCESS:
                return 'You do not have permission to perform this action.';
            case ErrorCode.TOKEN_NOT_FOUND:
                return 'The requested NFT could not be found.';
            case ErrorCode.EXTERNAL_SERVICE_ERROR:
                return 'External service is temporarily unavailable. Please try again later.';
            case ErrorCode.RATE_LIMIT_EXCEEDED:
                return 'Too many requests. Please wait a moment before trying again.';
            default:
                return 'An unexpected error occurred. Please try again or contact support.';
        }
    }

    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            userMessage: this.userMessage,
            severity: this.severity,
            context: this.context,
            retryable: this.retryable,
            stack: this.stack,
            originalError: this.originalError?.message
        };
    }
}

export class NetworkError extends Web3ServiceError {
    constructor(message: string, context: ErrorContext, originalError?: Error) {
        super(ErrorCode.NETWORK_ERROR, message, context, {
            severity: ErrorSeverity.HIGH,
            originalError,
            retryable: true
        });
    }
}

export class ContractError extends Web3ServiceError {
    constructor(message: string, context: ErrorContext, originalError?: Error) {
        super(ErrorCode.CONTRACT_CALL_FAILED, message, context, {
            severity: ErrorSeverity.HIGH,
            originalError,
            retryable: false
        });
    }
}

export class ValidationError extends Web3ServiceError {
    constructor(code: ErrorCode, message: string, context: ErrorContext) {
        super(code, message, context, {
            severity: ErrorSeverity.MEDIUM,
            retryable: false
        });
    }
}

export class ExternalServiceError extends Web3ServiceError {
    constructor(serviceName: string, message: string, context: ErrorContext, originalError?: Error) {
        super(ErrorCode.EXTERNAL_SERVICE_ERROR, `${serviceName}: ${message}`, context, {
            severity: ErrorSeverity.MEDIUM,
            originalError,
            retryable: true
        });
    }
}

export class RateLimitError extends Web3ServiceError {
    public readonly retryAfter: number;

    constructor(message: string, context: ErrorContext, retryAfter: number = 60) {
        super(ErrorCode.RATE_LIMIT_EXCEEDED, message, context, {
            severity: ErrorSeverity.LOW,
            retryable: true,
            userMessage: `Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`
        });
        this.retryAfter = retryAfter;
    }
}

// Error factory functions
export function createNetworkError(operation: string, originalError: Error): NetworkError {
    return new NetworkError(
        `Network error during ${operation}`,
        {
            operation,
            timestamp: Date.now()
        },
        originalError
    );
}

export function createContractError(
    operation: string,
    contractName: string,
    functionName: string,
    originalError: Error
): ContractError {
    return new ContractError(
        `Contract call failed: ${contractName}.${functionName}`,
        {
            operation,
            contractName,
            functionName,
            timestamp: Date.now()
        },
        originalError
    );
}

export function createValidationError(
    code: ErrorCode,
    field: string,
    value: any,
    operation: string
): ValidationError {
    return new ValidationError(
        code,
        `Invalid ${field}: ${value}`,
        {
            operation,
            parameters: { field, value },
            timestamp: Date.now()
        }
    );
}

export function createExternalServiceError(
    serviceName: string,
    operation: string,
    originalError: Error
): ExternalServiceError {
    return new ExternalServiceError(
        serviceName,
        originalError.message,
        {
            operation,
            timestamp: Date.now()
        },
        originalError
    );
}

// Error parsing utilities
export function parseContractError(error: any): ErrorCode {
    const errorMessage = error.message || error.reason || '';
    
    if (errorMessage.includes('UnauthorizedAccess')) return ErrorCode.UNAUTHORIZED_ACCESS;
    if (errorMessage.includes('TokenNotFound')) return ErrorCode.TOKEN_NOT_FOUND;
    if (errorMessage.includes('InvalidGrade')) return ErrorCode.INVALID_GRADE;
    if (errorMessage.includes('InvalidScore')) return ErrorCode.INVALID_SCORE;
    if (errorMessage.includes('InvalidPrice')) return ErrorCode.INVALID_PRICE;
    if (errorMessage.includes('UserNotRegistered')) return ErrorCode.USER_NOT_REGISTERED;
    if (errorMessage.includes('UserAlreadyRegistered')) return ErrorCode.USER_ALREADY_REGISTERED;
    if (errorMessage.includes('WeeklyLimitExceeded')) return ErrorCode.WEEKLY_LIMIT_EXCEEDED;
    if (errorMessage.includes('InsufficientFunds')) return ErrorCode.INSUFFICIENT_FUNDS;
    if (errorMessage.includes('ListingNotFound')) return ErrorCode.LISTING_NOT_FOUND;
    
    return ErrorCode.CONTRACT_CALL_FAILED;
}

export function isRetryableError(error: Error): boolean {
    if (error instanceof Web3ServiceError) {
        return error.retryable;
    }
    
    const errorMessage = error.message.toLowerCase();
    
    // Network-related errors are usually retryable
    if (errorMessage.includes('network') || 
        errorMessage.includes('timeout') || 
        errorMessage.includes('connection') ||
        errorMessage.includes('econnreset') ||
        errorMessage.includes('enotfound')) {
        return true;
    }
    
    // Rate limiting errors are retryable
    if (errorMessage.includes('rate limit') || 
        errorMessage.includes('too many requests')) {
        return true;
    }
    
    // Temporary service unavailability
    if (errorMessage.includes('service unavailable') ||
        errorMessage.includes('502') ||
        errorMessage.includes('503') ||
        errorMessage.includes('504')) {
        return true;
    }
    
    return false;
}

export function getRetryDelay(attempt: number, baseDelay: number = 1000): number {
    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
}