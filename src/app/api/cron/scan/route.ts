import { NextRequest, NextResponse } from "next/server";
import { runScanner } from "@/lib/payments/scanner";
import { runBurnService } from "@/lib/payments/burn-service";

function isAuthorized(request: NextRequest): boolean {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return true; // No secret configured, allow (dev mode)

    // Vercel cron sends Authorization: Bearer <CRON_SECRET>
    const authHeader = request.headers.get("authorization");
    if (authHeader === `Bearer ${cronSecret}`) return true;

    // Also support legacy x-cron-secret header for manual invocations
    const headerSecret = request.headers.get("x-cron-secret");
    if (headerSecret === cronSecret) return true;

    return false;
}

async function handleScan(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const processed = await runScanner();
        const burnResult = await runBurnService();

        return NextResponse.json({
            success: true,
            processedTransactions: processed,
            burnResult: burnResult,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Scanner cron failed:", error);
        return NextResponse.json({ error: "Scanner failed" }, { status: 500 });
    }
}

// Vercel Cron Jobs invoke GET requests
export async function GET(request: NextRequest) {
    return handleScan(request);
}

// Keep POST for manual/external invocations
export async function POST(request: NextRequest) {
    return handleScan(request);
}
