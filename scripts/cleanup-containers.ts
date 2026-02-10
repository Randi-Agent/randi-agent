/**
 * Cleanup expired containers cron job
 * Run via: npx tsx scripts/cleanup-containers.ts
 * Recommended: every 5 minutes via cron
 */

import { PrismaClient } from "@prisma/client";
import Docker from "dockerode";

const prisma = new PrismaClient();
const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || "/var/run/docker.sock" });

async function cleanupExpiredContainers() {
  console.log(`[${new Date().toISOString()}] Starting cleanup...`);

  const expired = await prisma.container.findMany({
    where: {
      status: "RUNNING",
      expiresAt: { lt: new Date() },
    },
    include: { agent: true },
  });

  console.log(`Found ${expired.length} expired containers`);

  for (const container of expired) {
    try {
      if (container.dockerId) {
        const dockerContainer = docker.getContainer(container.dockerId);
        try {
          await dockerContainer.stop({ t: 10 });
        } catch (e: unknown) {
          const statusCode = (e as { statusCode?: number }).statusCode;
          if (statusCode !== 304) throw e; // Already stopped
        }
        await dockerContainer.remove({ force: true });
        console.log(`  Removed docker container ${container.dockerId}`);
      }

      await prisma.container.update({
        where: { id: container.id },
        data: { status: "EXPIRED", stoppedAt: new Date() },
      });

      console.log(`  Marked ${container.subdomain} as EXPIRED`);
    } catch (error) {
      console.error(`  Failed to cleanup ${container.subdomain}:`, error);

      await prisma.container.update({
        where: { id: container.id },
        data: { status: "ERROR" },
      });
    }
  }

  // Also clean up orphaned docker containers (managed by us but not in DB)
  const allContainers = await docker.listContainers({
    all: true,
    filters: { label: ["agent-platform.managed=true"] },
  });

  for (const info of allContainers) {
    const dbContainer = await prisma.container.findUnique({
      where: { dockerId: info.Id },
    });

    if (!dbContainer) {
      console.log(`  Found orphaned container ${info.Id.slice(0, 12)}, removing...`);
      const orphan = docker.getContainer(info.Id);
      try {
        await orphan.stop({ t: 5 });
      } catch {
        // might already be stopped
      }
      await orphan.remove({ force: true });
    }
  }

  console.log(`[${new Date().toISOString()}] Cleanup complete`);
}

cleanupExpiredContainers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
