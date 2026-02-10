"use client";

import { useState, useEffect, useCallback } from "react";
import type { ContainerInfo } from "@/types/container";

export function useContainers() {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContainers = useCallback(async () => {
    try {
      const res = await fetch("/api/containers");
      if (!res.ok) return;
      const data = await res.json();
      setContainers(data.containers);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContainers();
  }, [fetchContainers]);

  const launchContainer = async (agentId: string, hours: number) => {
    const res = await fetch("/api/containers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, hours }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }
    const data = await res.json();
    await fetchContainers();
    return data;
  };

  const stopContainer = async (containerId: string) => {
    const res = await fetch(`/api/containers/${containerId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }
    await fetchContainers();
  };

  const extendContainer = async (containerId: string, hours: number) => {
    const res = await fetch(`/api/containers/${containerId}/extend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }
    const data = await res.json();
    await fetchContainers();
    return data;
  };

  return {
    containers,
    loading,
    launchContainer,
    stopContainer,
    extendContainer,
    refresh: fetchContainers,
  };
}
