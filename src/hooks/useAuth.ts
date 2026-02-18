"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useConnectedStandardWallets } from "@privy-io/react-auth/solana";

const DEFAULT_RETRY_DELAY_MS = 3000;
const PRIVY_RATE_LIMIT_RETRY_MS = 15000;

let sharedSessionSynced = false;
let sharedSyncPromise: Promise<void> | null = null;
let sharedNextRetryAt = 0;

class SessionSyncError extends Error {
  code: string | null;
  retryAfterMs: number | null;

  constructor(message: string, code: string | null = null, retryAfterMs: number | null = null) {
    super(message);
    this.name = "SessionSyncError";
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

function parseRetryAfterMs(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const seconds = Number.parseInt(headerValue, 10);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1000;
  }
  return null;
}

function normalizeSyncError(error: unknown): SessionSyncError {
  if (error instanceof SessionSyncError) {
    return error;
  }

  if (error instanceof Error) {
    return new SessionSyncError(error.message);
  }

  return new SessionSyncError("Failed to establish server session");
}

export function useAuth() {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const { wallets } = useConnectedStandardWallets();
  const [syncRetryTick, setSyncRetryTick] = useState(0);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const retryTimerRef = useRef<number | null>(null);

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
      const code = details?.code || null;
      const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
      const defaultRetry =
        response.status === 429 || code === "privy_rate_limited"
          ? PRIVY_RATE_LIMIT_RETRY_MS
          : DEFAULT_RETRY_DELAY_MS;

      throw new SessionSyncError(
        details?.error || "Failed to establish server session",
        code,
        retryAfterMs ?? defaultRetry
      );
    }
  }, [user, primaryWallet, getAccessToken]);

  const hasServerSession = useCallback(async () => {
    const response = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    return response.ok;
  }, []);

  useEffect(() => {
    if (!ready || !authenticated || sharedSessionSynced) {
      return;
    }

    let cancelled = false;
    const now = Date.now();
    if (now < sharedNextRetryAt) {
      const waitMs = Math.max(250, sharedNextRetryAt - now);
      retryTimerRef.current = window.setTimeout(() => {
        if (!cancelled) {
          setSyncRetryTick((value) => value + 1);
        }
      }, waitMs);

      return () => {
        cancelled = true;
        if (retryTimerRef.current) {
          window.clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
      };
    }

    if (!sharedSyncPromise) {
      sharedSyncPromise = (async () => {
        const existingSession = await hasServerSession();
        if (!existingSession) {
          await syncSession();
        }
      })()
        .then(() => {
          sharedSessionSynced = true;
          sharedNextRetryAt = 0;
        })
        .catch((error) => {
          const normalized = normalizeSyncError(error);
          sharedNextRetryAt = Date.now() + (normalized.retryAfterMs ?? DEFAULT_RETRY_DELAY_MS);
          throw normalized;
        })
        .finally(() => {
          sharedSyncPromise = null;
        });
    }

    sharedSyncPromise
      .then(() => {
        if (!cancelled) {
          setSessionError(null);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        const normalized = normalizeSyncError(error);
        setSessionError(normalized.message);
        retryTimerRef.current = window.setTimeout(() => {
          setSyncRetryTick((value) => value + 1);
        }, Math.max(250, sharedNextRetryAt - Date.now()));
        console.error("Failed to sync session", normalized);
      });

    return () => {
      cancelled = true;
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [ready, authenticated, syncSession, hasServerSession, syncRetryTick]);

  useEffect(() => {
    if (!authenticated) {
      sharedSessionSynced = false;
      sharedSyncPromise = null;
      sharedNextRetryAt = 0;
    }
  }, [authenticated]);

  const retrySessionSync = useCallback(() => {
    sharedNextRetryAt = 0;
    setSessionError(null);
    setSyncRetryTick((value) => value + 1);
  }, []);

  const sessionReady = !authenticated || sharedSessionSynced;

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
    sessionReady,
    sessionError,
    retrySessionSync,
    signIn: () => login(),
    signOut: async () => {
      await logout();
      await fetch("/api/auth/logout", { method: "POST" });
    },
  };
}
