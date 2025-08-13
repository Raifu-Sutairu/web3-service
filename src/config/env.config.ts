import { config } from "dotenv";
import path from "path";

config({
    path: path.resolve(
        process.cwd(),
        `.env`
    )
});

const ENV = {
    PORT: Number(process.env.PORT) || 3001,
    NODE_ENV: process.env.NODE_ENV || 'development',

    //Blockchain
    PRIVATE_KEY: process.env.PRIVATE_KEY || '',
    RPC_URL: process.env.RPC_URL || '',
    ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY || '',

    //Pinata
    PINATA_API_KEY: process.env.PINATA_API_KEY || '',
    PINATA_SECRET_API_KEY: process.env.PINATA_SECRET_API_KEY || '',
    PINATA_JWT: process.env.PINATA_JWT || '',

    //External Services (using localhost placeholders)
    AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://localhost:3002/api/ai',
    ML_SERVICE_URL: process.env.ML_SERVICE_URL || 'http://localhost:3003/api/ml',
    CARBON_CALCULATOR_URL: process.env.CARBON_CALCULATOR_URL || 'http://localhost:3004/api/carbon',

    //Contract Addresses (after deployment)
    CARBON_NFT_ADDRESS: process.env.CARBON_NFT_ADDRESS || '',
    COMMUNITY_ADDRESS: process.env.COMMUNITY_ADDRESS || '',
    MARKETPLACE_ADDRESS: process.env.MARKETPLACE_ADDRESS || ''
};

export default ENV;
