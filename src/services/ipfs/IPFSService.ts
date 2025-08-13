import axios from 'axios';
import FormData from 'form-data';
import { NFTMetadata, IPFSUploadResult, PinataResponse, IPFSServiceConfig } from './types';

export interface IIPFSService {
    uploadMetadata(metadata: NFTMetadata): Promise<IPFSUploadResult>;
    uploadImage(imageBuffer: Buffer, filename?: string): Promise<IPFSUploadResult>;
    retrieveContent(hash: string): Promise<Buffer>;
    pinContent(hash: string): Promise<boolean>;
    unpinContent(hash: string): Promise<boolean>;
}

export class IPFSService implements IIPFSService {
    private readonly config: IPFSServiceConfig;
    private readonly baseUrl = 'https://api.pinata.cloud';
    private readonly gateway: string;

    constructor(config: IPFSServiceConfig) {
        this.config = config;
        this.gateway = config.gateway || 'https://gateway.pinata.cloud/ipfs';
    }

    /**
     * Upload NFT metadata to IPFS via Pinata
     */
    async uploadMetadata(metadata: NFTMetadata): Promise<IPFSUploadResult> {
        try {
            const data = {
                pinataContent: metadata,
                pinataMetadata: {
                    name: `metadata-${metadata.name}`,
                    keyvalues: {
                        grade: metadata.attributes.grade.toString(),
                        theme: metadata.attributes.theme,
                        type: 'metadata'
                    }
                }
            };

            const response = await axios.post(
                `${this.baseUrl}/pinning/pinJSONToIPFS`,
                data,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.config.jwt}`
                    }
                }
            );

            const result: PinataResponse = response.data;
            
            return {
                hash: result.IpfsHash,
                url: `${this.gateway}/${result.IpfsHash}`,
                size: result.PinSize
            };
        } catch (error) {
            console.error('Error uploading metadata to IPFS:', error);
            throw new Error(`Failed to upload metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Upload image buffer to IPFS via Pinata
     */
    async uploadImage(imageBuffer: Buffer, filename = 'image.png'): Promise<IPFSUploadResult> {
        try {
            const formData = new FormData();
            formData.append('file', imageBuffer, filename);
            
            const metadata = {
                name: filename,
                keyvalues: {
                    type: 'image',
                    uploadedAt: new Date().toISOString()
                }
            };
            formData.append('pinataMetadata', JSON.stringify(metadata));

            const response = await axios.post(
                `${this.baseUrl}/pinning/pinFileToIPFS`,
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        'Authorization': `Bearer ${this.config.jwt}`
                    }
                }
            );

            const result: PinataResponse = response.data;
            
            return {
                hash: result.IpfsHash,
                url: `${this.gateway}/${result.IpfsHash}`,
                size: result.PinSize
            };
        } catch (error) {
            console.error('Error uploading image to IPFS:', error);
            throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Retrieve content from IPFS by hash
     */
    async retrieveContent(hash: string): Promise<Buffer> {
        try {
            const response = await axios.get(`${this.gateway}/${hash}`, {
                responseType: 'arraybuffer',
                timeout: 30000 // 30 second timeout
            });

            return Buffer.from(response.data);
        } catch (error) {
            console.error('Error retrieving content from IPFS:', error);
            throw new Error(`Failed to retrieve content: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Pin existing content by hash
     */
    async pinContent(hash: string): Promise<boolean> {
        try {
            const data = {
                hashToPin: hash,
                pinataMetadata: {
                    name: `pinned-${hash}`,
                    keyvalues: {
                        pinnedAt: new Date().toISOString()
                    }
                }
            };

            await axios.post(
                `${this.baseUrl}/pinning/pinByHash`,
                data,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.config.jwt}`
                    }
                }
            );

            return true;
        } catch (error) {
            console.error('Error pinning content:', error);
            return false;
        }
    }

    /**
     * Unpin content by hash
     */
    async unpinContent(hash: string): Promise<boolean> {
        try {
            await axios.delete(`${this.baseUrl}/pinning/unpin/${hash}`, {
                headers: {
                    'Authorization': `Bearer ${this.config.jwt}`
                }
            });

            return true;
        } catch (error) {
            console.error('Error unpinning content:', error);
            return false;
        }
    }

    /**
     * Get pinned content list
     */
    async getPinnedContent(limit = 10, offset = 0): Promise<any[]> {
        try {
            const response = await axios.get(`${this.baseUrl}/data/pinList`, {
                params: {
                    pageLimit: limit,
                    pageOffset: offset
                },
                headers: {
                    'Authorization': `Bearer ${this.config.jwt}`
                }
            });

            return response.data.rows || [];
        } catch (error) {
            console.error('Error getting pinned content:', error);
            throw new Error(`Failed to get pinned content: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}