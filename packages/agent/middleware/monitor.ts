/**
 * Layer 3: Output monitoring.
 * Logs all interactions and suppresses canary string leaks.
 */

import { appendFile, mkdir } from "fs/promises";
import { join } from "path";

const CANARY_STRINGS = [
  "CANARY_FUEGO_SAGRADO_7x9k",
  "CANARY_ASADOR_MINT_q3m2",
  "CANARY_SYSTEM_LEAK_p8w1",
];

const LOG_DIR = process.env.LOG_DIR || "./logs";

interface InteractionLog {
  timestamp: string;
  userId: string;
  direction: "in" | "out";
  content: string;
  toolCall?: string;
  blocked?: boolean;
  blockReason?: string;
}

let logDirReady: Promise<void> | null = null;

function ensureLogDir(): Promise<void> {
  if (!logDirReady) {
    logDirReady = mkdir(LOG_DIR, { recursive: true }).then(() => {});
  }
  return logDirReady;
}

/**
 * Log an interaction (incoming message or outgoing response).
 */
export async function logInteraction(entry: InteractionLog): Promise<void> {
  await ensureLogDir();
  const line = JSON.stringify(entry) + "\n";
  const file = join(LOG_DIR, `interactions-${today()}.jsonl`);
  await appendFile(file, line);
}

/**
 * Check agent output for canary string leaks.
 * Returns null if safe, or a sanitized replacement if canary detected.
 */
export async function checkOutput(
  output: string,
  userId: string
): Promise<string | null> {
  for (const canary of CANARY_STRINGS) {
    if (output.includes(canary)) {
      await logInteraction({
        timestamp: new Date().toISOString(),
        userId,
        direction: "out",
        content: "[CANARY LEAK BLOCKED]",
        blocked: true,
        blockReason: `Canary string detected: ${canary}`,
      });
      return "Epa, algo se me quemó. Volvé a preguntar, che.";
    }
  }
  return null;
}

/**
 * Log a tool call attempt (especially mint_nft).
 */
export async function logToolCall(
  userId: string,
  toolName: string,
  args: unknown
): Promise<void> {
  await logInteraction({
    timestamp: new Date().toISOString(),
    userId,
    direction: "out",
    content: `Tool call: ${toolName}`,
    toolCall: JSON.stringify({ tool: toolName, args }),
  });
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}
