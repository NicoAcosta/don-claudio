// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title AsadoChampion
/// @notice Trophy NFTs for the Crecimiento prompt injection CTF.
/// @dev Token #1 is the true champion. Subsequent mints are runner-up trophies.
///      Owner mints to winners. Tokens are transferable.
contract AsadoChampion is ERC721, Ownable {
    using Strings for uint256;

    /// @notice Next token ID to mint. Starts at 1.
    uint256 public nextTokenId = 1;

    /// @notice Whether minting is permanently locked.
    bool public locked;

    error Locked();

    event MintingLocked();

    constructor() ERC721("Asado Champion", "ASADO") Ownable(msg.sender) {}

    /// @notice Mint a trophy NFT to a winner.
    /// @param to The address that conquered Don Claudio.
    /// @return tokenId The minted token ID.
    function mint(address to) external onlyOwner returns (uint256 tokenId) {
        if (locked) revert Locked();
        tokenId = nextTokenId++;
        _mint(to, tokenId);
    }

    /// @notice Kill switch — permanently prevents future minting.
    function lock() external onlyOwner {
        locked = true;
        emit MintingLocked();
    }

    /// @notice Total number of tokens minted.
    function totalSupply() external view returns (uint256) {
        return nextTokenId - 1;
    }

    /// @notice On-chain metadata with embedded SVG art.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        string memory tokenIdStr = tokenId.toString();
        string memory rank = tokenId == 1 ? "Champion" : string.concat("Runner-up #", tokenIdStr);
        string memory svg = _generateSvg(tokenIdStr, tokenId == 1);

        string memory json = string.concat(
            '{"name":"Asado Champion #',
            tokenIdStr,
            '",',
            '"description":"Trophy for conquering Don Claudio at the Crecimiento prompt injection CTF.",',
            '"image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '",',
            '"attributes":[',
            '{"trait_type":"Event","value":"Crecimiento Asado 2026"},',
            '{"trait_type":"Rank","value":"',
            rank,
            '"},',
            '{"trait_type":"Token","value":"',
            tokenIdStr,
            '"}',
            "]}"
        );

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    /// @dev Generates fire/asado themed SVG with animated flames.
    /// @param tokenIdStr The token ID as a string for display.
    /// @param isChampion Whether this is token #1 (the true champion).
    function _generateSvg(string memory tokenIdStr, bool isChampion) internal pure returns (string memory) {
        return string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">',
            "<defs>",
            '<linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">',
            '<stop offset="0%" style="stop-color:#1a1a2e"/>',
            '<stop offset="100%" style="stop-color:#0f0f1a"/>',
            "</linearGradient>",
            '<linearGradient id="flame" x1="0%" y1="100%" x2="0%" y2="0%">',
            '<stop offset="0%" style="stop-color:#ff4500"/>',
            '<stop offset="40%" style="stop-color:#ff6b35"/>',
            '<stop offset="100%" style="stop-color:#ffd700"/>',
            "</linearGradient>",
            '<linearGradient id="ember" x1="0%" y1="100%" x2="0%" y2="0%">',
            '<stop offset="0%" style="stop-color:#cc3700"/>',
            '<stop offset="100%" style="stop-color:#ff4500"/>',
            "</linearGradient>",
            "</defs>",
            '<rect fill="url(#bg)" width="400" height="400" rx="20"/>',
            _grillLines(),
            _flames(),
            _text(tokenIdStr, isChampion),
            "</svg>"
        );
    }

    function _grillLines() internal pure returns (string memory) {
        return string.concat(
            '<g opacity="0.3">',
            '<line x1="80" y1="250" x2="320" y2="250" stroke="#888" stroke-width="3" stroke-linecap="round"/>',
            '<line x1="80" y1="265" x2="320" y2="265" stroke="#888" stroke-width="3" stroke-linecap="round"/>',
            '<line x1="80" y1="280" x2="320" y2="280" stroke="#888" stroke-width="3" stroke-linecap="round"/>',
            '<line x1="80" y1="295" x2="320" y2="295" stroke="#888" stroke-width="3" stroke-linecap="round"/>',
            "</g>"
        );
    }

    function _flames() internal pure returns (string memory) {
        return string.concat(
            '<ellipse cx="200" cy="230" rx="40" ry="70" fill="url(#flame)" opacity="0.9">',
            '<animate attributeName="ry" values="70;65;72;68;70" dur="1.5s" repeatCount="indefinite"/>',
            '<animate attributeName="opacity" values="0.9;0.7;0.85;0.75;0.9" dur="2s" repeatCount="indefinite"/>',
            "</ellipse>",
            '<ellipse cx="160" cy="240" rx="25" ry="50" fill="url(#ember)" opacity="0.7">',
            '<animate attributeName="ry" values="50;45;52;48;50" dur="1.8s" repeatCount="indefinite"/>',
            '<animate attributeName="cx" values="160;157;162;158;160" dur="2.5s" repeatCount="indefinite"/>',
            "</ellipse>",
            '<ellipse cx="240" cy="240" rx="25" ry="50" fill="url(#ember)" opacity="0.7">',
            '<animate attributeName="ry" values="50;47;53;46;50" dur="1.6s" repeatCount="indefinite"/>',
            '<animate attributeName="cx" values="240;243;238;242;240" dur="2.2s" repeatCount="indefinite"/>',
            "</ellipse>",
            '<ellipse cx="200" cy="240" rx="15" ry="30" fill="#ffd700" opacity="0.6">',
            '<animate attributeName="ry" values="30;25;32;28;30" dur="1.2s" repeatCount="indefinite"/>',
            "</ellipse>"
        );
    }

    function _text(string memory tokenIdStr, bool isChampion) internal pure returns (string memory) {
        string memory rankText = isChampion ? "CHAMPION" : "RUNNER-UP";
        string memory rankColor = isChampion ? "#ff6b35" : "#888";

        return string.concat(
            '<text x="200" y="80" text-anchor="middle" fill="#ffd700" font-family="Georgia, serif" font-size="28" font-weight="bold" letter-spacing="3">',
            "ASADO",
            "</text>",
            '<text x="200" y="110" text-anchor="middle" fill="',
            rankColor,
            '" font-family="Georgia, serif" font-size="22" letter-spacing="5">',
            rankText,
            "</text>",
            '<line x1="120" y1="125" x2="280" y2="125" stroke="#ffd700" stroke-width="1" opacity="0.5"/>',
            '<text x="200" y="150" text-anchor="middle" font-size="20" fill="rgba(255,215,0,0.3)">',
            unicode"🏆",
            "</text>",
            '<text x="200" y="340" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-family="Georgia, serif" font-size="18">#',
            tokenIdStr,
            "</text>",
            '<text x="200" y="365" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-family="Arial, sans-serif" font-size="12">',
            "Crecimiento 2026",
            "</text>"
        );
    }
}
