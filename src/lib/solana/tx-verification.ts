import { PublicKey } from "@solana/web3.js";
import { connection } from "./connection";

export interface VerificationResult {
  valid: boolean;
  error?: string;
}

export async function verifyTransaction(
  txSignature: string,
  expectedMint: string,
  expectedRecipient: string,
  expectedAmount: bigint,
  expectedMemo: string
): Promise<VerificationResult> {
  try {
    const tx = await connection.getParsedTransaction(txSignature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });

    if (!tx) {
      return { valid: false, error: "Transaction not found" };
    }

    if (tx.meta?.err) {
      return { valid: false, error: "Transaction failed on-chain" };
    }

    const instructions = tx.transaction.message.instructions;

    // Find SPL transfer instruction
    let transferFound = false;
    for (const ix of instructions) {
      if ("parsed" in ix && ix.parsed?.type === "transferChecked") {
        const info = ix.parsed.info;
        const mintAddress = info.mint;
        const destination = info.destination;
        const tokenAmount = BigInt(info.tokenAmount.amount);

        if (mintAddress !== expectedMint) {
          return { valid: false, error: "Wrong token mint" };
        }

        // Verify the destination ATA belongs to the treasury
        const treasuryKey = new PublicKey(expectedRecipient);
        const mintKey = new PublicKey(expectedMint);
        const { PublicKey: PK } = await import("@solana/web3.js");
        const { getAssociatedTokenAddress } = await import("@solana/spl-token");
        const expectedATA = await getAssociatedTokenAddress(mintKey, treasuryKey);

        if (destination !== expectedATA.toBase58()) {
          return { valid: false, error: "Wrong recipient" };
        }

        if (tokenAmount < expectedAmount) {
          return { valid: false, error: "Insufficient amount" };
        }

        transferFound = true;
      }
    }

    if (!transferFound) {
      return { valid: false, error: "No SPL transfer found in transaction" };
    }

    // Verify memo
    const logMessages = tx.meta?.logMessages || [];
    const memoFound = logMessages.some(
      (log) =>
        log.includes("Memo") && log.includes(expectedMemo)
    );

    if (!memoFound) {
      return { valid: false, error: "Memo mismatch" };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
