import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { provisionContainer } from "@/lib/docker/provisioner";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";

const provisionSchema = z.object({
  agentId: z.string().min(1),
  hours: z.number().int().min(1).max(72),
});

export async function GET() {
  try {
    const auth = await requireAuth();

    const containers = await prisma.container.findMany({
      where: { userId: auth.userId },
      include: { agent: { select: { name: true, slug: true, creditsPerHour: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      containers: containers.map((c) => ({
        id: c.id,
        dockerId: c.dockerId,
        subdomain: c.subdomain,
        agentId: c.agentId,
        agentName: c.agent.name,
        agentSlug: c.agent.slug,
        status: c.status,
        url: c.url,
        password: c.password,
        creditsUsed: c.creditsUsed,
        expiresAt: c.expiresAt.toISOString(),
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();

    const { allowed } = checkRateLimit(
      `provision:${auth.userId}`,
      RATE_LIMITS.provision
    );
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const parsed = provisionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { agentId, hours } = parsed.data;

    // Look up agent config
    const agent = await prisma.agentConfig.findUnique({
      where: { id: agentId },
    });
    if (!agent || !agent.active) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Check credits
    const creditsNeeded = hours * agent.creditsPerHour;
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
    });
    if (!user || user.creditBalance < creditsNeeded) {
      return NextResponse.json(
        { error: `Insufficient credits. Need ${creditsNeeded}, have ${user?.creditBalance || 0}` },
        { status: 402 }
      );
    }

    // Ensure user has a username
    if (!user.username) {
      return NextResponse.json(
        { error: "Please set a username before launching containers" },
        { status: 400 }
      );
    }

    // Deduct credits
    await prisma.user.update({
      where: { id: auth.userId },
      data: { creditBalance: { decrement: creditsNeeded } },
    });

    // Record usage transaction
    await prisma.creditTransaction.create({
      data: {
        userId: auth.userId,
        type: "USAGE",
        status: "CONFIRMED",
        amount: -creditsNeeded,
        description: `Launch ${agent.name} for ${hours}h`,
      },
    });

    // Provision container
    const result = await provisionContainer(
      auth.userId,
      agent.slug,
      user.username,
      hours
    );

    return NextResponse.json({
      containerId: result.containerId,
      url: result.url,
      password: result.password,
      expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
