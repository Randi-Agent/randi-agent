import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";

// FIX (HIGH): Added rate limiting to prevent enumeration/scraping.
export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "anon";
  const { allowed } = await checkRateLimit(`agents-list:${ip}`, RATE_LIMITS.agents);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const agents = await prisma.agentConfig.findMany({
    where: { active: true },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      tokensPerHour: true,
      requiredTier: true,
      active: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ agents });
}
