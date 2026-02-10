"use client";

import type { AgentCatalogItem } from "@/types/agent";

interface AgentCardProps {
  agent: AgentCatalogItem;
  onLaunch: (agent: AgentCatalogItem) => void;
}

export function AgentCard({ agent, onLaunch }: AgentCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">{agent.name}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {agent.description}
          </p>
        </div>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
          {agent.creditsPerHour} credits/hr
        </span>
      </div>
      <div className="mt-auto pt-4">
        <button
          onClick={() => onLaunch(agent)}
          className="w-full px-4 py-2 bg-primary hover:bg-accent text-primary-foreground rounded-lg font-medium transition-colors"
        >
          Launch
        </button>
      </div>
    </div>
  );
}
