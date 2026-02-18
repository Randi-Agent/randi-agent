import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { signToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";
import { resolvePrivyWallet } from "@/lib/auth/privy";
import { ensureUserHasUsername } from "@/lib/utils/username";

const schema = z.object({
  wallet: z.string().optional(),
});

function isPrivyRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("status 429") || message.includes("too_many_requests");
}

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function POST(request: NextRequest) {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { error: "Unauthorized", code: "missing_access_token" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const requestOrigin =
    request.headers.get("origin") ||
    request.nextUrl.origin ||
    process.env.NEXT_PUBLIC_APP_URL ||
    undefined;

  let wallet: string;
  try {
    wallet = await resolvePrivyWallet(accessToken, parsed.data.wallet, requestOrigin);
  } catch (error) {
    // Some wallet adapters can provide a selected address that differs from the
    // linked wallet returned by Privy. Fall back to any linked Solana wallet.
    try {
      wallet = await resolvePrivyWallet(accessToken, undefined, requestOrigin);
    } catch (fallbackError) {
      const primaryReason =
        error instanceof Error ? error.message : "Unknown Privy verification error";
      const fallbackReason =
        fallbackError instanceof Error
          ? fallbackError.message
          : "Unknown fallback verification error";

      console.error("Privy session verification failed", {
        primaryReason,
        fallbackReason,
        requestedWallet: parsed.data.wallet ?? null,
      });

      if (isPrivyRateLimitError(error) || isPrivyRateLimitError(fallbackError)) {
        return NextResponse.json(
          {
            error: "Authentication provider is rate limiting requests. Please retry shortly.",
            code: "privy_rate_limited",
          },
          {
            status: 429,
            headers: {
              "Retry-After": "15",
            },
          }
        );
      }

      return NextResponse.json(
        {
          error: "Unable to verify authenticated wallet",
          code: "wallet_verification_failed",
        },
        { status: 401 }
      );
    }
  }

  const user = await prisma.user.upsert({
    where: { walletAddress: wallet },
    update: {},
    create: { walletAddress: wallet },
  });
  const username = await ensureUserHasUsername(prisma, user.id, wallet);

  const token = await signToken(user.id, wallet);
  const response = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      walletAddress: user.walletAddress,
      username,
      creditBalance: user.creditBalance,
    },
  });

  response.cookies.set("auth-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 24 * 60 * 60,
    path: "/",
  });

  return response;
}
