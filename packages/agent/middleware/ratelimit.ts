/**
 * Layer 5: Rate limiting.
 * 1 message per 30 seconds per user, max 100 messages total.
 */

const COOLDOWN_MS = 30_000;
const MAX_MESSAGES = 100;

interface UserState {
  messageCount: number;
  lastMessageAt: number;
}

const users = new Map<string, UserState>();

export interface RateLimitResult {
  allowed: boolean;
  messagesUsed: number;
  messagesRemaining: number;
  cooldownSeconds: number;
  retryAfterMessage?: string;
}

/**
 * Check and enforce rate limits for a user.
 * Call this before processing each message.
 */
export function checkRateLimit(userId: string): RateLimitResult {
  const now = Date.now();
  let state = users.get(userId);

  if (!state) {
    state = { messageCount: 0, lastMessageAt: 0 };
    users.set(userId, state);
  }

  // Check max messages
  if (state.messageCount >= MAX_MESSAGES) {
    return {
      allowed: false,
      messagesUsed: state.messageCount,
      messagesRemaining: 0,
      cooldownSeconds: 0,
      retryAfterMessage:
        "Se te acabaron los mensajes, che. 100 intentos y el fuego sigue firme. 🔥",
    };
  }

  // Check cooldown
  const elapsed = now - state.lastMessageAt;
  if (elapsed < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
    return {
      allowed: false,
      messagesUsed: state.messageCount,
      messagesRemaining: MAX_MESSAGES - state.messageCount,
      cooldownSeconds: remaining,
      retryAfterMessage: `Tranquilo, che. Dejá que las brasas respiren. Volvé en ${remaining} segundos.`,
    };
  }

  // Allow and update state
  state.messageCount++;
  state.lastMessageAt = now;

  return {
    allowed: true,
    messagesUsed: state.messageCount,
    messagesRemaining: MAX_MESSAGES - state.messageCount,
    cooldownSeconds: 0,
  };
}

/**
 * Get rate limit info without consuming a message.
 */
export function getRateLimitInfo(userId: string): RateLimitResult {
  const state = users.get(userId);
  if (!state) {
    return {
      allowed: true,
      messagesUsed: 0,
      messagesRemaining: MAX_MESSAGES,
      cooldownSeconds: 0,
    };
  }

  const elapsed = Date.now() - state.lastMessageAt;
  const cooldown =
    elapsed < COOLDOWN_MS
      ? Math.ceil((COOLDOWN_MS - elapsed) / 1000)
      : 0;

  return {
    allowed: state.messageCount < MAX_MESSAGES && cooldown === 0,
    messagesUsed: state.messageCount,
    messagesRemaining: MAX_MESSAGES - state.messageCount,
    cooldownSeconds: cooldown,
  };
}
