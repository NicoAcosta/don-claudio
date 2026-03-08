// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {AsadoChampion} from "../src/AsadoChampion.sol";

contract AsadoChampionTest is Test {
    AsadoChampion public nft;
    address public owner;
    address public winner;
    address public runnerUp;
    address public attacker;

    function setUp() public {
        owner = address(this);
        winner = makeAddr("winner");
        runnerUp = makeAddr("runnerUp");
        attacker = makeAddr("attacker");

        nft = new AsadoChampion();
    }

    // ============ Constructor ============

    function test_constructor_setsNameAndSymbol() public view {
        assertEq(nft.name(), "Asado Champion");
        assertEq(nft.symbol(), "ASADO");
    }

    function test_constructor_setsOwner() public view {
        assertEq(nft.owner(), owner);
    }

    function test_constructor_nextTokenIdIsOne() public view {
        assertEq(nft.nextTokenId(), 1);
    }

    function test_constructor_notLocked() public view {
        assertFalse(nft.locked());
    }

    // ============ Mint ============

    function test_mint_firstMintGetsTokenOne() public {
        uint256 tokenId = nft.mint(winner);

        assertEq(tokenId, 1);
        assertEq(nft.ownerOf(1), winner);
        assertEq(nft.nextTokenId(), 2);
    }

    function test_mint_secondMintGetsTokenTwo() public {
        nft.mint(winner);
        uint256 tokenId = nft.mint(runnerUp);

        assertEq(tokenId, 2);
        assertEq(nft.ownerOf(2), runnerUp);
        assertEq(nft.nextTokenId(), 3);
    }

    function test_mint_multipleMints() public {
        for (uint256 i = 0; i < 5; i++) {
            address to = makeAddr(string(abi.encodePacked("player", i)));
            uint256 tokenId = nft.mint(to);
            assertEq(tokenId, i + 1);
            assertEq(nft.ownerOf(i + 1), to);
        }
        assertEq(nft.totalSupply(), 5);
    }

    function test_mint_revertsIfNotOwner() public {
        vm.prank(attacker);
        vm.expectRevert();
        nft.mint(attacker);
    }

    function test_mint_revertsIfLocked() public {
        nft.lock();

        vm.expectRevert(AsadoChampion.Locked.selector);
        nft.mint(winner);
    }

    function test_mint_emitsTransfer() public {
        vm.expectEmit(true, true, true, true);
        emit Transfer(address(0), winner, 1);
        nft.mint(winner);
    }

    // ============ Lock ============

    function test_lock_preventsMinting() public {
        nft.lock();
        assertTrue(nft.locked());

        vm.expectRevert(AsadoChampion.Locked.selector);
        nft.mint(winner);
    }

    function test_lock_revertsIfNotOwner() public {
        vm.prank(attacker);
        vm.expectRevert();
        nft.lock();
    }

    function test_lock_canLockAfterMinting() public {
        nft.mint(winner);
        nft.lock();

        assertTrue(nft.locked());
        vm.expectRevert(AsadoChampion.Locked.selector);
        nft.mint(runnerUp);
    }

    function test_lock_isIdempotent() public {
        nft.lock();
        nft.lock(); // Should not revert
        assertTrue(nft.locked());
    }

    function test_lock_emitsMintingLocked() public {
        vm.expectEmit(true, true, true, true);
        emit MintingLocked();
        nft.lock();
    }

    // ============ Mint edge cases ============

    function test_mint_revertsForAddressZero() public {
        vm.expectRevert();
        nft.mint(address(0));
    }

    // ============ Total Supply ============

    function test_totalSupply_zeroBeforeMint() public view {
        assertEq(nft.totalSupply(), 0);
    }

    function test_totalSupply_incrementsOnMint() public {
        nft.mint(winner);
        assertEq(nft.totalSupply(), 1);

        nft.mint(runnerUp);
        assertEq(nft.totalSupply(), 2);
    }

    // ============ Token URI ============

    function test_tokenURI_returnsBase64Json() public {
        nft.mint(winner);

        string memory uri = nft.tokenURI(1);

        bytes memory uriBytes = bytes(uri);
        bytes memory prefix = bytes("data:application/json;base64,");

        for (uint256 i = 0; i < prefix.length; i++) {
            assertEq(uriBytes[i], prefix[i]);
        }
    }

    function test_tokenURI_worksForMultipleTokens() public {
        nft.mint(winner);
        nft.mint(runnerUp);

        // Both should return valid URIs without reverting
        nft.tokenURI(1);
        nft.tokenURI(2);
    }

    function test_tokenURI_revertsForNonexistentToken() public {
        vm.expectRevert();
        nft.tokenURI(1);
    }

    function test_tokenURI_revertsForTokenZero() public {
        vm.expectRevert();
        nft.tokenURI(0);
    }

    // ============ Transfer ============

    function test_transfer_winnerCanTransfer() public {
        nft.mint(winner);

        vm.prank(winner);
        nft.transferFrom(winner, attacker, 1);

        assertEq(nft.ownerOf(1), attacker);
    }

    // ============ Events ============

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event MintingLocked();
}
