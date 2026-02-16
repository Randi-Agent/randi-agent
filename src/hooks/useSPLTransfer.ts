"use client";

import { useCallback, useState } from "react";
import { PublicKey, Connection, Transaction, TransactionInstruction } from "@solana/web3.js";
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
        console.log("Memo:", params.memo);

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

        // Build transfer instruction
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

        // Add memo instruction
        const memoIx = new TransactionInstruction({
          keys: [{ pubkey: fromWallet, isSigner: true, isWritable: false }],
          programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
          data: Buffer.from(params.memo, "utf-8"),
        });

        // Get fresh blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        console.log("\nBlockhash:", blockhash);

        const tx = new Transaction();
        tx.recentBlockhash = blockhash;
        tx.feePayer = fromWallet;
        tx.add(transferIx);
        tx.add(memoIx);

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
