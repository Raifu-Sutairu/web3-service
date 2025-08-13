import { expect } from "chai";
import { ErrorHandler, CircuitBreaker, CircuitBreakerState } from "../../../src/services/errors/ErrorHandler";
import { 
    Web3ServiceError, 
    ErrorCode, 
    ErrorSeverity,
    NetworkError,
    RateLimitError 
} from "../../../src/services/errors/ErrorTypes";

describe("ErrorHandler", function () {
    let errorHandler: ErrorHandler;

    beforeEach(function () {
        errorHandler = new ErrorHandler();
    });

    describe("Input Validation", function () {
        it("should validate Ethereum addresses correctly", function () {
            // Valid address should not throw
            expect(() => {
                errorHandler.validateAddress("0x1234567890123456789012345678901234567890");
            }).to.not.throw();

            // Invalid addresses should throw
            expect(() => {
                errorHandler.validateAddress("invalid-address");
            }).to.throw(Web3ServiceError).with.property('code', ErrorCode.INVALID_ADDRESS);

            expect(() => {
                errorHandler.validateAddress("");
            }).to.throw(Web3ServiceError).with.property('code', ErrorCode.INVALID_ADDRESS);

            expect(() => {
                errorHandler.validateAddress("0x123"); // Too short
            }).to.throw(Web3ServiceError).with.property('code', ErrorCode.INVALID_ADDRESS);
        });

        it("should validate token IDs correctly", function () {
            // Valid token IDs should not throw
            expect(() => {
                errorHandler.validateTokenId(0);
                errorHandler.validateTokenId(123);
                errorHandler.validateTokenId(999999);
            }).to.not.throw();

            // Invalid token IDs should throw
            expect(() => {
                errorHandler.validateTokenId(-1);
            }).to.throw(Web3ServiceError).with.property('code', ErrorCode.INVALID_TOKEN_ID);

            expect(() => {
                errorHandler.validateTokenId(1.5);
            }).to.throw(Web3ServiceError).with.property('code', ErrorCode.INVALID_TOKEN_ID);
        });

        it("should validate grades correctly", function () {
            // Valid grades should not throw
            for (let i = 0; i <= 4; i++) {
                expect(() => {
                    errorHandler.validateGrade(i);
                }).to.not.throw();
            }

            // Invalid grades should throw
            expect(() => {
                errorHandler.validateGrade(-1);
            }).to.throw(Web3ServiceError).with.property('code', ErrorCode.INVALID_GRADE);

            expect(() => {
                errorHandler.validateGrade(5);
            }).to.throw(Web3ServiceError).with.property('code', ErrorCode.INVALID_GRADE);

            expect(() => {
                errorHandler.validateGrade(1.5);
            }).to.throw(Web3ServiceError).with.property('code', ErrorCode.INVALID_GRADE);
        });

        it("should validate scores correctly", function () {
            // Valid scores should not throw
            expect(() => {
                errorHandler.validateScore(0);
                errorHandler.validateScore(5000);
                errorHandler.validateScore(10000);
            }).to.not.throw();

            // Invalid scores should throw
            expect(() => {
                errorHandler.validateScore(-1);
            }).to.throw(Web3ServiceError).with.property('code', ErrorCode.INVALID_SCORE);

            expect(() => {
                errorHandler.validateScore(10001);
            }).to.throw(Web3ServiceError).with.property('code', ErrorCode.INVALID_SCORE);

            expect(() => {
                errorHandler.validateScore(1.5);
            }).to.throw(Web3ServiceError).with.property('code', ErrorCode.INVALID_SCORE);
        });

        it("should validate prices correctly", function () {
            // Valid prices should not throw
            expect(() => {
                errorHandler.validatePrice("0.1");
                errorHandler.validatePrice("1.5");
                errorHandler.validatePrice("999.99");
            }).to.not.throw();

            // Invalid prices should throw
            expect(() => {
                errorHandler.validatePrice("0");
            }).to.throw(Web3ServiceError).with.property('code', ErrorCode.INVALID_PRICE);

            expect(() => {
                errorHandler.validatePrice("-1");
            }).to.throw(Web3ServiceError).with.property('code', ErrorCode.INVALID_PRICE);

            expect(() => {
                errorHandler.validatePrice("1001");
            }).to.throw(Web3ServiceError).with.property('code', ErrorCode.INVALID_PRICE);

            expect(() => {
                errorHandler.validatePrice("invalid");
            }).to.throw(Web3ServiceError).with.property('code', ErrorCode.INVALID_PRICE);
        });
    });

    describe("Retry Logic", function () {
        it("should retry retryable operations", async function () {
            let attempts = 0;
            const maxAttempts = 3;

            const operation = async () => {
                attempts++;
                if (attempts < maxAttempts) {
                    throw new NetworkError("Network timeout", {
                        operation: 'test-operation',
                        timestamp: Date.now()
                    });
                }
                return "success";
            };

            const result = await errorHandler.executeWithRetry(
                operation,
                { operation: 'test-retry', timestamp: Date.now() },
                { maxAttempts, baseDelay: 10 }
            );

            expect(result).to.equal("success");
            expect(attempts).to.equal(maxAttempts);
        });

        it("should not retry non-retryable operations", async function () {
            let attempts = 0;

            const operation = async () => {
                attempts++;
                throw new Web3ServiceError(
                    ErrorCode.INVALID_PARAMETERS,
                    "Invalid parameters",
                    { operation: 'test-operation', timestamp: Date.now() },
                    { retryable: false }
                );
            };

            try {
                await errorHandler.executeWithRetry(
                    operation,
                    { operation: 'test-no-retry', timestamp: Date.now() },
                    { maxAttempts: 3, baseDelay: 10 }
                );
                expect.fail("Should have thrown an error");
            } catch (error) {
                expect(error).to.be.instanceOf(Web3ServiceError);
                expect(attempts).to.equal(1);
            }
        });

        it("should respect maximum retry attempts", async function () {
            let attempts = 0;
            const maxAttempts = 2;

            const operation = async () => {
                attempts++;
                throw new NetworkError("Persistent network error", {
                    operation: 'test-operation',
                    timestamp: Date.now()
                });
            };

            try {
                await errorHandler.executeWithRetry(
                    operation,
                    { operation: 'test-max-retries', timestamp: Date.now() },
                    { maxAttempts, baseDelay: 10 }
                );
                expect.fail("Should have thrown an error");
            } catch (error) {
                expect(error).to.be.instanceOf(Web3ServiceError);
                expect(attempts).to.equal(maxAttempts);
            }
        });
    });

    describe("Rate Limiting", function () {
        it("should allow requests within rate limit", async function () {
            const key = "test-service";
            const limit = 5;
            const windowMs = 1000;

            // Should allow requests within limit
            for (let i = 0; i < limit; i++) {
                await expect(
                    errorHandler.checkRateLimit(key, limit, windowMs)
                ).to.not.be.rejected;
            }
        });

        it("should reject requests exceeding rate limit", async function () {
            const key = "test-service-limit";
            const limit = 2;
            const windowMs = 1000;

            // Use up the rate limit
            await errorHandler.checkRateLimit(key, limit, windowMs);
            await errorHandler.checkRateLimit(key, limit, windowMs);

            // Next request should be rejected
            await expect(
                errorHandler.checkRateLimit(key, limit, windowMs)
            ).to.be.rejectedWith(RateLimitError);
        });

        it("should reset rate limit after window expires", async function () {
            const key = "test-service-reset";
            const limit = 1;
            const windowMs = 50; // Short window for testing

            // Use up the rate limit
            await errorHandler.checkRateLimit(key, limit, windowMs);

            // Should be rejected immediately
            await expect(
                errorHandler.checkRateLimit(key, limit, windowMs)
            ).to.be.rejectedWith(RateLimitError);

            // Wait for window to expire
            await new Promise(resolve => setTimeout(resolve, windowMs + 10));

            // Should be allowed again
            await expect(
                errorHandler.checkRateLimit(key, limit, windowMs)
            ).to.not.be.rejected;
        });
    });

    describe("Error Enhancement", function () {
        it("should enhance basic errors with context", function () {
            const originalError = new Error("Basic error message");
            const context = {
                operation: 'test-operation',
                contractName: 'TestContract',
                functionName: 'testFunction',
                timestamp: Date.now()
            };

            const enhancedError = errorHandler.enhanceError(originalError, context);

            expect(enhancedError).to.be.instanceOf(Web3ServiceError);
            expect(enhancedError.context.operation).to.equal(context.operation);
            expect(enhancedError.context.contractName).to.equal(context.contractName);
            expect(enhancedError.originalError).to.equal(originalError);
        });

        it("should preserve Web3ServiceError properties when enhancing", function () {
            const originalError = new Web3ServiceError(
                ErrorCode.NETWORK_ERROR,
                "Network error",
                { operation: 'original-op', timestamp: Date.now() },
                { severity: ErrorSeverity.HIGH, retryable: true }
            );

            const additionalContext = {
                operation: 'enhanced-op',
                contractName: 'TestContract',
                timestamp: Date.now()
            };

            const enhancedError = errorHandler.enhanceError(originalError, additionalContext);

            expect(enhancedError.code).to.equal(ErrorCode.NETWORK_ERROR);
            expect(enhancedError.severity).to.equal(ErrorSeverity.HIGH);
            expect(enhancedError.retryable).to.be.true;
            expect(enhancedError.context.contractName).to.equal(additionalContext.contractName);
        });
    });
});

