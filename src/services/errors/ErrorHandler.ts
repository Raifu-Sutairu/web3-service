/**
 * Comprehensive error handling service with retry mechanisms and logging
 */

import {
    Web3ServiceError,
    ErrorCode,
    ErrorSeverity,
    ErrorContext,
    NetworkError,
    ContractError,
    ExternalServiceError,
    RateLimitError,
    parseContractError,
    isRetryableError,
    getRetryDelay,
    createNetworkError,
    createContractError,
    createExternalServiceError
} from './ErrorTypes';

export interface RetryConfig {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    retryableErrors?: ErrorCode[];
}

export interface CircuitBreakerConfig {
    failureThreshold: number;
    resetTimeout: number;
    monitoringPeriod: number;
}

export enum CircuitBreakerState {
    CLOSED = 'CLOSED',
    OPEN = 'OPEN',
    HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
    private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
    private failureCount: number = 0;
    private lastFailureTime: number = 0;
    private successCount: number = 0;

    constructor(private config: CircuitBreakerConfig) {}

    async execute<T>(operation: () => Promise<T>): Promise<T> {
        if (this.state === CircuitBreakerState.OPEN) {
            if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
                this.state = CircuitBreakerState.HALF_OPEN;
                this.successCount = 0;
            } else {
                throw new Web3ServiceError(
                    ErrorCode.SERVICE_UNAVAILABLE,
                    'Circuit breaker is open',
                    { operation: 'circuit-breaker', timestamp: Date.now() },
                    { severity: ErrorSeverity.HIGH }
                );
            }
        }

        try {
            const result = await operation();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private onSuccess(): void {
        this.failureCount = 0;
        if (this.state === CircuitBreakerState.HALF_OPEN) {
            this.successCount++;
            if (this.successCount >= 3) { // Require 3 successes to close
                this.state = CircuitBreakerState.CLOSED;
            }
        }
    }

    private onFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        
        if (this.failureCount >= this.config.failureThreshold) {
            this.state = CircuitBreakerState.OPEN;
        }
    }

    getState(): CircuitBreakerState {
        return this.state;
    }
}

export class ErrorHandler {
    private circuitBreakers: Map<string, CircuitBreaker> = new Map();
    private rateLimiters: Map<string, { count: number; resetTime: number }> = new Map();

    private defaultRetryConfig: RetryConfig = {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        retryableErrors: [
            ErrorCode.NETWORK_ERROR,
            ErrorCode.RPC_ERROR,
            ErrorCode.CONNECTION_TIMEOUT,
            ErrorCode.EXTERNAL_SERVICE_ERROR,
            ErrorCode.SERVICE_UNAVAILABLE
        ]
    };

    private defaultCircuitBreakerConfig: CircuitBreakerConfig = {
        failureThreshold: 5,
        resetTimeout: 60000, // 1 minute
        monitoringPeriod: 300000 // 5 minutes
    };

    /**
     * Execute an operation with retry logic and circuit breaker protection
     */
    async executeWithRetry<T>(
        operation: () => Promise<T>,
        context: ErrorContext,
        config?: Partial<RetryConfig>
    ): Promise<T> {
        const retryConfig = { ...this.defaultRetryConfig, ...config };
        const circuitBreaker = this.getCircuitBreaker(context.operation);

        let lastError: Error;
        
        for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
            try {
                return await circuitBreaker.execute(operation);
            } catch (error) {
                lastError = error as Error;
                
                // Check if error is retryable
                if (!this.isRetryableError(error as Error, retryConfig) || attempt === retryConfig.maxAttempts) {
                    throw this.enhanceError(error as Error, context, attempt);
                }

                // Calculate delay for next attempt
                const delay = this.calculateDelay(attempt, retryConfig);
                await this.delay(delay);

                // Log retry attempt
                console.warn(`Retry attempt ${attempt}/${retryConfig.maxAttempts} for ${context.operation}:`, {
                    error: (error as Error).message,
                    delay,
                    nextAttempt: attempt + 1
                });
            }
        }

