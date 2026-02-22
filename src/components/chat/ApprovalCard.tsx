"use client";

import { useState, useCallback } from "react";

export interface ApprovalRequest {
    approvalId: string;
    toolName: string;
    toolArgs: string;           // raw JSON string
    description: string;        // human-readable action summary
    sessionId: string;
}

export type ApprovalDecision = "APPROVED" | "REJECTED" | "PENDING";

interface ApprovalCardProps {
    request: ApprovalRequest;
    onDecision: (approvalId: string, decision: "APPROVED" | "REJECTED") => void;
    decided?: ApprovalDecision;
}

/** Safely pretty-print JSON args, falling back to the raw string */
function formatArgs(raw: string): { entries: [string, string][]; raw: string } {
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
            const entries = Object.entries(parsed as Record<string, unknown>).map(
                ([k, v]): [string, string] => [
                    k,
                    typeof v === "string" ? v : JSON.stringify(v),
                ]
            );
            return { entries, raw };
        }
    } catch {
        // ignore
    }
    return { entries: [], raw };
}

/** Extract the service name from a COMPOSIO tool slug */
function serviceFromToolName(toolName: string): string {
    const service = toolName.split("_")[0];
    const map: Record<string, string> = {
        GMAIL: "Gmail",
        GITHUB: "GitHub",
        GITLAB: "GitLab",
        SLACK: "Slack",
        DISCORD: "Discord",
        NOTION: "Notion",
        GOOGLESHEETS: "Google Sheets",
        GOOGLECALENDAR: "Google Calendar",
        GOOGLEDOCS: "Google Docs",
        GOOGLEDRIVE: "Google Drive",
        VERCEL: "Vercel",
        SUPABASE: "Supabase",
        AIRTABLE: "Airtable",
        JIRA: "Jira",
        LINEAR: "Linear",
        HUBSPOT: "HubSpot",
        SALESFORCE: "Salesforce",
        TWILIO: "Twilio",
        STRIPE: "Stripe",
        TRELLO: "Trello",
        ASANA: "Asana",
        CLICKUP: "ClickUp",
        ZAPIER: "Zapier",
        MAKE: "Make",
        PIPEDRIVE: "Pipedrive",
    };
    return map[service] ?? service;
}

const SERVICE_ICONS: Record<string, string> = {
    Gmail: "📧",
    GitHub: "🐙",
    GitLab: "🦊",
    Slack: "💬",
    Discord: "🎮",
    Notion: "📒",
    "Google Sheets": "📊",
    "Google Calendar": "📅",
    "Google Docs": "📝",
    "Google Drive": "💾",
    Vercel: "▲",
    Supabase: "⚡",
    Airtable: "🗃️",
    Jira: "🔵",
    Linear: "🔷",
    HubSpot: "🧲",
    Salesforce: "☁️",
    Twilio: "📱",
    Stripe: "💳",
    Trello: "📋",
    Asana: "✅",
    ClickUp: "🎯",
    Zapier: "⚡",
    Make: "🔗",
    Pipedrive: "📊",
};

export function ApprovalCard({ request, onDecision, decided = "PENDING" }: ApprovalCardProps) {
    const [loading, setLoading] = useState(false);
    const service = serviceFromToolName(request.toolName);
    const icon = SERVICE_ICONS[service] ?? "🔧";
    const { entries, raw } = formatArgs(request.toolArgs);

    const handleDecision = useCallback(
        async (decision: "APPROVED" | "REJECTED") => {
            setLoading(true);
            try {
                await fetch("/api/chat/approve", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ approvalId: request.approvalId, decision }),
                });
                onDecision(request.approvalId, decision);
            } catch {
                // allow parent to handle or user can retry
            } finally {
                setLoading(false);
            }
        },
        [request.approvalId, onDecision]
    );

    const isDone = decided !== "PENDING";

    return (
        <div className="my-1 max-w-[85%] lg:max-w-[72%]">
            <div
                className={`rounded-2xl rounded-bl-none border overflow-hidden transition-all ${decided === "APPROVED"
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : decided === "REJECTED"
                            ? "border-rose-500/30 bg-rose-500/5"
                            : "border-amber-500/40 bg-amber-500/5"
                    }`}
            >
                {/* Header */}
                <div
                    className={`px-4 py-3 flex items-start gap-3 border-b ${decided === "APPROVED"
                            ? "border-emerald-500/20"
                            : decided === "REJECTED"
                                ? "border-rose-500/20"
                                : "border-amber-500/20"
                        }`}
                >
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-xl flex-shrink-0">
                        {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold">Permission Required</span>
                            {decided === "APPROVED" && (
                                <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                                    ✓ Allowed
                                </span>
                            )}
                            {decided === "REJECTED" && (
                                <span className="text-[10px] font-medium text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded-full">
                                    ✗ Denied
                                </span>
                            )}
                            {decided === "PENDING" && (
                                <span className="text-[10px] font-medium text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full animate-pulse">
                                    Awaiting approval
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-foreground/80 mt-0.5">{request.description}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">{request.toolName}</p>
                    </div>
                </div>

                {/* Arguments table */}
                {(entries.length > 0 || raw) && (
                    <div className="px-4 py-3">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                            Arguments
                        </p>
                        {entries.length > 0 ? (
                            <div className="space-y-1.5">
                                {entries.map(([key, value]) => (
                                    <div key={key} className="flex gap-3 text-xs">
                                        <span className="text-muted-foreground font-mono min-w-[100px] flex-shrink-0">
                                            {key}
                                        </span>
                                        <span className="text-foreground/80 break-all line-clamp-3">{value}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <pre className="text-xs font-mono text-foreground/60 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                                {raw}
                            </pre>
                        )}
                    </div>
                )}

                {/* Action buttons — only shown while PENDING */}
                {!isDone && (
                    <div className="px-4 pb-4 flex gap-2">
                        <button
                            onClick={() => handleDecision("APPROVED")}
                            disabled={loading}
                            className="flex-1 px-4 py-2 text-sm font-medium rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50 disabled:cursor-wait"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Working…
                                </span>
                            ) : (
                                "✅ Allow"
                            )}
                        </button>
                        <button
                            onClick={() => handleDecision("REJECTED")}
                            disabled={loading}
                            className="flex-1 px-4 py-2 text-sm font-medium rounded-xl border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50 disabled:cursor-wait"
                        >
                            ❌ Deny
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
