import { PrismaClient } from "@prisma/client";

async function main() {
    console.log("Starting Database Diagnostic...");
    console.log("DATABASE_URL:", process.env.DATABASE_URL);

    const prisma = new PrismaClient();

    try {
        await prisma.$connect();
        console.log("✅ Successfully connected to the database.");

        const agentCount = await prisma.agentConfig.count();
        console.log(`📊 Agent Count: ${agentCount}`);

        const userCount = await prisma.user.count();
        console.log(`👥 User Count: ${userCount}`);

        const chatCount = await prisma.chatSession.count();
        console.log(`💬 Chat Session Count: ${chatCount}`);

        if (agentCount === 0) {
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
