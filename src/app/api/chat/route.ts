import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { openrouter, isFreeModel, DEFAULT_MODEL } from "@/lib/openrouter/client";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";

const schema = z
  .object({
    agentId: z.string().min(1).optional(),
    sessionId: z.string().min(1).optional(),
    message: z.string().min(1).max(4000),
    model: z.string().min(1).default(DEFAULT_MODEL),
  })
  .refine((value) => value.agentId || value.sessionId, {
    message: "agentId or sessionId is required",
  });

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { agentId, sessionId, message, model } = parsed.data;

    // Paid-model handling is intentionally deferred; this preserves current behavior.
    if (!isFreeModel(model)) {
      // Placeholder for credits/x402 checks.
    }

    let existingSession:
      | {
          id: string;
          userId: string;
          agentId: string;
        }
      | null = null;

    if (sessionId) {
      existingSession = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        select: { id: true, userId: true, agentId: true },
      });

      if (!existingSession || existingSession.userId !== auth.userId) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
    }

    const resolvedAgentId = existingSession?.agentId || agentId!;
    const agent = await prisma.agentConfig.findUnique({
      where: { id: resolvedAgentId },
      select: { id: true, systemPrompt: true, active: true },
    });

    if (!agent || !agent.active) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const chatResponse = await openrouter.chat.completions.create({
      model,
      messages: [
        { role: "system", content: agent.systemPrompt },
        { role: "user", content: message },
      ],
    });

    const responseText = chatResponse.choices[0]?.message?.content || "";

    let currentSessionId = existingSession?.id;
    if (!currentSessionId) {
      const newSession = await prisma.chatSession.create({
        data: {
          userId: auth.userId,
          agentId: agent.id,
          title: message.substring(0, 50),
        },
      });
      currentSessionId = newSession.id;
    } else {
      await prisma.chatSession.update({
        where: { id: currentSessionId },
        data: { updatedAt: new Date() },
      });
    }

    await prisma.chatMessage.createMany({
      data: [
        { sessionId: currentSessionId, role: "user", content: message },
        { sessionId: currentSessionId, role: "assistant", content: responseText },
      ],
    });

    return NextResponse.json({
      response: responseText,
      sessionId: currentSessionId,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
