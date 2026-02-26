"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { RandiLogo } from "@/components/branding/RandiLogo";

interface Agent {
    id: string;
    slug: string;
    name: string;
    description: string;
    defaultModel: string;
}

interface ChatSession {
    id: string;
    title: string;
    agentId: string;
    agent: {
        name: string;
    };
    createdAt: string;
}

export default function ChatHubPage() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeTab, setActiveTab] = useState<"new" | "recent">("new");
    useEffect(() => {
        // Fetch agents
        fetch("/api/agents")
            .then((res) => res.json())
            .then((data) => setAgents(data.agents || []))
            .catch((err) => console.error("Error fetching agents:", err));

        // Fetch recent sessions
        fetch("/api/chat/sessions")
            .then((res) => res.json())
            .then((data) => setSessions(data.sessions || []))
            .catch((err) => console.error("Error fetching sessions:", err));
    }, []);

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold mb-2">AI Chat Hub</h1>
                    <p className="text-muted-foreground">Select an agent or continue a previous conversation.</p>
                </div>
            </div>

            <div className="flex gap-2 mb-8 bg-card/50 p-1 rounded-lg w-fit border border-border">
                <button
                    onClick={() => setActiveTab("new")}
                    className={`px-4 py-2 rounded-md text-sm transition-all ${activeTab === "new" ? "bg-primary text-white shadow-lg" : "hover:bg-muted"
                        }`}
                >
                    New Chat
                </button>
                <button
                    onClick={() => setActiveTab("recent")}
                    className={`px-4 py-2 rounded-md text-sm transition-all ${activeTab === "recent" ? "bg-primary text-white shadow-lg" : "hover:bg-muted"
                        }`}
                >
                    Recent Chats ({sessions.length})
                </button>
            </div>

            {activeTab === "new" ? (
                <div className="space-y-12">
                    {/* Primary Orchestrator (Randi) */}
                    {agents.find(a => a.slug === "randi-lead") && (
                        <div className="relative overflow-hidden bg-card border border-primary/20 rounded-3xl p-8 shadow-2xl">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl animate-pulse"></div>
                            <div className="relative flex flex-col md:flex-row items-center gap-8">
                                <div className="w-32 h-32 bg-primary/10 rounded-2xl flex items-center justify-center p-4 border border-primary/20 group">
                                    <RandiLogo size="lg" variant="icon-only" animated />
                                </div>
                                <div className="flex-1 text-center md:text-left">
                                    <h2 className="text-3xl font-extrabold mb-3 tracking-tight">Meet Randi (Lead)</h2>
                                    <p className="text-lg text-muted-foreground mb-6 max-w-2xl">
                                        The primary orchestrator of the platform. Randi has access to our full library of Anthropic Skills,
                                        the agent-browser, and can delegate tasks to specialists or spawn autonomous developers.
                                    </p>
                                    <Link
                                        href={`/chat/new?agentId=${agents.find(a => a.slug === "randi-lead")?.id}`}
                                        className="inline-flex items-center px-8 py-3.5 bg-primary text-primary-foreground rounded-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/25"
                                    >
                                        Start Orchestration Chat
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Specialists Grid */}
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-px flex-1 bg-border"></div>
                            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground bg-background px-4">Specialist Agents</h3>
                            <div className="h-px flex-1 bg-border"></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {agents.filter(a => a.slug !== "randi-lead").map((agent) => (
                                <div
                                    key={agent.id}
                                    className="bg-card/50 border border-border rounded-2xl p-6 flex flex-col hover:border-primary/30 hover:bg-card transition-all group"
                                >
                                    <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
                                        <RandiLogo size="sm" variant="icon-only" />
                                    </div>
                                    <h3 className="text-lg font-bold mb-1">{agent.name}</h3>
                                    <p className="text-sm text-muted-foreground mb-4 flex-1">
                                        {agent.description}
                                    </p>
                                    <Link
                                        href={`/chat/new?agentId=${agent.id}`}
                                        className="w-full bg-muted/50 hover:bg-primary/20 text-foreground py-2 rounded-lg text-xs font-bold text-center transition-all"
                                    >
                                        Use Specialist
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {sessions.length === 0 ? (
                        <div className="bg-card/30 border border-dashed border-border rounded-xl p-12 text-center">
                            <p className="text-muted-foreground">No recent chats found.</p>
                        </div>
                    ) : (
                        sessions.map((session) => (
                            <Link
                                key={session.id}
                                href={`/chat/${session.id}`}
                                className="block bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-all border-l-4 border-l-primary/50"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-semibold text-lg">{session.title}</h4>
                                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary/40"></span>
                                            Agent: {session.agent.name}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(session.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
