# Don Claudio — Asado Champion CTF

Prompt injection CTF game for Crecimiento's invite-only asado. Attendees try to trick an AI agent ("Don Claudio") via Telegram into minting an "Asado Champion" trophy NFT. Token #1 is the true champion; subsequent winners get runner-up tokens.

## Structure

| Package | Stack | Purpose |
|---------|-------|---------|
| `packages/contracts/` | Solidity 0.8.28, Foundry, OpenZeppelin v5 | AsadoChampion ERC721 (multi-mint trophy) |
| `packages/agent/` | NanoClaw (Claude agent), TypeScript | Don Claudio Telegram bot with prompt injection defenses |
| `packages/shared/` | TypeScript | Contract ABIs, addresses, chain config |

## Build & Test

| Package | Build | Test |
|---------|-------|------|
| contracts | `forge build` | `forge test` |
| agent | `bun install` | `bun test` |

## Deployed Contracts

| Network | Address | Chain ID |
|---------|---------|----------|
| Tenderly fork | `0x155ad1d8E44A7A680E5f7CDb3308586Df6f27A4C` | 9991 |
| Mainnet | _not yet deployed_ | 1 |

### Tenderly Fork

- **RPC**: `https://virtual.mainnet.eu.rpc.tenderly.co/853b6857-c991-40f9-8945-072a69866ff2`
- **Owner/Deployer**: `0xCFdA4491f610d1E9202B727D1D9DeE054C046587`
- **Test private key** (fork only): `0xab43c3ba3055aecf5d39ec1e953510c176dbf9cb324b5c816e78400f444f447e`

### Contract Overview

- **AsadoChampion.sol**: ERC721 + Ownable, incrementing tokenId starting at 1
- `mint(address to)` — owner-only, returns tokenId. Token #1 = "Champion", rest = "Runner-up"
- `lock()` — permanently disables minting (kill switch), emits `MintingLocked`
- `totalSupply()` — number of tokens minted
- `tokenURI()` — on-chain base64 JSON with embedded SVG (animated flames, grill lines)
- Tokens are **transferable** after minting

## Rules

- **Bun** as package manager (not npm/yarn)
- Never commit `.env` or private keys
- Contract ABI in `packages/shared/abi/` is auto-generated from `forge build`
- All code in English, agent speaks Rioplatense Spanish

## Don'ts

- NEVER commit `.env`, private keys, or secrets
- NEVER force push without explicit permission
- NEVER use the Tenderly test private key on mainnet
