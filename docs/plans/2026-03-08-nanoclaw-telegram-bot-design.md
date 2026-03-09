# Don Claudio Telegram Bot — NanoClaw Integration Design

## Summary

Replace `packages/agent/` with a NanoClaw installation that runs Don Claudio as a Telegram bot. NanoClaw handles the orchestrator, container isolation, Telegram channel (grammy), and Claude Agent SDK integration. Auth via Claude Max subscription (OAuth token through NanoClaw's credential proxy). Custom tools (mint NFT, check status, game info) and middleware (rate limiting, sanitization, monitoring) are adapted into NanoClaw's conventions.

## Architecture

```
don-claudio/
├── packages/
│   ├── contracts/                    # unchanged
│   ├── shared/                       # unchanged
│   └── agent/                        # NanoClaw install (replaces current scaffold)
│       ├── src/                      # NanoClaw host
│       │   ├── index.ts              # orchestrator (polling loop, agent invocation)
│       │   ├── channels/
│       │   │   ├── registry.ts       # channel self-registration
│       │   │   ├── index.ts          # barrel (imports telegram)
│       │   │   └── telegram.ts       # grammy + Don Claudio middleware
│       │   ├── container-runner.ts   # spawns Docker containers
│       │   ├── credential-proxy.ts   # OAuth/API key injection
│       │   ├── db.ts                 # SQLite
│       │   └── ...                   # other NanoClaw host files
│       ├── container/
│       │   ├── Dockerfile            # node:22-slim + npm (stock, inside Docker)
│       │   ├── build.sh
│       │   └── agent-runner/
│       │       ├── package.json      # claude-agent-sdk + MCP SDK + viem
│       │       └── src/
│       │           ├── index.ts      # SDK runner (stock NanoClaw)
│       │           └── ipc-mcp-stdio.ts  # stock tools + 3 custom Don Claudio tools
│       ├── groups/
│       │   └── don-claudio/
│       │       └── CLAUDE.md         # agent identity (migrated from current)
│       ├── .env                      # CLAUDE_CODE_OAUTH_TOKEN, TELEGRAM_BOT_TOKEN, RPC vars
│       ├── .env.example
│       ├── package.json              # NanoClaw deps (bun on host)
│       └── tsconfig.json
```

## Auth: Claude Max Subscription

NanoClaw's credential proxy supports two modes:

- **OAuth mode** (Max subscription): Set `CLAUDE_CODE_OAUTH_TOKEN` in `.env`. Get token via `claude setup-token`.
- **API key mode** (fallback): Set `ANTHROPIC_API_KEY` in `.env`.

The proxy runs on the host, containers connect to it via `ANTHROPIC_BASE_URL`. Containers never see real credentials.

## Custom MCP Tools

Added to `container/agent-runner/src/ipc-mcp-stdio.ts` alongside NanoClaw's built-in tools:

| Tool | Parameters | Description |
|------|-----------|-------------|
| `mint_nft` | `address: string` | Mints AsadoChampion NFT. Calls contract via viem. |
| `check_mint_status` | none | Returns totalMinted, locked, champion address. Read-only. |
| `game_info` | `user_id: string` | Returns rules, rate limit status, active state. |

Container env vars needed: `AGENT_PRIVATE_KEY`, `TENDERLY_FORK_RPC_URL`, `USE_TENDERLY`.

Dependencies added to `container/agent-runner/package.json`: `viem`.

## Middleware Integration

All middleware runs in the **Telegram channel class** on the host side (before/after container invocation):

| Layer | Implementation |
|-------|---------------|
| Rate limiting | `checkRateLimit(userId)` before forwarding message to container. Reject with in-character reply if limited. |
| Input sanitization | `sanitize(text)` strips injection markers, rejects encoded content. Applied before forwarding. |
| Output monitoring | `checkOutput(response, userId)` checks for canary string leaks. Applied before sending Telegram reply. |
| Logging | NanoClaw's pino logger + per-group logs in `groups/don-claudio/logs/`. |

## Package Manager

- **Host side**: bun (`bun install`, `bun run build`, `bun run dev`)
- **Container side**: npm inside Docker (hermetic, no impact on local dev)
- Setup scripts patched to use `bun run build` instead of `npm run build`

## Setup Flow

1. Clone NanoClaw into `packages/agent/` (replacing current scaffold)
2. `bun install`
3. Run `claude setup-token` to get OAuth token, add to `.env`
4. Create Telegram bot via @BotFather, add token to `.env`
5. Add contract env vars to `.env`
6. Apply `/add-telegram` skill (adds grammy, creates channel class)
7. Customize Telegram channel class with middleware
8. Add custom MCP tools to agent-runner
9. Add `viem` to container dependencies
10. Migrate CLAUDE.md to `groups/don-claudio/`
11. Build container: `./container/build.sh`
12. Build host: `bun run build`
13. Start service or `bun run dev` for testing

## Trade-offs

- **Container per message**: Docker overhead per interaction. Acceptable for rate-limited CTF (30s cooldown, max 100 msgs/user).
- **OAuth/Max subscription**: Works via credential proxy, but Anthropic could tighten enforcement. API key is instant fallback (just swap env var).
- **npm in container**: Diverges from bun convention but is isolated inside Docker. Not worth the complexity to change.
- **NanoClaw upstream updates**: Since we customize files, pulling upstream changes requires manual merging. Acceptable for a single-event bot.
