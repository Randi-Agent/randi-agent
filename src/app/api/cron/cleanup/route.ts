import { NextResponse } from "next/server";
import { cleanupExpiredContainers } from "@/lib/docker/cleanup";

// This route should be protected by a CRON_SECRET or similar in production
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");

    if (process.env.NODE_ENV === "production" && secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        await cleanupExpiredContainers();
        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Cleanup cron failed:", error);
        return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
    }
}
