import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// Debug endpoint to check agent configs
export async function GET(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get("secret");
    if (secret !== process.env.COMPOSIO_API_KEY) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agents = await prisma.agentConfig.findMany({
        select: { id: true, slug: true, name: true, tools: true, active: true },
    });

    return NextResponse.json({
        agents: agents.map(a => ({
            id: a.id,
            slug: a.slug,
            name: a.name,
            active: a.active,
            toolsPreview: a.tools?.substring(0, 200),
        })),
    });
}
