export type TransactionType = "PURCHASE" | "USAGE" | "REFUND";
export type TransactionStatus = "PENDING" | "CONFIRMED" | "FAILED" | "EXPIRED";

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  tokenAmount: string;
  tokenAmountDisplay: string;
}

export interface PurchaseInitResponse {
  transactionId: string;
  tokenMint: string;
  treasuryWallet: string;
  tokenAmount: string;
  memo: string;
  decimals: number;
}

export interface CreditTransaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  txSignature: string | null;
  description: string | null;
  createdAt: string;
}
