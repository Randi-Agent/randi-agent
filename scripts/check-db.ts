import { PrismaClient } from "@prisma/client";

async function main() {
    console.log("Starting Database Diagnostic...");
    console.log("DATABASE_URL:", process.env.DATABASE_URL);

    const prisma = new PrismaClient();

    try {
        await prisma.$connect();
        console.log("✅ Successfully connected to the database.");

        const agents = await prisma.agentConfig.findMany();
        console.log(`📊 Agent Count: ${agents.length}`);
        agents.forEach(a => {
            console.log(`  - [${a.active ? "ACTIVE" : "INACTIVE"}] ${a.name} (${a.slug})`);
        });

        const userCount = await prisma.user.count();
        console.log(`👥 User Count: ${userCount}`);

        const users = await prisma.user.findMany({ select: { walletAddress: true, id: true } });
        users.forEach(u => console.log(`  - User: ${u.walletAddress} (ID: ${u.id})`));

        const chatCount = await prisma.chatSession.count();
        console.log(`💬 Chat Session Count: ${chatCount}`);

        if (agents.length === 0) {
            console.warn("⚠️ No agents found. You may need to run: npm run db:seed");
        }

    } catch (error) {
        console.error("❌ Database Connection Failed:");
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
