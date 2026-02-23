import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import {
    getStakingLevel,
    getNextTier,
    getTierProgress,
    getAmountToNextTier,
    formatTokenAmount,
    STAKING_TIERS,
    type StakingLevel,
} from "@/lib/token-gating";

// GET: Returns user's staking status, level, and required amount to next tier
export async function GET() {
    try {
        const auth = await requireAuth();

        const user = await prisma.user.findUnique({
            where: { id: auth.userId },
            select: {
                id: true,
                walletAddress: true,
                stakedAmount: true,
                stakingLevel: true,
                unstakedAt: true,
            },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const currentLevel = (user.stakingLevel || "NONE") as StakingLevel;
        const nextTier = getNextTier(currentLevel);
        const progress = getTierProgress(user.stakedAmount);
        const amountToNext = getAmountToNextTier(user.stakedAmount);

        return NextResponse.json({
            walletAddress: user.walletAddress,
            stakedAmount: user.stakedAmount.toString(),
            stakedAmountFormatted: formatTokenAmount(user.stakedAmount),
            stakingLevel: currentLevel,
            tierProgress: progress,
            nextTier: nextTier ? {
                level: nextTier,
                requiredAmount: STAKING_TIERS[nextTier].toString(),
                requiredAmountFormatted: formatTokenAmount(STAKING_TIERS[nextTier]),
                amountNeeded: amountToNext.toString(),
                amountNeededFormatted: formatTokenAmount(amountToNext),
            } : null,
            unstakedAt: user.unstakedAt?.toISOString() || null,
            tiers: {
                NONE: { amount: "0", label: "No staking required" },
                BRONZE: { amount: STAKING_TIERS.BRONZE.toString(), label: "1,000 $RANDI" },
                SILVER: { amount: STAKING_TIERS.SILVER.toString(), label: "10,000 $RANDI" },
                GOLD: { amount: STAKING_TIERS.GOLD.toString(), label: "100,000 $RANDI" },
            },
        });
    } catch (error) {
        return handleAuthError(error);
    }
}

// POST: Record staking transaction (called after Solana confirms stake)
const stakeSchema = z.object({
    txSignature: z.string().min(1),
    amount: z.string().optional(), // Amount staked (optional, will be verified on-chain)
});

export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth();

        const body = await req.json();
        const parsed = stakeSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0].message },
                { status: 400 }
            );
        }

        const { txSignature, amount } = parsed.data;

        // Check if user has a wallet address
        const user = await prisma.user.findUnique({
            where: { id: auth.userId },
            select: {
                id: true,
                walletAddress: true,
                stakedAmount: true,
            },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (!user.walletAddress) {
            return NextResponse.json(
                { error: "No wallet address linked to account" },
                { status: 400 }
            );
        }

        // If amount provided, record the stake directly
        // Otherwise, we'll rely on the verify endpoint to scan the blockchain
        if (amount) {
            const stakedAmount = BigInt(amount);
            const newLevel = getStakingLevel(stakedAmount);

            await prisma.user.update({
                where: { id: auth.userId },
                data: {
                    stakedAmount: stakedAmount,
                    stakingLevel: newLevel,
                    unstakedAt: null, // Clear any previous unstake
                },
            });
        }

        return NextResponse.json({
            success: true,
            message: "Staking recorded successfully",
            txSignature,
            nextAction: amount ? "verify" : "pending_verification",
        });
    } catch (error) {
        return handleAuthError(error);
    }
}

// DELETE: Unstake (sets unstakedAt, clears stakedAmount after lockup)
export async function DELETE(req: NextRequest) {
    try {
        const auth = await requireAuth();

        const user = await prisma.user.findUnique({
            where: { id: auth.userId },
            select: {
                id: true,
                stakedAmount: true,
                stakingLevel: true,
            },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (user.stakedAmount <= BigInt(0)) {
            return NextResponse.json(
                { error: "No staked amount to withdraw" },
                { status: 400 }
            );
        }

        // Record the unstake request - actual withdrawal happens after lockup period
        // For now, we just set the unstakedAt timestamp
        await prisma.user.update({
            where: { id: auth.userId },
            data: {
                unstakedAt: new Date(),
                // Keep the stakedAmount until the lockup period completes
                // In a real implementation, you'd have a cron job to clear after lockup
            },
        });

        return NextResponse.json({
            success: true,
            message: "Unstake initiated. Your staked tokens will be available after the lockup period.",
            unstakedAt: new Date().toISOString(),
        });
    } catch (error) {
        return handleAuthError(error);
    }
}
