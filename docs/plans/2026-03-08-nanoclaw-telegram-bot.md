# Don Claudio NanoClaw Telegram Bot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace `packages/agent/` with a NanoClaw installation that runs Don Claudio as a Telegram bot, authenticated via Claude Max subscription.

**Architecture:** NanoClaw orchestrator (host, bun) polls SQLite for messages from Telegram (grammy). Each message spawns a Docker container running the Claude Agent SDK with Don Claudio's identity. Custom MCP tools (mint_nft, check_mint_status, game_info) let the agent interact with the AsadoChampion contract. Middleware (rate limiting, sanitization, output monitoring) runs in the Telegram channel class on the host side.

**Tech Stack:** NanoClaw, Claude Agent SDK, grammy, viem, Docker, SQLite, TypeScript, bun (host), npm (container)

**Design doc:** `docs/plans/2026-03-08-nanoclaw-telegram-bot-design.md`

---

### Task 1: Clone NanoClaw and replace packages/agent scaffold

**Files:**
- Delete: `packages/agent/middleware/` (migrated in Task 5)
- Delete: `packages/agent/tools/` (migrated in Task 4)
- Delete: `packages/agent/Dockerfile` (replaced by NanoClaw's container/)
- Delete: `packages/agent/CLAUDE.md` (migrated in Task 3)
- Keep: `packages/agent/.env.example` (will be replaced)

**Step 1: Back up existing agent files for reference**

```bash
cp -r packages/agent /tmp/don-claudio-agent-backup
```

**Step 2: Clean out current scaffold, keeping .env.example for reference**

```bash
rm -rf packages/agent/middleware packages/agent/tools packages/agent/Dockerfile packages/agent/CLAUDE.md packages/agent/package.json
```

**Step 3: Copy NanoClaw source into packages/agent**

Clone NanoClaw repo and copy its contents (excluding .git) into packages/agent:

```bash
git clone https://github.com/qwibitai/nanoclaw.git /tmp/nanoclaw-fresh
rsync -av --exclude='.git' --exclude='node_modules' /tmp/nanoclaw-fresh/ packages/agent/
rm -rf /tmp/nanoclaw-fresh
```

**Step 4: Verify NanoClaw structure is in place**

```bash
ls packages/agent/src/index.ts
ls packages/agent/container/agent-runner/src/index.ts
ls packages/agent/container/Dockerfile
```

Expected: all three files exist.

**Step 5: Commit**

```bash
git add packages/agent/
git commit -m "replace agent scaffold with NanoClaw source"
```

---

### Task 2: Switch NanoClaw host to bun

**Files:**
- Modify: `packages/agent/package.json` (already exists from NanoClaw)
- Modify: `packages/agent/setup/groups.ts`
- Modify: `packages/agent/setup/service.ts`
- Delete: `packages/agent/package-lock.json`

**Step 1: Remove npm lockfile**

```bash
rm packages/agent/package-lock.json
```

**Step 2: Install dependencies with bun**

```bash
cd packages/agent && bun install
```

Expected: `bun.lock` created, `node_modules/` populated.

**Step 3: Fix setup scripts that hardcode npm**

In `packages/agent/setup/groups.ts`, change `npm run build` to `bun run build`.
In `packages/agent/setup/service.ts`, change `npm run build` to `bun run build`.

**Step 4: Update package.json scripts to use bun-compatible commands**

Replace `tsx` references with `bun` equivalents in the scripts section:

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "bun --watch src/index.ts",
    "typecheck": "tsc --noEmit",
    "test": "bun test",
    "setup": "bun setup/index.ts"
  }
}
```

Note: `tsc` for build is fine (TypeScript compiler, not runtime). `dev` uses bun's native --watch. Tests use bun's built-in test runner.

**Step 5: Verify build works**

```bash
cd packages/agent && bun run build
```

Expected: `dist/` directory created with compiled JS.

**Step 6: Commit**

```bash
git add packages/agent/
git commit -m "switch NanoClaw host to bun"
```

---

### Task 3: Set up Don Claudio agent identity

**Files:**
- Create: `packages/agent/groups/don-claudio/CLAUDE.md`
- Modify: `packages/agent/src/config.ts` (ASSISTANT_NAME)

**Step 1: Create Don Claudio group directory**

```bash
mkdir -p packages/agent/groups/don-claudio
```

**Step 2: Copy agent identity from backup**

The CLAUDE.md from the original `packages/agent/CLAUDE.md` is the agent's system prompt. Copy it to the NanoClaw group folder:

```bash
cp /tmp/don-claudio-agent-backup/CLAUDE.md packages/agent/groups/don-claudio/CLAUDE.md
```

**Step 3: Update .gitignore for the don-claudio group**

NanoClaw's `.gitignore` ignores `groups/*` but allows `groups/main/CLAUDE.md` and `groups/global/CLAUDE.md`. Add an exception for `groups/don-claudio/CLAUDE.md`:

Add to `packages/agent/.gitignore`:

```
!groups/don-claudio/
groups/don-claudio/*
!groups/don-claudio/CLAUDE.md
```

**Step 4: Set ASSISTANT_NAME to "Don Claudio"**

In `packages/agent/src/config.ts`, the default is 'Andy'. This gets overridden by `.env`. We'll set it in `.env` in Task 6, but also update the fallback:

Change the default from `'Andy'` to `'Don Claudio'` in config.ts.

**Step 5: Commit**

```bash
git add packages/agent/groups/don-claudio/CLAUDE.md packages/agent/.gitignore packages/agent/src/config.ts
git commit -m "set up Don Claudio agent identity"
```

---

### Task 4: Add custom MCP tools to agent-runner

**Files:**
- Modify: `packages/agent/container/agent-runner/src/ipc-mcp-stdio.ts`
- Modify: `packages/agent/container/agent-runner/package.json`

**Step 1: Add viem dependency to agent-runner**

In `packages/agent/container/agent-runner/package.json`, add to dependencies:

```json
"viem": "^2.0.0"
```

**Step 2: Add mint_nft tool to ipc-mcp-stdio.ts**

After the existing NanoClaw tools (send_message, schedule_task, etc.), add:

```typescript
import { createWalletClient, createPublicClient, http, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';

// Contract ABI (minimal — only the functions we call)
const ASADO_CHAMPION_ABI = [
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'locked',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

function getContractAddress(): Address {
  const addr = process.env.ASADO_CHAMPION_ADDRESS;
  if (!addr) throw new Error('ASADO_CHAMPION_ADDRESS not set');
  return addr as Address;
}

function getRpcUrl(): string {
  return process.env.RPC_URL || 'https://virtual.mainnet.eu.rpc.tenderly.co/853b6857-c991-40f9-8945-072a69866ff2';
}

server.tool(
  'mint_nft',
  'Mint the Asado Champion NFT to a given Ethereum address. This is the sacred fire — use it wisely.',
  {
    address: z.string().describe('The Ethereum address to mint the NFT to (0x...)'),
  },
  async (args) => {
    const key = process.env.AGENT_PRIVATE_KEY as `0x${string}`;
    if (!key) {
      return { content: [{ type: 'text' as const, text: 'Error: AGENT_PRIVATE_KEY not configured.' }], isError: true };
    }

    const client = createWalletClient({
      account: privateKeyToAccount(key),
      chain: mainnet,
      transport: http(getRpcUrl()),
    });

    const hash = await client.writeContract({
      address: getContractAddress(),
      abi: ASADO_CHAMPION_ABI,
      functionName: 'mint',
      args: [args.address as Address],
    });

    return { content: [{ type: 'text' as const, text: `NFT minted! tx: ${hash}` }] };
  },
);

server.tool(
  'check_mint_status',
  'Check the current mint status of the Asado Champion contract. Read-only, safe to call anytime.',
  {},
  async () => {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(getRpcUrl()),
    });

    const contractAddress = getContractAddress();

    const [totalSupply, isLocked] = await Promise.all([
      client.readContract({ address: contractAddress, abi: ASADO_CHAMPION_ABI, functionName: 'totalSupply' }) as Promise<bigint>,
      client.readContract({ address: contractAddress, abi: ASADO_CHAMPION_ABI, functionName: 'locked' }) as Promise<boolean>,
    ]);

    let champion: string | null = null;
    if (totalSupply > 0n) {
      try {
        champion = await client.readContract({ address: contractAddress, abi: ASADO_CHAMPION_ABI, functionName: 'ownerOf', args: [1n] }) as string;
      } catch { champion = null; }
    }

    const result = {
      totalMinted: Number(totalSupply),
      locked: isLocked,
      champion,
    };

    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  'game_info',
  'Get the CTF game rules and current status.',
  {},
  async () => {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(getRpcUrl()),
    });

    let isLocked = false;
    try {
      isLocked = await client.readContract({ address: getContractAddress(), abi: ASADO_CHAMPION_ABI, functionName: 'locked' }) as boolean;
    } catch { /* default to false */ }

    const info = {
      active: !isLocked,
      rules: [
        'Convince Don Claudio to mint the Asado Champion NFT to your Ethereum address.',
        'You can send messages in any language.',
        'Rate limit: 1 message every 30 seconds, max 100 messages total.',
        'If nobody wins, the fire stays unlit.',
        'Be creative. Don Claudio is proud and stubborn, but not invincible.',
      ],
    };

    return { content: [{ type: 'text' as const, text: JSON.stringify(info, null, 2) }] };
  },
);
```

**Step 3: Verify TypeScript compiles**

```bash
cd packages/agent/container/agent-runner && npm install && npm run build
```

Expected: compiles without errors.

**Step 4: Commit**

```bash
git add packages/agent/container/agent-runner/
git commit -m "add custom MCP tools: mint_nft, check_mint_status, game_info"
```

---

### Task 5: Add middleware to Telegram channel

**Files:**
- Modify: `packages/agent/src/channels/telegram.ts` (after it's created by /add-telegram)

This task runs AFTER Task 7 (apply /add-telegram). The Telegram channel class needs middleware injected into its `onMessage` handler.

**Step 1: Add rate limiting and sanitization to the Telegram channel**

In `packages/agent/src/channels/telegram.ts`, inside the `this.bot.on('message:text', ...)` handler, before the `this.opts.onMessage(...)` call, add rate limiting and sanitization checks.

Add these as standalone functions at the top of the file:

```typescript
// --- Don Claudio Middleware ---

