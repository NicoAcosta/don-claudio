// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {AsadoChampion} from "../src/AsadoChampion.sol";

/// @title Deploy
/// @notice Deploys AsadoChampion (no proxy — single-use event contract)
contract Deploy is Script {
    function run() external returns (address champion) {
        vm.startBroadcast();

        AsadoChampion nft = new AsadoChampion();
        champion = address(nft);

        vm.stopBroadcast();

        console.log("=== Deployment Summary ===");
        console.log("AsadoChampion:", champion);
        console.log("Owner:", nft.owner());
        console.log("");
        console.log("Next steps:");
        console.log("1. Verify on Etherscan");
        console.log("2. Copy ABI to packages/shared/abi/");
        console.log("3. Update packages/shared/config.ts with address");
    }
}
