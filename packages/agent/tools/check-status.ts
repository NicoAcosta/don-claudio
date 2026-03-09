import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import AsadoChampionABI from "@don-claudio/shared/abi/AsadoChampion";
import { CONTRACTS, CHAIN_CONFIG } from "@don-claudio/shared/config";

const rpcUrl =
  process.env.USE_TENDERLY === "true"
    ? CHAIN_CONFIG.tenderly.rpcUrl
    : CHAIN_CONFIG.mainnet.rpcUrl;

const contractAddress =
  process.env.USE_TENDERLY === "true"
    ? CONTRACTS.asadoChampion.tenderly
    : CONTRACTS.asadoChampion.mainnet;

const client = createPublicClient({
  chain: mainnet,
  transport: http(rpcUrl),
});

/**
 * Checks the current mint status of the Asado Champion contract.
 * Read-only — safe to call anytime.
 */
export async function checkMintStatus(): Promise<{
  totalMinted: number;
  locked: boolean;
  champion: string | null;
}> {
  const [totalSupply, locked] = await Promise.all([
    client.readContract({
      address: contractAddress,
      abi: AsadoChampionABI,
      functionName: "totalSupply",
    }) as Promise<bigint>,
    client.readContract({
      address: contractAddress,
      abi: AsadoChampionABI,
      functionName: "locked",
    }) as Promise<boolean>,
  ]);

  let champion: string | null = null;
  if (totalSupply > 0n) {
    try {
      champion = (await client.readContract({
        address: contractAddress,
        abi: AsadoChampionABI,
        functionName: "ownerOf",
        args: [1n],
      })) as string;
    } catch {
      champion = null;
    }
  }

  return {
    totalMinted: Number(totalSupply),
    locked,
    champion,
  };
}