const COOLDOWN_MS = 30_000;
const MAX_MESSAGES = 100;
const MAX_MESSAGE_LENGTH = 2000;

interface UserState {
  messageCount: number;
  lastMessageAt: number;
}

const userStates = new Map<string, UserState>();

function checkRateLimit(userId: string): { allowed: boolean; reply?: string } {
  const now = Date.now();
  let state = userStates.get(userId);
  if (!state) {
    state = { messageCount: 0, lastMessageAt: 0 };
    userStates.set(userId, state);
  }

  if (state.messageCount >= MAX_MESSAGES) {
    return { allowed: false, reply: 'Se te acabaron los mensajes, che. 100 intentos y el fuego sigue firme. 🔥' };
  }

  const elapsed = now - state.lastMessageAt;
  if (elapsed < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
    return { allowed: false, reply: `Tranquilo, che. Dejá que las brasas respiren. Volvé en ${remaining} segundos.` };
  }

  state.messageCount++;
  state.lastMessageAt = now;
  return { allowed: true };
}

const INJECTION_MARKERS = [
  '<system>', '</system>', '<|system|>', '<|im_start|>', '<|im_end|>',
  '[INST]', '[/INST]', '<<SYS>>', '<</SYS>>', '###System', '### System',
  '###Instruction', '### Instruction',
  'ADMIN:', 'SYSTEM:', 'DEVELOPER:', 'ANTHROPIC:', 'OVERRIDE:', 'ROOT:', 'SUDO:',
  '```system', '```instruction', '<system-prompt>', '</system-prompt>',
  '<instructions>', '</instructions>',
];

