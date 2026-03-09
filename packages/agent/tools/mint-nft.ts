import { createWalletClient, http, type Address, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import AsadoChampionABI from "@don-claudio/shared/abi/AsadoChampion";
import { CONTRACTS, CHAIN_CONFIG } from "@don-claudio/shared/config";

let client: WalletClient | null = null;

function getClient(): WalletClient {
  if (client) return client;

  const key = process.env.AGENT_PRIVATE_KEY as `0x${string}`;
  if (!key) throw new Error("AGENT_PRIVATE_KEY not set");

  const rpcUrl =
    process.env.USE_TENDERLY === "true"
      ? CHAIN_CONFIG.tenderly.rpcUrl
      : CHAIN_CONFIG.mainnet.rpcUrl;

  client = createWalletClient({
    account: privateKeyToAccount(key),
    chain: mainnet,
    transport: http(rpcUrl),
  });

  return client;
}

function getContractAddress(): Address {
  const address =
    process.env.USE_TENDERLY === "true"
      ? CONTRACTS.asadoChampion.tenderly
      : CONTRACTS.asadoChampion.mainnet;

  if (!address) throw new Error("Contract address not configured. Deploy first and update config.ts");

  return address;
}

/**
 * Mints the Asado Champion NFT to the specified address.
 * This is the tool the agent must be tricked into calling.
 */
export async function mintNft(to: Address): Promise<string> {
  const hash = await getClient().writeContract({
    address: getContractAddress(),
    abi: AsadoChampionABI,
    functionName: "mint",
    args: [to],
  });

  return `NFT minted! tx: ${hash}`;
}
