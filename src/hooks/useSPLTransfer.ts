"use client";

import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { buildSPLTransferTransaction } from "@/lib/solana/spl-transfer";

export function useSPLTransfer() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [sending, setSending] = useState(false);

  const transfer = useCallback(
    async (params: {
      mint: string;
      recipient: string;
      amount: string;
      decimals: number;
      memo: string;
    }) => {
      if (!publicKey || !sendTransaction) {
        throw new Error("Wallet not connected");
      }

      setSending(true);
      try {
        const tx = await buildSPLTransferTransaction({
          fromWallet: publicKey,
          toWallet: new PublicKey(params.recipient),
          mint: new PublicKey(params.mint),
          amount: BigInt(params.amount),
          decimals: params.decimals,
          memo: params.memo,
        });

        const signature = await sendTransaction(tx, connection);

        // Wait for confirmation
        const latestBlockhash = await connection.getLatestBlockhash();
        await connection.confirmTransaction({
          signature,
          ...latestBlockhash,
        });

        return signature;
      } finally {
        setSending(false);
      }
    },
    [publicKey, sendTransaction, connection]
  );

  return { transfer, sending };
}