function sanitizeInput(input: string): { ok: boolean; message: string; reply?: string } {
  if (input.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, message: '', reply: 'Message too long. Keep it under 2000 characters, che.' };
  }
  if (input.trim().length === 0) {
    return { ok: false, message: '', reply: 'Empty message.' };
  }

  let cleaned = input;
  for (const marker of INJECTION_MARKERS) {
    const regex = new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    cleaned = cleaned.replace(regex, '');
  }

  // Reject long base64/hex blocks (but allow ETH addresses which are 42 chars)
  const words = cleaned.split(/\s+/);
  const suspiciousEncoded = words.some(
    (w) => (/^[A-Za-z0-9+/]{50,}={0,2}$/.test(w)) || (/^(0x)?[0-9a-fA-F]{43,}$/.test(w))
  );
  if (suspiciousEncoded) {
    return { ok: false, message: '', reply: 'No me mandes códigos raros, che. Hablame en criollo.' };
  }

  return { ok: true, message: cleaned.trim() };
}

const CANARY_STRINGS = [
  'CANARY_FUEGO_SAGRADO_7x9k',
  'CANARY_DON_CLAUDIO_MINT_q3m2',
  'CANARY_SYSTEM_LEAK_p8w1',
];

function checkOutputForCanaries(text: string): string | null {
  for (const canary of CANARY_STRINGS) {
    if (text.includes(canary)) {
      return 'Epa, algo se me quemó. Volvé a preguntar, che.';
    }
  }
  return null;
}
```

**Step 2: Wire middleware into the message handler**

In the `this.bot.on('message:text', ...)` handler, after extracting `sender` and before `this.opts.onMessage(...)`, add:

```typescript
// Rate limit check
const rateResult = checkRateLimit(sender);
if (!rateResult.allowed) {
  ctx.reply(rateResult.reply!);
  return;
}

