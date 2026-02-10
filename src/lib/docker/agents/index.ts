import { agentZeroConfig } from "./agent-zero";
import { openClawConfig } from "./openclaw";

export interface AgentContainerConfig {
  image: string;
  internalPort: number;
  env: Record<string, string>;
  volumes: Record<string, string>;
  memoryLimit: number;
  cpuLimit: number;
  pidLimit: number;
  command?: string[];
}

export type AgentConfigFactory = (opts: {
  subdomain: string;
  password: string;
  domain: string;
}) => AgentContainerConfig;

const agentRegistry: Record<string, AgentConfigFactory> = {
  "agent-zero": agentZeroConfig,
  openclaw: openClawConfig,
};

export function getAgentConfig(slug: string): AgentConfigFactory | undefined {
  return agentRegistry[slug];
}

export function listAgentSlugs(): string[] {
  return Object.keys(agentRegistry);
}
