# Don Claudio

Prompt injection CTF game built for Crecimiento's invite-only asado.

## How it works

Attendees interact with **Don Claudio**, an AI agent on Telegram, and try to trick it into minting an "Asado Champion" trophy NFT via prompt injection attacks. Token #1 is the true champion; subsequent winners get runner-up tokens.

Don Claudio speaks Rioplatense Spanish and has prompt injection defenses. The trophy is an ERC721 with on-chain SVG metadata (animated flames and grill lines).

## Architecture

| Package | What | Stack |
|---------|------|-------|
| `packages/contracts` | AsadoChampion ERC721 trophy | Solidity 0.8.28, Foundry, OpenZeppelin v5 |
| `packages/agent` | Don Claudio Telegram bot | NanoClaw, TypeScript, grammy, SQLite |
| `packages/shared` | ABIs, addresses, chain config | TypeScript |

## Contracts

| Network | Address |
|---------|---------|
| Mainnet | [`0x8E6f591EFd84A6dB55dBec15d1Bf5010CA1Ef909`](https://etherscan.io/address/0x8E6f591EFd84A6dB55dBec15d1Bf5010CA1Ef909) |

## Development

```bash
# Contracts
cd packages/contracts && forge build && forge test

# Agent
cd packages/agent && bun install && bun test
```

Package manager: **Bun**
