"use client";

import { useCallback, useEffect, useMemo } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useConnectedStandardWallets } from "@privy-io/react-auth/solana";

export function useAuth() {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const { wallets, ready: walletsReady } = useConnectedStandardWallets();

  const primaryWallet = useMemo(() => wallets[0], [wallets]);

  const syncSession = useCallback(async () => {
    if (!user) return;

    const linkedSolana = user.linkedAccounts?.find(
      (account) => account.type === "wallet" && (account as { chainType?: string }).chainType === "solana"
    ) as { address?: string } | undefined;

    const walletAddress = linkedSolana?.address || primaryWallet?.address;
    if (!walletAddress) return;

    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error("Missing Privy access token");
    }

    const response = await fetch("/api/auth/privy-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ wallet: walletAddress }),
    });

    if (!response.ok) {
      throw new Error("Failed to establish server session");
    }
  }, [user, primaryWallet, getAccessToken]);

  useEffect(() => {
    if (!ready || !walletsReady || !authenticated) {
      return;
    }

    syncSession().catch((error) => {
      console.error("Failed to sync session", error);
    });
  }, [ready, walletsReady, authenticated, syncSession]);

  return {
    user: user
      ? {
          id: user.id,
          walletAddress:
            user.wallet?.address ||
            primaryWallet?.address ||
            (user.linkedAccounts?.find(
              (account) =>
                account.type === "wallet" &&
                (account as { chainType?: string }).chainType === "solana"
            ) as { address?: string } | undefined)?.address,
        }
      : null,
    loading: !ready,
    isAuthenticated: authenticated,
    signIn: () => login(),
    signOut: async () => {
      await logout();
      await fetch("/api/auth/logout", { method: "POST" });
    },
  };
}
