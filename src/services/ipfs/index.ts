import { IPFSService } from './IPFSService';
import ENV from '../../config/env.config';

// Create and export IPFS service instance
export const ipfsService = new IPFSService({
    apiKey: ENV.PINATA_API_KEY,
    secretApiKey: ENV.PINATA_SECRET_API_KEY,
    jwt: ENV.PINATA_JWT,
    gateway: 'https://gateway.pinata.cloud/ipfs'
});

export * from './IPFSService';
export * from './types';