        throw this.enhanceError(lastError!, context, retryConfig.maxAttempts);
    }

    /**
     * Handle and enhance errors with additional context
     */
    enhanceError(error: Error, context: ErrorContext, attempt?: number): Web3ServiceError {
        // If already a Web3ServiceError, just add context
        if (error instanceof Web3ServiceError) {
            return new Web3ServiceError(
                error.code,
                error.message,
                { ...error.context, ...context, attempt },
                {
                    severity: error.severity,
                    originalError: error.originalError,
                    retryable: error.retryable,
                    userMessage: error.userMessage
                }
            );
        }

        // Parse and categorize the error
        const errorCode = this.categorizeError(error);
        const severity = this.determineSeverity(errorCode, error);

        return new Web3ServiceError(
            errorCode,
            error.message,
            { ...context, attempt, timestamp: Date.now() },
            {
                severity,
                originalError: error,
                retryable: isRetryableError(error)
            }
        );
    }

    /**
     * Handle rate limiting
     */
    async checkRateLimit(key: string, limit: number, windowMs: number): Promise<void> {
        const now = Date.now();
        const rateLimiter = this.rateLimiters.get(key);

        if (!rateLimiter || now > rateLimiter.resetTime) {
            this.rateLimiters.set(key, { count: 1, resetTime: now + windowMs });
            return;
        }

        if (rateLimiter.count >= limit) {
            const retryAfter = Math.ceil((rateLimiter.resetTime - now) / 1000);
            throw new RateLimitError(
                `Rate limit exceeded for ${key}`,
                { operation: 'rate-limit-check', timestamp: now },
                retryAfter
            );
        }

        rateLimiter.count++;
    }

    /**
     * Validate input parameters
     */
    validateAddress(address: string, fieldName: string = 'address'): void {
        if (!address || typeof address !== 'string') {
            throw new Web3ServiceError(
                ErrorCode.INVALID_ADDRESS,
                `Invalid ${fieldName}: must be a non-empty string`,
                { operation: 'validation', parameters: { fieldName, address }, timestamp: Date.now() },
                { severity: ErrorSeverity.MEDIUM }
            );
        }

        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
            throw new Web3ServiceError(
                ErrorCode.INVALID_ADDRESS,
                `Invalid ${fieldName}: must be a valid Ethereum address`,
                { operation: 'validation', parameters: { fieldName, address }, timestamp: Date.now() },
                { severity: ErrorSeverity.MEDIUM }
            );
        }
    }

    validateTokenId(tokenId: number): void {
        if (!Number.isInteger(tokenId) || tokenId < 0) {
            throw new Web3ServiceError(
                ErrorCode.INVALID_TOKEN_ID,
                `Invalid token ID: must be a non-negative integer`,
                { operation: 'validation', parameters: { tokenId }, timestamp: Date.now() },
                { severity: ErrorSeverity.MEDIUM }
            );
        }
    }

    validateGrade(grade: number): void {
        if (!Number.isInteger(grade) || grade < 0 || grade > 4) {
            throw new Web3ServiceError(
                ErrorCode.INVALID_GRADE,
                `Invalid grade: must be an integer between 0 and 4`,
                { operation: 'validation', parameters: { grade }, timestamp: Date.now() },
                { severity: ErrorSeverity.MEDIUM }
            );
        }
    }

    validateScore(score: number): void {
        if (!Number.isInteger(score) || score < 0 || score > 10000) {
            throw new Web3ServiceError(
                ErrorCode.INVALID_SCORE,
                `Invalid score: must be an integer between 0 and 10000`,
                { operation: 'validation', parameters: { score }, timestamp: Date.now() },
                { severity: ErrorSeverity.MEDIUM }
            );
        }
    }

    validatePrice(price: string): void {
        try {
            const priceNum = parseFloat(price);
            if (isNaN(priceNum) || priceNum <= 0 || priceNum > 1000) {
                throw new Error('Invalid price range');
            }
        } catch (error) {
            throw new Web3ServiceError(
                ErrorCode.INVALID_PRICE,
                `Invalid price: must be a positive number less than 1000 ETH`,
                { operation: 'validation', parameters: { price }, timestamp: Date.now() },
                { severity: ErrorSeverity.MEDIUM }
            );
        }
    }

    /**
     * Log errors with appropriate severity
     */
    logError(error: Web3ServiceError): void {
        const logData = {
            code: error.code,
            message: error.message,
            severity: error.severity,
            context: error.context,
            stack: error.stack
        };

        switch (error.severity) {
            case ErrorSeverity.CRITICAL:
                console.error('CRITICAL ERROR:', logData);
                // In production, this would trigger alerts
                break;
            case ErrorSeverity.HIGH:
                console.error('HIGH SEVERITY ERROR:', logData);
                break;
            case ErrorSeverity.MEDIUM:
                console.warn('MEDIUM SEVERITY ERROR:', logData);
                break;
            case ErrorSeverity.LOW:
                console.info('LOW SEVERITY ERROR:', logData);
                break;
        }
    }

    private getCircuitBreaker(operation: string): CircuitBreaker {
        if (!this.circuitBreakers.has(operation)) {
            this.circuitBreakers.set(operation, new CircuitBreaker(this.defaultCircuitBreakerConfig));
        }
        return this.circuitBreakers.get(operation)!;
    }

    private isRetryableError(error: Error, config: RetryConfig): boolean {
        if (error instanceof Web3ServiceError) {
            return error.retryable && (!config.retryableErrors || config.retryableErrors.includes(error.code));
        }
        return isRetryableError(error);
    }

    private calculateDelay(attempt: number, config: RetryConfig): number {
        const exponentialDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
        const jitter = Math.random() * 0.1 * exponentialDelay;
        return Math.min(exponentialDelay + jitter, config.maxDelay);
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private categorizeError(error: Error): ErrorCode {
        const message = error.message.toLowerCase();

        // Network errors
        if (message.includes('network') || message.includes('econnreset') || message.includes('timeout')) {
            return ErrorCode.NETWORK_ERROR;
        }

        // RPC errors
        if (message.includes('rpc') || message.includes('json-rpc')) {
            return ErrorCode.RPC_ERROR;
        }

        // Contract errors
        if (message.includes('revert') || message.includes('execution reverted')) {
            return parseContractError(error);
        }

        // Gas errors
        if (message.includes('gas') || message.includes('out of gas')) {
            return ErrorCode.GAS_ESTIMATION_FAILED;
        }

        // External service errors
        if (message.includes('axios') || message.includes('fetch') || message.includes('http')) {
            return ErrorCode.EXTERNAL_SERVICE_ERROR;
        }

        return ErrorCode.UNKNOWN_ERROR;
    }

    private determineSeverity(errorCode: ErrorCode, error: Error): ErrorSeverity {
        switch (errorCode) {
            case ErrorCode.DATA_CORRUPTION:
            case ErrorCode.CHECKSUM_MISMATCH:
                return ErrorSeverity.CRITICAL;
            
            case ErrorCode.NETWORK_ERROR:
            case ErrorCode.CONTRACT_CALL_FAILED:
            case ErrorCode.TRANSACTION_FAILED:
                return ErrorSeverity.HIGH;
            
            case ErrorCode.EXTERNAL_SERVICE_ERROR:
            case ErrorCode.GAS_ESTIMATION_FAILED:
            case ErrorCode.UNAUTHORIZED_ACCESS:
                return ErrorSeverity.MEDIUM;
            
            case ErrorCode.RATE_LIMIT_EXCEEDED:
            case ErrorCode.INVALID_PARAMETERS:
                return ErrorSeverity.LOW;
            
            default:
                return ErrorSeverity.MEDIUM;
        }
    }
}