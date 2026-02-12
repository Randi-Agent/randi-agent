"use client";

import { useState, useEffect, useCallback } from "react";
import type { CreditTransaction } from "@/types/credits";

export function useCredits() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/credits/balance");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to fetch balance");
        return;
      }
      const data = await res.json();
      setBalance(data.balance);
      setTransactions(data.transactions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const initiatePurchase = async (packageId: string) => {
    const res = await fetch("/api/credits/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }
    return res.json();
  };

  const verifyPurchase = async (txSignature: string, memo: string) => {
    const res = await fetch("/api/credits/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ txSignature, memo }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }
    const data = await res.json();
    setBalance(data.newBalance);
    await fetchBalance(); // refresh transactions
    return data;
  };

  return {
    balance,
    transactions,
    loading,
    error,
    initiatePurchase,
    verifyPurchase,
    refresh: fetchBalance,
  };
}
