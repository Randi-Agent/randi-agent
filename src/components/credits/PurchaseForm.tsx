"use client";

import { useState, useEffect } from "react";
import { useCredits } from "@/hooks/useCredits";
import { useTokenPrice } from "@/hooks/useTokenPrice";
import { useSPLTransfer } from "@/hooks/useSPLTransfer";
import { SubscriptionPlan, CreditPackage } from "@/lib/credits/engine";

type Step = "plan" | "paying" | "verifying" | "done" | "error";

export function PurchaseForm() {
  const { initiateSubscription, purchasePackage, verifyPurchase, isSubscribed, subscription } = useCredits();
  const { priceUsd, usdToRandi, formatRandi, loading: priceLoading } = useTokenPrice();
  const { transfer, sending: walletBusy } = useSPLTransfer();

  const [step, setStep] = useState<Step>("plan");
  const [error, setError] = useState<string | null>(null);
  const [availablePlan, setAvailablePlan] = useState<SubscriptionPlan | null>(null);
  const [availablePackages, setAvailablePackages] = useState<CreditPackage[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>("monthly");
  const [loadingPackages, setLoadingPackages] = useState(true);

  useEffect(() => {
    async function fetchPackages() {
      try {
        const res = await fetch("/api/credits/packages");
        const data = await res.json();
        setAvailablePlan(data.plan);
        setAvailablePackages(data.packages || []);
      } catch (err) {
        console.error("Failed to fetch packages:", err);
      } finally {
        setLoadingPackages(false);
      }
    }
    fetchPackages();
  }, []);

  const selectedItem = selectedItemId === "monthly"
    ? availablePlan
    : availablePackages.find(p => p.id === selectedItemId);

  const usdAmount = selectedItem ? Number(selectedItem.usdAmount) : 0;
  const randiAmount = usdToRandi(usdAmount);
  const burnAmount = randiAmount ? randiAmount * 0.1 : null;
  const treasuryAmount = randiAmount ? randiAmount * 0.9 : null;

  const handlePurchase = async () => {
    if (!selectedItem) return;

    try {
      setError(null);
      setStep("paying");

      const intent = selectedItemId === "monthly"
        ? await initiateSubscription()
        : await purchasePackage(selectedItemId);

      const txSignature = await transfer({
        recipient: intent.treasuryWallet,
        mint: intent.tokenMint,
        amount: intent.tokenAmount,
        burnAmount: intent.burnAmount,
        burnRecipient: intent.burnWallet,
        memo: intent.memo,
        decimals: intent.decimals,
        paymentAsset: intent.paymentAsset,
      });

      setStep("verifying");

      await verifyPurchase(txSignature, intent.memo, intent.transactionId);
      setStep("done");
    } catch (err) {
      console.error("Purchase error:", err);
      setError(err instanceof Error ? err.message : "Purchase failed");
      setStep("error");
    }
  };

  if (isSubscribed) {
    const expiresDate = subscription.expiresAt
      ? new Date(subscription.expiresAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
      : "Unknown";

    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-success/10 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-lg">Randi Pro — Active</h3>
            <p className="text-xs text-muted-foreground">Renews {expiresDate}</p>
          </div>
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>✓ Unlimited AI agent chats</p>
          <p>✓ All tool integrations</p>
          <p>✓ 1000+ Composio tools</p>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="bg-card border border-success/30 rounded-xl p-6 text-center">
        <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold mb-2">Purchase Successful!</h3>
        <p className="text-muted-foreground">Your account has been updated with the new credits or subscription.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-6">
        <h3 className="text-xl font-bold mb-4">Upgrade Your Access</h3>

        {loadingPackages ? (
          <div className="py-8 text-center text-muted-foreground animate-pulse">
            Loading options...
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {availablePlan && (
              <button
                onClick={() => setSelectedItemId(availablePlan.id)}
                className={`w-full p-4 rounded-xl border text-left transition-all ${selectedItemId === availablePlan.id
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border bg-muted/30 hover:bg-muted/50"
                  }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-primary mb-1 block">Best Value</span>
                    <h4 className="font-bold">{availablePlan.name}</h4>
                    <p className="text-xs text-muted-foreground">Unlimited chats + all toolkits</p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">${availablePlan.usdAmount}</div>
                    <div className="text-[10px] text-muted-foreground">per month</div>
                  </div>
                </div>
              </button>
            )}

            <div className="flex items-center gap-2 my-4">
              <div className="h-[1px] flex-1 bg-border" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Credit Packs</span>
              <div className="h-[1px] flex-1 bg-border" />
            </div>

            <div className="grid grid-cols-1 gap-2">
              {availablePackages.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => setSelectedItemId(pkg.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${selectedItemId === pkg.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-muted/30 hover:bg-muted/50"
                    }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-sm">{pkg.name}</h4>
                      <p className="text-[10px] text-muted-foreground">{pkg.credits} Credits</p>
                    </div>
                    <div className="font-bold text-primary">${pkg.usdAmount}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground mb-4">
          Paid in RANDI tokens
          {priceUsd && (
            <span className="ml-1">
              (1 RANDI ≈ ${priceUsd.toFixed(8)})
            </span>
          )}
        </p>

        {/* Token Breakdown */}
        {randiAmount !== null && (
          <div className="rounded-lg bg-black/20 border border-white/5 p-3 mb-4 text-[10px] space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total RANDI</span>
              <span className="font-mono">{formatRandi(randiAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">To Treasury (90%)</span>
              <span className="font-mono">{formatRandi(treasuryAmount)}</span>
            </div>
            <div className="flex justify-between text-orange-400">
              <span>Burned 🔥 (10%)</span>
              <span className="font-mono">{formatRandi(burnAmount)}</span>
            </div>
          </div>
        )}

        {priceLoading && !randiAmount && (
          <div className="rounded-lg bg-muted/50 border border-border p-3 mb-4 text-[10px] text-center text-muted-foreground">
            Loading RANDI price...
          </div>
        )}
      </div>

      {/* Action */}
      <div className="p-4 border-t border-border bg-background/30">
        {error && (
          <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <button
          onClick={handlePurchase}
          disabled={step === "paying" || step === "verifying" || walletBusy || !selectedItem}
          className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {step === "paying"
            ? "Confirm in wallet..."
            : step === "verifying"
              ? "Verifying on-chain..."
              : step === "error"
                ? "Try Again"
                : `Buy ${selectedItem?.name} — $${selectedItem?.usdAmount}`}
        </button>

        {walletBusy && step === "plan" && (
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Connect a wallet to continue
          </p>
        )}
      </div>
    </div>
  );
}
