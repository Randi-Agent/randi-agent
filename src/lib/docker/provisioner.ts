import { docker } from "./client";
import { getAgentConfig } from "./agents";
import { generatePassword } from "@/lib/utils/crypto";
import { generateSubdomain } from "@/lib/utils/subdomain";
import { prisma } from "@/lib/db/prisma";
import { createHash } from "crypto";

const DOCKER_NETWORK = process.env.DOCKER_NETWORK || "traefik-net";

export interface ProvisionResult {
  dockerId: string;
  subdomain: string;
  url: string;
  password: string | null;
}

function buildStorageKey(userId: string, agentSlug: string): string {
  const hash = createHash("sha256")
    .update(`${userId}:${agentSlug}`)
    .digest("hex")
    .slice(0, 16);
  return `${agentSlug}-${hash}`;
}

export async function provisionContainer(
  userId: string,
  agentSlug: string,
  username: string
): Promise<ProvisionResult> {
  const agentConfigFactory = getAgentConfig(agentSlug);
  if (!agentConfigFactory) {
    throw new Error(`Unknown agent: ${agentSlug}`);
  }

  const agent = await prisma.agentConfig.findUnique({
    where: { slug: agentSlug },
  });
  if (!agent || !agent.active) {
    throw new Error(`Agent not available: ${agentSlug}`);
  }

  const domain = process.env.NEXT_PUBLIC_DOMAIN || "localhost";
  const subdomain = generateSubdomain(username, agentSlug);
  const password = generatePassword();
  const persistentStorageEnabled =
    process.env.AGENT_PERSISTENT_STORAGE !== "false";
  const storageKey = persistentStorageEnabled
    ? buildStorageKey(userId, agentSlug)
    : subdomain;

  const config = agentConfigFactory({ subdomain, password, domain, storageKey });

  const fullSubdomain = `${subdomain}.${domain}`;
  const containerName = `ap-${subdomain}`;

  // Build volume binds
  const binds: string[] = Object.entries(config.volumes).map(
    ([volumeName, containerPath]) => `${volumeName}:${containerPath}`
  );

  // Build environment array
  const envArray = Object.entries(config.env).map(
    ([key, value]) => `${key}=${value}`
  );

  const container = await docker.createContainer({
    Image: config.image,
    name: containerName,
    Env: envArray,
    ExposedPorts: {
      [`${config.internalPort}/tcp`]: {},
    },
    HostConfig: {
      Binds: binds,
      Memory: config.memoryLimit,
      NanoCpus: config.cpuLimit,
      PidsLimit: config.pidLimit,
      CapDrop: ["ALL"],
      CapAdd: ["NET_BIND_SERVICE"],
      SecurityOpt: ["no-new-privileges"],
      Privileged: false,
      NetworkMode: DOCKER_NETWORK,
    },
    Labels: {
      "traefik.enable": "true",
      [`traefik.http.routers.${containerName}.rule`]: `Host(\`${fullSubdomain}\`)`,
      [`traefik.http.routers.${containerName}.entrypoints`]: "websecure",
      [`traefik.http.routers.${containerName}.tls.certresolver`]: "letsencrypt",
      [`traefik.http.services.${containerName}.loadbalancer.server.port`]:
        String(config.internalPort),
      "agent-platform.managed": "true",
      "agent-platform.user-id": userId,
      "agent-platform.agent-slug": agentSlug,
    },
  });

  try {
    await container.start();

    return {
      dockerId: container.id,
      subdomain,
      url: `https://${fullSubdomain}`,
      password: agentSlug === "openclaw" ? password : null,
    };
  } catch (error) {
    // Cleanup if start fails
    await container.remove({ force: true }).catch(() => { });
    throw error;
  }
}
