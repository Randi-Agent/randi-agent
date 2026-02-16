"use client";

import { useCallback, useState } from "react";
import { PublicKey, Connection, Transaction, TransactionInstruction } from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";
import { useConnectedStandardWallets, useStandardSignAndSendTransaction } from "@privy-io/react-auth/solana";

export function useSPLTransfer() {
  const { wallets } = useConnectedStandardWallets();
  const { signAndSendTransaction } = useStandardSignAndSendTransaction();
  const [sending, setSending] = useState(false);

  const transfer = useCallback(
    async (params: {
      mint: string;
      recipient: string;
      amount: string;
      decimals: number;
      memo: string;
    }) => {
      const wallet = wallets[0];
      if (!wallet) {
        throw new Error("Wallet not connected");
      }

      console.log("Full wallet object:", wallet);
      console.log("Wallet address:", wallet.address);
      console.log("Wallet type:", wallet.walletClientType);
      console.log("Wallet connector:", (wallet as any).connector);

      setSending(true);
      try {
        const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
        const connection = new Connection(rpcUrl, "confirmed");

        const fromWallet = new PublicKey(wallet.address);
        const toWallet = new PublicKey(params.recipient);
        const mint = new PublicKey(params.mint);

        console.log("Getting token accounts...");
        const fromATA = await getAssociatedTokenAddress(mint, fromWallet);
        const toATA = await getAssociatedTokenAddress(mint, toWallet);

        console.log("From ATA:", fromATA.toBase58());
        console.log("To ATA:", toATA.toBase58());

        console.log("Building transaction...");
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

        const memoIx = new TransactionInstruction({
          keys: [{ pubkey: fromWallet, isSigner: true, isWritable: false }],
          programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
          data: Buffer.from(params.memo, "utf-8"),
        });

        // Get fresh blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        console.log("Blockhash:", blockhash);

        const tx = new Transaction();
        tx.recentBlockhash = blockhash;
        tx.feePayer = fromWallet;
        tx.add(transferIx);
        tx.add(memoIx);

        const serializedTx = tx.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        });

        console.log("Transaction serialized, length:", serializedTx.length);
        console.log("Requesting signature and broadcast...");

        // Try signAndSendTransaction
        const result = await signAndSendTransaction({
          wallet,
          transaction: serializedTx,
          chain: `solana:${process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet"}`,
        });

        const signature = bs58.encode(result.signature);
        console.log("Result from signAndSendTransaction:", result);
        console.log("Signature:", signature);

        // Check if transaction is on chain
        console.log("Checking if transaction exists on chain...");
        const status = await connection.getSignatureStatus(signature);
        console.log("Signature status:", status);

        if (!status.value) {
          // Transaction was NOT broadcast - let's try to send it manually
          console.log("Transaction NOT on chain, trying manual broadcast...");
          
          // The wallet signed but didn't broadcast. We need a different approach.
          throw new Error("Wallet signed but did not broadcast the transaction. Please try again and approve quickly.");
        }

        // Wait for confirmation
        console.log("Waiting for confirmation...");
        const confirmation = await connection.confirmTransaction(
          {
            signature,
            blockhash,
            lastValidBlockHeight,
          },
          "confirmed"
        );

        if (confirmation.value.err) {
          console.error("Transaction error:", confirmation.value.err);
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
    [wallets, signAndSendTransaction]
  );

  return { transfer, sending };
}
