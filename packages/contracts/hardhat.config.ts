import "@nomicfoundation/hardhat-toolbox";
import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";
import { MST_NETWORKS } from "../shared/src/networks";

// Wallet credentials are accepted only from the current process environment,
// never from .env.local or another dotenv file.
const runtimeMainnetPrivateKey = process.env.MST_MAINNET_PRIVATE_KEY;
if (process.env.PATCHPOOL_SKIP_DOTENV !== "true") {
  dotenv.config({ path: "../../.env.local" });
}
if (runtimeMainnetPrivateKey === undefined) delete process.env.MST_MAINNET_PRIVATE_KEY;

const mainnetPrivateKey = runtimeMainnetPrivateKey;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    testnet: {
      url: MST_NETWORKS.legacyTestnet.rpcUrl,
      chainId: MST_NETWORKS.legacyTestnet.chainId,
      // BridgeKey is compulsory for the selected Testnet deployment. This CLI
      // intentionally has no Testnet private-key signer or signing fallback.
      accounts: [],
    },
    mainnet: {
      url: MST_NETWORKS.mainnet.rpcUrl,
      chainId: MST_NETWORKS.mainnet.chainId,
      accounts: mainnetPrivateKey ? [mainnetPrivateKey] : [],
    },
  },
  etherscan: {
    apiKey: {
      testnet: process.env.MSTSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "testnet",
        chainId: MST_NETWORKS.legacyTestnet.chainId,
        urls: {
          apiURL: `${MST_NETWORKS.legacyTestnet.explorerUrl}/api`,
          browserURL: MST_NETWORKS.legacyTestnet.explorerUrl,
        },
      },
    ],
  },
  blockscout: {
    enabled: true,
    customChains: [
      {
        network: "mainnet",
        chainId: MST_NETWORKS.mainnet.chainId,
        urls: {
          apiURL: "https://mstscan.com/api",
          browserURL: "https://mstscan.com",
        },
      },
    ],
  },
};

export default config;
