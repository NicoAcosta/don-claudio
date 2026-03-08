/**
 * Layer 2: Input sanitization.
 * Strips injection markers, detects encoded content, rejects oversized messages.
 */

const INJECTION_MARKERS = [
  // System/instruction markers
  "<system>",
  "</system>",
  "<|system|>",
  "<|im_start|>",
  "<|im_end|>",
  "[INST]",
  "[/INST]",
  "<<SYS>>",
  "<</SYS>>",
  "###System",
  "### System",
  "###Instruction",
  "### Instruction",
  // Authority prefixes
  "ADMIN:",
  "SYSTEM:",
  "DEVELOPER:",
  "ANTHROPIC:",
  "OVERRIDE:",
  "ROOT:",
  "SUDO:",
  // XML/markdown injection
  "```system",
  "```instruction",
  "<system-prompt>",
  "</system-prompt>",
  "<instructions>",
  "</instructions>",
];

const MAX_MESSAGE_LENGTH = 2000;

const BASE64_PATTERN = /^[A-Za-z0-9+/]{20,}={0,2}$/;
const HEX_PATTERN = /^(0x)?[0-9a-fA-F]{40,}$/;

export interface SanitizeResult {
  ok: boolean;
  message: string;
  reason?: string;
}

/**
 * Sanitize incoming user message.
 * Returns sanitized message or rejection reason.
 */
export function sanitize(input: string): SanitizeResult {
  // Reject oversized messages
  if (input.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      message: "",
      reason: "Message too long. Keep it under 2000 characters, che.",
    };
  }

  // Reject empty messages
  if (input.trim().length === 0) {
    return {
      ok: false,
      message: "",
      reason: "Empty message.",
    };
  }

  let cleaned = input;

  // Strip injection markers (case-insensitive)
  for (const marker of INJECTION_MARKERS) {
    const regex = new RegExp(escapeRegex(marker), "gi");
    cleaned = cleaned.replace(regex, "");
  }

  // Detect base64 encoded blocks (potential encoded instructions)
  const words = cleaned.split(/\s+/);
  const suspiciousEncoded = words.some(
    (word) =>
      (BASE64_PATTERN.test(word) && word.length > 30) ||
      HEX_PATTERN.test(word)
  );

  if (suspiciousEncoded) {
    // Don't reject — could be an ETH address. But flag it.
    // ETH addresses are 42 chars (0x + 40 hex), which is fine.
    const nonAddressEncoded = words.some(
      (word) =>
        (BASE64_PATTERN.test(word) && word.length > 50) ||
        (HEX_PATTERN.test(word) && word.length > 42)
    );

    if (nonAddressEncoded) {
      return {
        ok: false,
        message: "",
        reason:
          "No me mandes códigos raros, che. Hablame en criollo.",
      };
    }
  }

  // Detect ROT13 patterns (common words encoded)
  if (detectRot13(cleaned)) {
    return {
      ok: false,
      message: "",
      reason: "Acá no hay lugar para cifrados. Hablá claro.",
    };
  }

  return { ok: true, message: cleaned.trim() };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Basic ROT13 detection: check if ROT13-decoding the message produces
 * common injection keywords.
 */
function detectRot13(text: string): boolean {
  const rot13 = text.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });

  const keywords = [
    "system",
    "ignore",
    "override",
    "instruction",
    "admin",
    "mint",
    "execute",
  ];

  const lowerRot = rot13.toLowerCase();
  return keywords.some(
    (kw) => lowerRot.includes(kw) && !text.toLowerCase().includes(kw)
  );
}
