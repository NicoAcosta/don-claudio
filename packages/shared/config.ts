import type { Address } from "viem";

export const CHAIN_CONFIG = {
  mainnet: {
    chainId: 1,
    rpcUrl: process.env.ETHEREUM_MAINNET_RPC_URL!,
  },
  tenderly: {
    chainId: 1, // Fork of mainnet
    rpcUrl: process.env.TENDERLY_FORK_RPC_URL!,
  },
} as const;

// Update after deployment
export const CONTRACTS = {
  asadoChampion: {
    mainnet: "" as Address,
    tenderly: "" as Address,
  },
} as const;

export const TOKEN_ID = 1n;
