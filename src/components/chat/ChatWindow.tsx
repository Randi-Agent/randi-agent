"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { useChat, Chat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import type { ApprovalDecision } from "./ApprovalCard";

export interface Message {
    id: string;
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    createdAt: Date | string;
    error?: boolean;
    type?: "text" | "approval_request";
    toolCalls?: any; // For tool calls
    toolResults?: any;
    approvalRequest?: any;
    approvalDecision?: ApprovalDecision;
    parts?: any[];
}

interface ChatWindowProps {
    agentId: string;
    sessionId?: string;
    model: string;
    initialMessages?: Message[];
    onSessionCreated?: (sessionId: string) => void;
}

export function ChatWindow({
    agentId,
    sessionId,
    model,
    initialMessages = [],
    onSessionCreated,
}: ChatWindowProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [localError, setLocalError] = useState<string | null>(null);

    // Build the transport and chat object
    const chat = useMemo(() => new Chat({
        transport: new DefaultChatTransport({
            api: "/api/chat",
            body: {
                agentId,
                sessionId,
                model,
            },
        }),
    }), [agentId, sessionId, model]);

    // Initial message normalization
    const normalizedInitialMessages = useMemo(() => {
        return initialMessages.map(m => ({
            id: m.id,
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
            createdAt: m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt),
        }));
    }, [initialMessages]);

    const {
        messages,
        sendMessage,
        status,
        reload,
        error: chatError,
    } = useChat({
        chat,
        initialMessages: normalizedInitialMessages as any,
        onResponse: (response) => {
            if (response.status === 202) {
                // Potential approval gate signal
            }
        },
    });

    const isLoading = status === "streaming" || status === "submitted";

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = useCallback(async (content: string) => {
        if (!content.trim() || isLoading) return;
        setLocalError(null);

        try {
            await sendMessage({
                role: "user",
                parts: [{ type: "text", text: content }],
            });
        } catch (err) {
            console.error("SendMessage error:", err);
            setLocalError(err instanceof Error ? err.message : "Failed to send message");
        }
    }, [sendMessage, isLoading]);

    const handleApprovalDecision = useCallback(async (approvalId: string, decision: ApprovalDecision) => {
        // Resume flow logic
        if (decision === "APPROVED" || decision === "REJECTED") {
            try {
                await sendMessage({
                    role: "user",
                    parts: [{ type: "text", text: "(Resume)" }],
                }, {
                    data: { resumeApprovalId: approvalId, decision } as any
                });
            } catch (err) {
                console.error("Approval flow error:", err);
            }
        }
    }, [sendMessage]);

    return (
        <div className="flex flex-col h-full bg-card/30 rounded-xl border border-border overflow-hidden">
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
            >
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Start a conversation</h3>
                        <p className="text-muted-foreground max-w-xs">
                            Send a message to begin interacting with the agent.
                        </p>
                    </div>
                )}

                {messages.map((msg) => (
                    <MessageBubble
                        key={msg.id}
                        message={{
                            ...msg,
                            createdAt: msg.createdAt || new Date(),
                        } as any}
                        isStreaming={status === "streaming" && msg.id === messages[messages.length - 1].id && msg.role === "assistant"}
                        onApprovalDecision={handleApprovalDecision}
                    />
                ))}

                {isLoading && messages[messages.length - 1]?.role === "user" && (
                    <div className="flex justify-start">
                        <div className="bg-muted px-4 py-2 rounded-2xl rounded-bl-none">
                            <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce"></span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-border bg-card/50">
                {(chatError || localError) && (
                    <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
                        <p className="text-sm text-rose-400">{(chatError as any)?.message || localError || "An error occurred"}</p>
                        <button
                            onClick={() => reload()}
                            className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-200 px-2 py-1 rounded transition-colors whitespace-nowrap"
                        >
                            Retry
                        </button>
                    </div>
                )}
                <ChatInput
                    onSend={handleSendMessage}
                    disabled={isLoading}
                />
            </div>
        </div>
    );
}
