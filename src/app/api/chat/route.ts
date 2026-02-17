import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type OpenAI from "openai";
import { openrouter, isFreeModel, DEFAULT_MODEL } from "@/lib/openrouter/client";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import {
  executeOpenAIToolCall,
  getAgentToolsFromConfig,
} from "@/lib/composio/client";

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

const MAX_HISTORY_MESSAGES = 20;
const MAX_TOOL_LOOP_STEPS = 4;

type ChatMessageParam = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type ChatTool = OpenAI.Chat.Completions.ChatCompletionTool;

interface ToolExecutionLog {
  id: string;
  name: string;
  arguments: string;
  result?: unknown;
  error?: string;
}

function parseJsonSafely(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractTextContent(
  content: OpenAI.Chat.Completions.ChatCompletionMessage["content"] | null | undefined
): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => ("text" in part && typeof part.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
}

function toChatMessageParam(role: string, content: string): ChatMessageParam | null {
  if (role === "user") return { role: "user", content };
  if (role === "assistant") return { role: "assistant", content };
  if (role === "system") return { role: "system", content };
  return null;
}

async function runTextOnlyChat(
  model: string,
  messages: ChatMessageParam[]
): Promise<string> {
  const chatResponse = await openrouter.chat.completions.create({
    model,
    messages,
  });

  return extractTextContent(chatResponse.choices[0]?.message?.content);
}

async function runToolEnabledChat(
  model: string,
  baseMessages: ChatMessageParam[],
  tools: ChatTool[],
  userId: string
): Promise<{ responseText: string; toolCalls: ToolExecutionLog[] }> {
  if (tools.length === 0) {
    return {
      responseText: await runTextOnlyChat(model, baseMessages),
      toolCalls: [],
    };
  }

  const toolCalls: ToolExecutionLog[] = [];
  const messages: ChatMessageParam[] = [...baseMessages];

  try {
    for (let iteration = 0; iteration < MAX_TOOL_LOOP_STEPS; iteration += 1) {
      const chatResponse = await openrouter.chat.completions.create({
        model,
        messages,
        tools,
        tool_choice: "auto",
      });

      const assistantMessage = chatResponse.choices[0]?.message;
      if (!assistantMessage) break;

      const assistantToolCalls = assistantMessage.tool_calls ?? [];
      const assistantText = extractTextContent(assistantMessage.content);

      if (assistantToolCalls.length === 0) {
        return { responseText: assistantText, toolCalls };
      }

      messages.push({
        role: "assistant",
        content: assistantMessage.content ?? "",
        tool_calls: assistantToolCalls,
      });

      for (const toolCall of assistantToolCalls) {
        const rawResult = await executeOpenAIToolCall(userId, toolCall);
        const parsedResult = parseJsonSafely(rawResult);

        let error: string | undefined;
        if (isRecord(parsedResult) && typeof parsedResult.error === "string") {
          error = parsedResult.error;
        }

        toolCalls.push({
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: toolCall.function.arguments,
          result: error ? undefined : parsedResult,
          error,
        });

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: rawResult,
        });
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Tool-enabled chat failed, falling back to text-only chat.", error);
    } else {
      console.warn("Tool-enabled chat failed, falling back to text-only chat.");
    }

    return {
      responseText: await runTextOnlyChat(model, baseMessages),
      toolCalls,
    };
  }

  return {
    responseText:
      "I could not complete that request through tools. Please verify your Composio connections and try again.",
    toolCalls,
  };
}

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
      select: { id: true, systemPrompt: true, active: true, tools: true },
    });

    if (!agent || !agent.active) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    let historyMessages: ChatMessageParam[] = [];
    if (existingSession) {
      const storedMessages = await prisma.chatMessage.findMany({
        where: { sessionId: existingSession.id },
        orderBy: { createdAt: "desc" },
        take: MAX_HISTORY_MESSAGES,
        select: { role: true, content: true },
      });

      historyMessages = storedMessages
        .reverse()
        .map((storedMessage) =>
          toChatMessageParam(storedMessage.role, storedMessage.content)
        )
        .filter((storedMessage): storedMessage is ChatMessageParam => storedMessage !== null);
    }

    const messages: ChatMessageParam[] = [
      { role: "system", content: agent.systemPrompt },
      ...historyMessages,
      { role: "user", content: message },
    ];

    let composioTools: ChatTool[] = [];
    if (agent.tools) {
      composioTools = await getAgentToolsFromConfig(agent.tools, auth.userId);
    }

    const { responseText, toolCalls } = await runToolEnabledChat(
      model,
      messages,
      composioTools,
      auth.userId
    );
    const normalizedResponseText = responseText.trim() || "I could not generate a response.";

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
        {
          sessionId: currentSessionId,
          role: "assistant",
          content: normalizedResponseText,
          toolCalls: toolCalls.length > 0 ? JSON.stringify(toolCalls) : null,
        },
      ],
    });

    return NextResponse.json({
      response: normalizedResponseText,
      sessionId: currentSessionId,
      toolCallsExecuted: toolCalls.length,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
