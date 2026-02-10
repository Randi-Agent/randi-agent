"use client";

import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "@/contexts/WalletContext";

export function useWallet() {
  const { publicKey, connected, connecting, disconnect, select, wallets } =
    useSolanaWallet();
  const { user, loading, signIn, signOut } = useAuth();

  return {
    publicKey,
    connected,
    connecting,
    disconnect,
    select,
    wallets,
    user,
    loading,
    signIn,
    signOut,
    walletAddress: publicKey?.toBase58() || null,
  };
}
