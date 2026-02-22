import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { SUBSCRIPTION_USD, getSubscriptionPlan, getCreditPackages, CreditPackage } from "@/lib/credits/engine";
import { prisma } from "@/lib/db/prisma";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";
import {
  quoteTokenAmountForUsd,
  resolvePaymentAsset,
  resolveSolBurnWallet,
  splitTokenAmountsByBurn,
} from "@/lib/payments/token-pricing";

const schema = z.object({
  planId: z.string().optional(),
  packageId: z.string().optional(),
}).refine(data => data.planId || data.packageId, {
  message: "Either planId or packageId must be provided",
});

const DEFAULT_PURCHASE_INTENT_TTL_MS = 15 * 60 * 1000;
const MAX_PURCHASE_INTENT_TTL_MS = 24 * 60 * 60 * 1000;
const WSOL_MINT = "So11111111111111111111111111111111111111112";

function resolvePurchaseIntentTtlMs(): number {
  const raw = Number(process.env.PURCHASE_INTENT_TTL_MS || DEFAULT_PURCHASE_INTENT_TTL_MS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_PURCHASE_INTENT_TTL_MS;
  return Math.min(Math.trunc(raw), MAX_PURCHASE_INTENT_TTL_MS);
}

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

    const { planId, packageId } = parsed.data;
    let item: { name: string; usdAmount: string; credits?: number; type: "SUBSCRIBE" | "PURCHASE" };

    if (planId === "monthly") {
      const plan = getSubscriptionPlan();
      item = { ...plan, type: "SUBSCRIBE" };
    } else if (packageId) {
      const pkg = getCreditPackages().find((p: CreditPackage) => p.id === packageId);
      if (!pkg) {
        return NextResponse.json({ error: "Invalid package ID" }, { status: 400 });
      }
      item = { ...pkg, type: "PURCHASE" };
    } else {
      return NextResponse.json({ error: "Invalid purchase request" }, { status: 400 });
    }

    const paymentAsset = resolvePaymentAsset();
    const tokenMint = process.env.TOKEN_MINT || process.env.NEXT_PUBLIC_TOKEN_MINT || "Randi8oX9z123456789012345678901234567890";
    const priceQuoteMint = paymentAsset === "sol"
      ? process.env.SOL_PRICE_MINT?.trim() || WSOL_MINT
      : tokenMint!;
    const treasuryWallet = process.env.TREASURY_WALLET || "BFnVSDKbTfe7tRPB8QqmxcXZjzkSxwBMH34HdnbStbQ3";
    const decimals = paymentAsset === "sol" ? 9 : Number(process.env.TOKEN_DECIMALS || process.env.NEXT_PUBLIC_TOKEN_DECIMALS || "9");
    const solBurnWallet = resolveSolBurnWallet();

    if (!treasuryWallet) {
      return NextResponse.json(
        { error: "Payment configuration is missing treasury wallet" },
        { status: 500 }
      );
    }

    const quote = await quoteTokenAmountForUsd({
      usdAmount: item.usdAmount,
      tokenMint: priceQuoteMint,
      tokenDecimals: decimals,
    });

    const split = splitTokenAmountsByBurn(quote.tokenAmountBaseUnits);
    const memo = `ap:${item.type.toLowerCase()}:${Date.now()}:${auth.userId.slice(-6)}:b${split.burnBps}`;
    const intentExpiresAt = new Date(Date.now() + resolvePurchaseIntentTtlMs());

    const tx = await prisma.creditTransaction.create({
      data: {
        userId: auth.userId,
        type: item.type,
        status: "PENDING",
        amount: item.credits || 0,
        tokenAmount: quote.tokenAmountBaseUnits,
        memo,
        description: item.type === "SUBSCRIBE"
          ? `Subscribe to ${item.name} ($${item.usdAmount}/month)`
          : `Purchase ${item.credits} Credits ($${item.usdAmount})`,
      },
    });

    return NextResponse.json({
      transactionId: tx.id,
      paymentAsset,
      tokenMint: paymentAsset === "spl" ? tokenMint : null,
      treasuryWallet,
      burnWallet: paymentAsset === "sol" ? solBurnWallet : null,
      tokenAmount: split.treasuryTokenAmount.toString(),
      burnAmount: split.burnTokenAmount.toString(),
      grossTokenAmount: quote.tokenAmountBaseUnits.toString(),
      memo,
      decimals,
      quote: {
        itemUsd: item.usdAmount,
        itemName: item.name,
        tokenUsdPrice: quote.tokenUsdPrice,
        tokenAmountDisplay: quote.tokenAmountDisplay,
        source: quote.source,
        burnBps: split.burnBps,
      },
      intentExpiresAt: intentExpiresAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return handleAuthError(error);
  }
}
