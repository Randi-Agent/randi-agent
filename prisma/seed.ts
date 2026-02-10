import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Seed agent configurations
  const agentZero = await prisma.agentConfig.upsert({
    where: { slug: "agent-zero" },
    update: {},
    create: {
      slug: "agent-zero",
      name: "Agent Zero",
      description:
        "General-purpose AI agent with persistent memory, tool use, and code execution capabilities. Suitable for research, coding, and complex multi-step tasks.",
      image: process.env.AGENT_ZERO_IMAGE || "frdel/agent-zero:latest",
      internalPort: 80,
      creditsPerHour: 10,
      memoryLimit: BigInt(4294967296), // 4GB
      cpuLimit: BigInt(2000000000), // 2 cores
      pidLimit: 256,
      envVars: {},
      volumes: [],
      active: true,
    },
  });

  const openClaw = await prisma.agentConfig.upsert({
    where: { slug: "openclaw" },
    update: {},
    create: {
      slug: "openclaw",
      name: "OpenClaw",
      description:
        "Open-source AI agent platform with web UI, password-protected access, and extensible tool system. Great for team collaboration and custom workflows.",
      image: process.env.OPENCLAW_IMAGE || "openclaw/openclaw:latest",
      internalPort: 8080,
      creditsPerHour: 15,
      memoryLimit: BigInt(4294967296), // 4GB
      cpuLimit: BigInt(2000000000), // 2 cores
      pidLimit: 256,
      envVars: {},
      volumes: [],
      active: true,
    },
  });

  console.log("Seeded agents:", { agentZero, openClaw });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
