"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useConnectedStandardWallets } from "@privy-io/react-auth/solana";

export function useAuth() {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const { wallets } = useConnectedStandardWallets();
  const [syncRetryTick, setSyncRetryTick] = useState(0);
  const sessionSyncedRef = useRef(false);

  const primaryWallet = useMemo(() => wallets[0], [wallets]);

  const syncSession = useCallback(async () => {
    const linkedSolana = user?.linkedAccounts?.find(
      (account) => account.type === "wallet" && (account as { chainType?: string }).chainType === "solana"
    ) as { address?: string } | undefined;

    const walletAddress = linkedSolana?.address || primaryWallet?.address;

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
      credentials: "include",
      // Let the server resolve a linked Solana wallet from Privy identity.
      // Sending a specific wallet can fail when adapter-selected and linked wallets differ.
      body: JSON.stringify(walletAddress ? { wallet: walletAddress } : {}),
    });

    if (!response.ok) {
      const details = await response.json().catch(() => null) as
        | { code?: string; error?: string }
        | null;
      const suffix = details?.code ? ` (${details.code})` : "";
      throw new Error(`Failed to establish server session${suffix}`);
    }
  }, [user, primaryWallet, getAccessToken]);

  useEffect(() => {
    if (!ready || !authenticated || sessionSyncedRef.current) {
      return;
    }

    syncSession()
      .then(() => {
        sessionSyncedRef.current = true;
      })
      .catch((error) => {
        console.error("Failed to sync session", error);
        window.setTimeout(() => {
          setSyncRetryTick((value) => value + 1);
        }, 1500);
      });
  }, [ready, authenticated, syncSession, syncRetryTick]);

  useEffect(() => {
    if (!authenticated) {
      sessionSyncedRef.current = false;
    }
  }, [authenticated]);

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
