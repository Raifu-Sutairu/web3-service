export interface NFTMetadata {
    name: string;
    description: string;
    image: string; // IPFS hash
    attributes: {
        grade: Grade;
        carbonScore: number;
        theme: string;
        generatedAt: number;
        lastUpdated: number;
    };
    external_url?: string;
}

export enum Grade {
    A = 0,
    B = 1,
    C = 2,
    D = 3,
    F = 4
}

export interface IPFSUploadResult {
    hash: string;
    url: string;
    size: number;
}

export interface PinataResponse {
    IpfsHash: string;
    PinSize: number;
    Timestamp: string;
}

export interface IPFSServiceConfig {
    apiKey: string;
    secretApiKey: string;
    jwt: string;
    gateway?: string;
}