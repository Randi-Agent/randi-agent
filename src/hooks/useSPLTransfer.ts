"use client";

import { useCallback, useState } from "react";
import { PublicKey, Connection, Transaction } from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

declare global {
  interface Window {
    phantom?: {
      solana?: {
        isPhantom?: boolean;
        connect(): Promise<{ publicKey: { toString(): string } }>;
        signTransaction(tx: Transaction): Promise<Transaction>;
      };
    };
  }
}

export function useSPLTransfer() {
  const [sending, setSending] = useState(false);

  const transfer = useCallback(
    async (params: {
      mint: string;
      recipient: string;
      amount: string;
      decimals: number;
      memo: string;
    }) => {
      setSending(true);
      try {
        const phantom = window.phantom?.solana;
        if (!phantom?.isPhantom) {
          throw new Error("Phantom wallet not found. Please install Phantom extension.");
        }

        console.log("=== Transfer Parameters ===");
        console.log("Mint:", params.mint);
        console.log("Recipient (treasury):", params.recipient);
        console.log("Amount (base units):", params.amount);
        console.log("Decimals:", params.decimals);

        const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
        const connection = new Connection(rpcUrl, "confirmed");

        // Connect to Phantom
        const { publicKey: phantomPubkey } = await phantom.connect();
        const fromWallet = new PublicKey(phantomPubkey.toString());
        const toWallet = new PublicKey(params.recipient);
        const mint = new PublicKey(params.mint);

        console.log("\n=== Wallet Addresses ===");
        console.log("From wallet (Phantom):", fromWallet.toBase58());
        console.log("To wallet (treasury):", toWallet.toBase58());

        const fromATA = await getAssociatedTokenAddress(mint, fromWallet);
        const toATA = await getAssociatedTokenAddress(mint, toWallet);

        console.log("\n=== Token Accounts ===");
        console.log("From ATA:", fromATA.toBase58());
        console.log("To ATA:", toATA.toBase58());

        // Verify token accounts exist and have correct mint
        console.log("\n=== Verifying Token Accounts ===");
        
        try {
          const fromAccountInfo = await connection.getParsedAccountInfo(fromATA);
          console.log("From ATA exists:", !!fromAccountInfo.value);
          if (fromAccountInfo.value && 'parsed' in (fromAccountInfo.value.data as any)) {
            const parsed = (fromAccountInfo.value.data as any).parsed;
            console.log("From ATA mint:", parsed.info.mint);
            console.log("From ATA owner:", parsed.info.owner);
            console.log("From ATA balance:", parsed.info.tokenAmount?.amount);
          }
        } catch (e) {
          console.error("Error fetching from ATA:", e);
        }

        try {
          const toAccountInfo = await connection.getParsedAccountInfo(toATA);
          console.log("To ATA exists:", !!toAccountInfo.value);
          if (toAccountInfo.value && 'parsed' in (toAccountInfo.value.data as any)) {
            const parsed = (toAccountInfo.value.data as any).parsed;
            console.log("To ATA mint:", parsed.info.mint);
            console.log("To ATA owner:", parsed.info.owner);
          }
        } catch (e) {
          console.error("Error fetching to ATA:", e);
        }

        // Build transfer instruction
        console.log("\n=== Building Transaction ===");
        const transferIx = createTransferCheckedInstruction(
          fromATA,
          mint,
          toATA,
          fromWallet,
          BigInt(params.amount),
          params.decimals,
          [],
          TOKEN_PROGRAM_ID
        );

        console.log("Transfer instruction keys:");
        transferIx.keys.forEach((key, i) => {
          console.log(`  ${i}: ${key.pubkey.toBase58()} (signer: ${key.isSigner}, writable: ${key.isWritable})`);
        });

        // Get fresh blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        console.log("\nBlockhash:", blockhash);

        const tx = new Transaction();
        tx.recentBlockhash = blockhash;
        tx.feePayer = fromWallet;
        tx.add(transferIx);

        console.log("\n=== Requesting Signature ===");
        const signedTx = await phantom.signTransaction(tx);
        console.log("Transaction signed successfully");

        // Broadcast
        console.log("\n=== Broadcasting ===");
        const signature = await connection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: false,
        });

        console.log("Transaction sent:", signature);

        // Wait for confirmation
        const confirmation = await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          "confirmed"
        );

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }

        console.log("Transaction confirmed!");
        return signature;
      } catch (error) {
        console.error("Transfer error:", error);
        throw error;
      } finally {
        setSending(false);
      }
    },
    []
  );

  return { transfer, sending };
}
