import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { parseBurnBpsFromMemo } from "@/lib/payments/token-pricing";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";

export const dynamic = "force-dynamic";

const TOKEN_MINT = "FYAz1bPKJUFRwT4pzhUzdN3UqCN5ppXRL2pfto4zpump";
const BURN_WALLET = "1nc1nerator11111111111111111111111111111111";

export async function GET() {
    try {
        // Query the Platform DB for detailed history
        const transactions = await prisma.tokenTransaction.findMany({
            where: {
                status: "CONFIRMED",
                type: { in: ["PURCHASE", "USAGE", "SUBSCRIBE"] },
            },
            select: {
                tokenAmount: true,
                memo: true,
                createdAt: true,
            },
        });

        // 1. Calculate Platform-specific stats from DB
        let platformBurned = BigInt(0);
        let totalVolume = BigInt(0);

        const burnHistory = transactions.map((tx) => {
            const tokenAmount = tx.tokenAmount || BigInt(0);
            const burnBps = parseBurnBpsFromMemo(tx.memo || "");
            const burnAmount = (tokenAmount * BigInt(burnBps)) / BigInt(10000);

            platformBurned += burnAmount;
            totalVolume += tokenAmount;

            return {
                date: tx.createdAt.toISOString(),
                tokenAmount: tokenAmount.toString(),
                burnAmount: burnAmount.toString(),
                burnBps,
            };
        });

        // 2. Fetch Global Chain Burn for the Sidebar Counter (Live Proof)
        let chainBurned = BigInt(0);
        try {
            const connection = new Connection(
                process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
                "confirmed"
            );
            const mintKey = new PublicKey(TOKEN_MINT);
            const burnKey = new PublicKey(BURN_WALLET);

            const burnATA = await getAssociatedTokenAddress(mintKey, burnKey, true);
            const account = await getAccount(connection, burnATA);
            chainBurned = account.amount;
            if (chainBurned === BigInt(0)) {
                chainBurned = platformBurned;
            }
        } catch (e) {
            console.warn("Solana burn fetch failed, using DB stats as fallback:", e);
            chainBurned = platformBurned;
        }

        // We use chainBurned for the "Total Burned" highlight, 
        // as it reflects the true deflationary impact.
        return NextResponse.json({
            totalBurned: chainBurned.toString(),
            platformBurned: platformBurned.toString(),
            totalVolume: totalVolume.toString(),
            history: burnHistory.slice(-20).reverse(),
        });
    } catch (error) {
        console.error("Failed to fetch burn stats:", error);
        return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
    }
}
