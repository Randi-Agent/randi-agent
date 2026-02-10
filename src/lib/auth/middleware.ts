import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyToken, type TokenPayload } from "./jwt";

export interface AuthedRequest {
  userId: string;
  wallet: string;
  jti: string;
}

export async function getAuthFromCookies(): Promise<AuthedRequest | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;

  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  return {
    userId: payload.sub!,
    wallet: payload.wallet,
    jti: payload.jti,
  };
}

export async function requireAuth(): Promise<AuthedRequest> {
  const auth = await getAuthFromCookies();

  if (!auth) {
    throw new AuthError("Unauthorized");
  }

  return auth;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export function handleAuthError(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  console.error("Unexpected error:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
