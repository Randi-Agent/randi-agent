import { docker } from "./client";
import { prisma } from "@/lib/db/prisma";
import { isBypassWallet } from "@/lib/credits/bypass";

export async function stopContainer(containerId: string): Promise<void> {
  const container = await prisma.container.findUnique({
    where: { id: containerId },
    include: { agent: true },
  });
  if (!container || !container.dockerId) return;

  try {
    const dockerContainer = docker.getContainer(container.dockerId);
    await dockerContainer.stop({ t: 10 });
    await dockerContainer.remove({ force: true });
  } catch (error: unknown) {
    const err = error as { statusCode?: number };
    if (err.statusCode !== 304 && err.statusCode !== 404) {
      throw error;
    }
  }

  // Calculate refund
  const now = new Date();
  const totalMs = container.expiresAt.getTime() - container.createdAt.getTime();
  const usedMs = now.getTime() - container.createdAt.getTime();
  const unusedRatio = Math.max(0, (totalMs - usedMs) / totalMs);
  const refundCredits = Math.floor(container.creditsUsed * unusedRatio);

  await prisma.$transaction(async (tx) => {
    await tx.container.update({
      where: { id: containerId },
      data: { status: "STOPPED", stoppedAt: now },
    });

    const user = await tx.user.findUnique({ where: { id: container.userId } });
    const isBypass = user && isBypassWallet(user.walletAddress);

    if (refundCredits > 0 && !isBypass) {
      await tx.user.update({
        where: { id: container.userId },
        data: { creditBalance: { increment: refundCredits } },
      });

      await tx.creditTransaction.create({
        data: {
          userId: container.userId,
          type: "REFUND",
          status: "CONFIRMED",
          amount: refundCredits,
          containerId: container.id,
          description: `Refund for early stop of ${container.subdomain}`,
        },
      });
    }
  });
}

export async function extendContainer(
  containerId: string,
  additionalHours: number
): Promise<{ newExpiresAt: Date; creditsCharged: number }> {
  return await prisma.$transaction(async (tx) => {
    const container = await tx.container.findUnique({
      where: { id: containerId },
      include: { agent: true, user: true },
    });

    if (!container) throw new Error("Container not found");
    if (container.status !== "RUNNING") throw new Error("Container not running");

    const creditsNeeded = additionalHours * container.agent.creditsPerHour;
    const isBypass = isBypassWallet(container.user.walletAddress);

    if (!isBypass && container.user.creditBalance < creditsNeeded) {
      throw new Error("Insufficient credits");
    }

    const newExpiresAt = new Date(
      container.expiresAt.getTime() + additionalHours * 60 * 60 * 1000
    );

    await tx.container.update({
      where: { id: containerId },
      data: {
        expiresAt: newExpiresAt,
        creditsUsed: { increment: creditsNeeded },
      },
    });

    if (!isBypass) {
      await tx.user.update({
        where: { id: container.userId },
        data: { creditBalance: { decrement: creditsNeeded } },
      });

      await tx.creditTransaction.create({
        data: {
          userId: container.userId,
          type: "USAGE",
          status: "CONFIRMED",
          amount: -creditsNeeded,
          containerId: container.id,
          description: `Extended ${container.subdomain} by ${additionalHours}h`,
        },
      });
    }

    return { newExpiresAt, creditsCharged: creditsNeeded };
  });
}

export async function getContainerLogs(
  dockerId: string,
  tail: number = 100
): Promise<string> {
  const container = docker.getContainer(dockerId);
  const logs = await container.logs({
    stdout: true,
    stderr: true,
    tail,
    timestamps: true,
  });
  return logs.toString();
}
