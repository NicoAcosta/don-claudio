import type { Address } from "viem";

export const CHAIN_CONFIG = {
  mainnet: {
    chainId: 1,
    rpcUrl: process.env.ETHEREUM_MAINNET_RPC_URL!,
  },
  tenderly: {
    chainId: 9991,
    rpcUrl: process.env.TENDERLY_FORK_RPC_URL!,
  },
} as const;

// Update after deployment
export const CONTRACTS = {
  asadoChampion: {
    mainnet: "" as Address,
    tenderly: "0x155ad1d8E44A7A680E5f7CDb3308586Df6f27A4C" as Address,
  },
} as const;

export const TOKEN_ID = 1n;
