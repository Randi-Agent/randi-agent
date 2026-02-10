"use client";

interface CreditBalanceProps {
  balance: number;
}

export function CreditBalance({ balance }: CreditBalanceProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <p className="text-sm text-muted-foreground">Credit Balance</p>
      <p className="text-3xl font-bold mt-1">{balance.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground mt-2">
        Credits are used to run agent containers
      </p>
    </div>
  );
}