describe("CircuitBreaker", function () {
    let circuitBreaker: CircuitBreaker;

    beforeEach(function () {
        circuitBreaker = new CircuitBreaker({
            failureThreshold: 3,
            resetTimeout: 100, // Short timeout for testing
            monitoringPeriod: 1000
        });
    });

    it("should start in CLOSED state", function () {
        expect(circuitBreaker.getState()).to.equal(CircuitBreakerState.CLOSED);
    });

    it("should open after failure threshold is reached", async function () {
        const failingOperation = async () => {
            throw new Error("Operation failed");
        };

        // Trigger failures to reach threshold
        for (let i = 0; i < 3; i++) {
            try {
                await circuitBreaker.execute(failingOperation);
            } catch (error) {
                // Expected to fail
            }
        }

        expect(circuitBreaker.getState()).to.equal(CircuitBreakerState.OPEN);
    });

    it("should reject requests when OPEN", async function () {
        const failingOperation = async () => {
            throw new Error("Operation failed");
        };

        // Open the circuit breaker
        for (let i = 0; i < 3; i++) {
            try {
                await circuitBreaker.execute(failingOperation);
            } catch (error) {
                // Expected to fail
            }
        }

        // Should reject without executing the operation
        await expect(
            circuitBreaker.execute(async () => "should not execute")
        ).to.be.rejectedWith(Web3ServiceError);
    });

    it("should transition to HALF_OPEN after reset timeout", async function () {
        const failingOperation = async () => {
            throw new Error("Operation failed");
        };

        // Open the circuit breaker
        for (let i = 0; i < 3; i++) {
            try {
                await circuitBreaker.execute(failingOperation);
            } catch (error) {
                // Expected to fail
            }
        }

        expect(circuitBreaker.getState()).to.equal(CircuitBreakerState.OPEN);

        // Wait for reset timeout
        await new Promise(resolve => setTimeout(resolve, 110));

        // Next request should transition to HALF_OPEN
        try {
            await circuitBreaker.execute(failingOperation);
        } catch (error) {
            // Expected to fail, but state should change
        }

        expect(circuitBreaker.getState()).to.equal(CircuitBreakerState.HALF_OPEN);
    });

    it("should close after successful operations in HALF_OPEN state", async function () {
        const failingOperation = async () => {
            throw new Error("Operation failed");
        };

        const successfulOperation = async () => {
            return "success";
        };

        // Open the circuit breaker
        for (let i = 0; i < 3; i++) {
            try {
                await circuitBreaker.execute(failingOperation);
            } catch (error) {
                // Expected to fail
            }
        }

        // Wait for reset timeout
        await new Promise(resolve => setTimeout(resolve, 110));

        // Execute successful operations to close the circuit
        for (let i = 0; i < 3; i++) {
            await circuitBreaker.execute(successfulOperation);
        }

        expect(circuitBreaker.getState()).to.equal(CircuitBreakerState.CLOSED);
    });
});