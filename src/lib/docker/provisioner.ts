import { docker } from "./client";
import { getAgentConfig } from "./agents";
import { generatePassword } from "@/lib/utils/crypto";
import { generateSubdomain } from "@/lib/utils/subdomain";
import { prisma } from "@/lib/db/prisma";

const DOCKER_NETWORK = process.env.DOCKER_NETWORK || "traefik-net";

export interface ProvisionResult {
  containerId: string;
  dockerId: string;
  subdomain: string;
  url: string;
  password: string | null;
}

export async function provisionContainer(
  userId: string,
  agentSlug: string,
  username: string,
  hours: number
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

  const config = agentConfigFactory({ subdomain, password, domain });

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

  await container.start();

  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  const creditsUsed = hours * agent.creditsPerHour;

  const dbContainer = await prisma.container.create({
    data: {
      userId,
      dockerId: container.id,
      subdomain,
      agentId: agent.id,
      status: "RUNNING",
      url: `https://${fullSubdomain}`,
      password: agentSlug === "openclaw" ? password : null,
      creditsUsed,
      expiresAt,
    },
  });

  return {
    containerId: dbContainer.id,
    dockerId: container.id,
    subdomain,
    url: `https://${fullSubdomain}`,
    password: agentSlug === "openclaw" ? password : null,
  };
}
