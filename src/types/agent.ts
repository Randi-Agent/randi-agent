export interface Agent {
  id: string;
  slug: string;
  name: string;
  description: string;
  image: string;
  internalPort: number;
  creditsPerHour: number;
  memoryLimit: bigint;
  cpuLimit: bigint;
  pidLimit: number;
  active: boolean;
}

export interface AgentCatalogItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  creditsPerHour: number;
  active: boolean;
}