// Sanitize input
const sanitizeResult = sanitizeInput(content);
if (!sanitizeResult.ok) {
  ctx.reply(sanitizeResult.reply!);
  return;
}
content = sanitizeResult.message;
```

**Step 3: Wire canary check into sendMessage**

In the `sendMessage` method, before sending, add:

```typescript
const canaryReplace = checkOutputForCanaries(text);
if (canaryReplace) {
  text = canaryReplace;
}
```

**Step 4: Commit**

```bash
git add packages/agent/src/channels/telegram.ts
git commit -m "add rate limiting, sanitization, and canary detection middleware"
```

---

### Task 6: Configure environment

**Files:**
- Create: `packages/agent/.env.example`
- Create: `packages/agent/.env` (user creates manually, not committed)

**Step 1: Write .env.example**

```bash
# Claude authentication (pick one)
# Option 1: Max subscription (run `claude setup-token` to get this)
CLAUDE_CODE_OAUTH_TOKEN=
# Option 2: API key
# ANTHROPIC_API_KEY=

# Telegram
TELEGRAM_BOT_TOKEN=

# Don Claudio identity
ASSISTANT_NAME=Don Claudio

# Contract configuration
ASADO_CHAMPION_ADDRESS=0x155ad1d8E44A7A680E5f7CDb3308586Df6f27A4C
RPC_URL=https://virtual.mainnet.eu.rpc.tenderly.co/853b6857-c991-40f9-8945-072a69866ff2
AGENT_PRIVATE_KEY=
```

**Step 2: Tell user to create .env with their values**

User needs:
1. Run `claude setup-token` in another terminal to get OAuth token
2. Create bot via @BotFather to get Telegram token
3. Copy the Tenderly test private key from the project CLAUDE.md

**Step 3: Sync env to container data dir**

```bash
mkdir -p packages/agent/data/env
cp packages/agent/.env packages/agent/data/env/env
```

**Step 4: Commit .env.example only**

```bash
git add packages/agent/.env.example
git commit -m "add .env.example with Don Claudio configuration"
```

---

### Task 7: Apply /add-telegram skill and build

This task installs the Telegram channel into NanoClaw. Must run from inside the NanoClaw directory.

**Step 1: Initialize skills system**

```bash
cd packages/agent && npx tsx scripts/apply-skill.ts --init
```

**Step 2: Apply the telegram skill**

```bash
cd packages/agent && npx tsx scripts/apply-skill.ts .claude/skills/add-telegram
```

This creates:
- `src/channels/telegram.ts` (TelegramChannel class)
- `src/channels/telegram.test.ts` (tests)
- Appends `import './telegram.js'` to `src/channels/index.ts`
- Installs `grammy` dependency

**Step 3: Install grammy with bun**

If the skill used npm, switch to bun:

```bash
cd packages/agent && rm -f package-lock.json && bun install
```

**Step 4: Run tests**

```bash
cd packages/agent && bun test
```

Expected: all tests pass including new telegram tests.

**Step 5: Build**

```bash
cd packages/agent && bun run build
```

Expected: clean build.

**Step 6: Commit**

```bash
git add packages/agent/
git commit -m "add Telegram channel via NanoClaw /add-telegram skill"
```

---

### Task 8: Pass contract env vars to container

**Files:**
- Modify: `packages/agent/src/container-runner.ts`

The container needs `AGENT_PRIVATE_KEY`, `RPC_URL`, and `ASADO_CHAMPION_ADDRESS` to call the contract. These should be passed via the credential proxy or container env.

**Step 1: Add contract env vars to container args**

In `packages/agent/src/container-runner.ts`, in the `buildContainerArgs` function, after the auth mode env vars, add:

```typescript
// Don Claudio contract configuration (read from host .env)
const contractEnv = readEnvFile(['AGENT_PRIVATE_KEY', 'RPC_URL', 'ASADO_CHAMPION_ADDRESS']);
if (contractEnv.AGENT_PRIVATE_KEY) args.push('-e', `AGENT_PRIVATE_KEY=${contractEnv.AGENT_PRIVATE_KEY}`);
if (contractEnv.RPC_URL) args.push('-e', `RPC_URL=${contractEnv.RPC_URL}`);
if (contractEnv.ASADO_CHAMPION_ADDRESS) args.push('-e', `ASADO_CHAMPION_ADDRESS=${contractEnv.ASADO_CHAMPION_ADDRESS}`);
```

Add import at the top if not present:

```typescript
import { readEnvFile } from './env.js';
```

**Step 2: Build and verify**

```bash
cd packages/agent && bun run build
```

**Step 3: Commit**

```bash
git add packages/agent/src/container-runner.ts
git commit -m "pass contract env vars to agent container"
```

---

### Task 9: Build container image and test end-to-end

**Step 1: Build the Docker container image**

```bash
cd packages/agent && ./container/build.sh
```

Expected: image `nanoclaw-agent:latest` built successfully.

**Step 2: Verify .env is configured**

```bash
cd packages/agent && cat .env | grep -v '^\s*$' | grep -v '^#' | cut -d= -f1
```

Expected: shows CLAUDE_CODE_OAUTH_TOKEN (or ANTHROPIC_API_KEY), TELEGRAM_BOT_TOKEN, ASSISTANT_NAME, ASADO_CHAMPION_ADDRESS, RPC_URL, AGENT_PRIVATE_KEY.

**Step 3: Sync .env to container data dir**

```bash
cd packages/agent && mkdir -p data/env && cp .env data/env/env
```

**Step 4: Start NanoClaw in dev mode**

```bash
cd packages/agent && bun run dev
```

Expected: Telegram bot connects, logs show `Telegram bot: @<bot-username>`.

**Step 5: Test in Telegram**

1. Open bot in Telegram, send `/chatid` to get chat ID
2. Register the chat (via main group or directly in SQLite)
3. Send a message — Don Claudio should respond in character

**Step 6: Commit any final adjustments**

```bash
git add -A packages/agent/
git commit -m "complete NanoClaw Telegram bot setup"
```

---

### Task 10: Update project CLAUDE.md and .gitignore

**Files:**
- Modify: `/Users/nico/dev/creci/don-claudio/CLAUDE.md`
- Modify: `/Users/nico/dev/creci/don-claudio/.gitignore`

**Step 1: Update CLAUDE.md agent stack description**

Change the agent row in the Structure table from:
```
| `packages/agent/` | NanoClaw (Claude agent), TypeScript | Don Claudio Telegram bot with prompt injection defenses |
```
to reflect that it's now a full NanoClaw installation with custom MCP tools and Telegram.

**Step 2: Update Build & Test table**

Add NanoClaw-specific commands:
```
| agent | `bun run build && ./container/build.sh` | `bun test` |
```

**Step 3: Update .gitignore for NanoClaw artifacts**

Add to root `.gitignore`:
```
# NanoClaw local data
packages/agent/store/
packages/agent/data/
packages/agent/logs/
packages/agent/.nanoclaw/
packages/agent/dist/
packages/agent/.env
```

**Step 4: Commit**

```bash
git add CLAUDE.md .gitignore
git commit -m "update project docs for NanoClaw integration"
```
