// Export all services
export * from './blockchain';
export * from './ipfs';
export * from './external';
export * from './validation';

// Service instances for easy import
export { ipfsService } from './ipfs';
export { geminiService, mlService } from './external';
export { dataValidator } from './validation';