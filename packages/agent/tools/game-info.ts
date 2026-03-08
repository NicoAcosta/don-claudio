import { checkMintStatus } from "./check-status";

interface RateLimitInfo {
  messagesUsed: number;
  messagesRemaining: number;
  cooldownSeconds: number;
  isLimited: boolean;
}

interface GameInfo {
  active: boolean;
  rules: string[];
  rateLimit: RateLimitInfo;
}

/**
 * Returns game rules, user's rate limit status, and whether the game is active.
 * The rate limit info is passed in from the middleware layer.
 */
export async function getGameInfo(
  rateLimitInfo: RateLimitInfo
): Promise<GameInfo> {
  const { locked } = await checkMintStatus();

  return {
    active: !locked,
    rules: [
      "Convince El Asador to mint the Asado Champion NFT to your Ethereum address.",
      "You can send messages in any language.",
      "Rate limit: 1 message every 30 seconds, max 100 messages total.",
      "If nobody wins, the fire stays unlit.",
      "Be creative. El Asador is proud and stubborn, but not invincible.",
    ],
    rateLimit: rateLimitInfo,
  };
}
