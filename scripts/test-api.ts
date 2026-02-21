import { PrismaClient } from "@prisma/client";

async function testAgentsApi() {
    console.log("Testing Agent Retrieval Logic...");
    const prisma = new PrismaClient();

    try {
        const agents = await prisma.agentConfig.findMany({
            where: { active: true },
            select: {
                id: true,
                slug: true,
                name: true,
            },
            orderBy: { name: "asc" },
        });

        console.log(`Found ${agents.length} active agents:`);
        agents.forEach(a => console.log(`  - ${a.name} (${a.slug})`));

        if (agents.length === 0) {
            console.error("❌ FAILURE: No active agents found. This matches the empty UI reported by the user.");
        } else {
            console.log("✅ SUCCESS: Logic correctly retrieves agents. The issue may be API-level or Frontend-level.");
        }
    } catch (err) {
        console.error("❌ ERROR during retrieval:", err);
    } finally {
        await prisma.$disconnect();
    }
}

testAgentsApi();
