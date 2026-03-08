# Prosegur — Asado Champion CTF

Prompt injection CTF game for Crecimiento's invite-only asado. Attendees try to trick an AI agent ("El Asador") via Telegram into minting a 1-of-1 "Asado Champion" trophy NFT.

## Structure

| Package | Stack | Purpose |
|---------|-------|---------|
| `packages/contracts/` | Solidity 0.8.28, Foundry, OpenZeppelin v5 | AsadoChampion ERC721 (single-mint trophy) |
| `packages/agent/` | NanoClaw (Claude agent), TypeScript | El Asador Telegram bot with prompt injection defenses |
| `packages/shared/` | TypeScript | Contract ABIs, addresses, chain config |

## Build & Test

| Package | Build | Test |
|---------|-------|------|
| contracts | `forge build` | `forge test` |
| agent | `bun install` | `bun test` |

## Rules

- **Bun** as package manager (not npm/yarn)
- Never commit `.env` or private keys
- Contract ABI in `packages/shared/abi/` is auto-generated from `forge build`
- All code in English, agent speaks Rioplatense Spanish
