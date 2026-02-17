import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { getPackageById } from "@/lib/credits/engine";
import { prisma } from "@/lib/db/prisma";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";

const schema = z.object({
  packageId: z.enum(["small", "medium", "large"]),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();

    const { allowed } = await checkRateLimit(
      `purchase:${auth.userId}`,
      RATE_LIMITS.purchase
    );
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const pkg = getPackageById(parsed.data.packageId);
    if (!pkg) {
      return NextResponse.json(
        { error: "Invalid package" },
        { status: 400 }
      );
    }

    const memo = `ap:purchase:${Date.now()}:${auth.userId.slice(-6)}`;

    const tx = await prisma.creditTransaction.create({
      data: {
        userId: auth.userId,
        type: "PURCHASE",
        status: "PENDING",
        amount: pkg.credits,
        tokenAmount: pkg.tokenAmount,
        memo,
        description: `Purchase ${pkg.name} package (${pkg.credits} credits)`,
      },
    });

    return NextResponse.json({
      transactionId: tx.id,
      tokenMint: process.env.TOKEN_MINT || process.env.NEXT_PUBLIC_TOKEN_MINT,
      treasuryWallet: process.env.TREASURY_WALLET,
      tokenAmount: pkg.tokenAmount.toString(),
      memo,
      decimals: Number(process.env.TOKEN_DECIMALS) || 9,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
