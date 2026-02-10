"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/WalletContext";
import { useCredits } from "@/hooks/useCredits";
import { useContainers } from "@/hooks/useContainers";
import { ContainerCard } from "@/components/containers/ContainerCard";

export default function DashboardPage() {
  const { user } = useAuth();
  const { balance } = useCredits();
  const { containers, stopContainer } = useContainers();

  const activeContainers = containers.filter((c) => c.status === "RUNNING");

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm text-muted-foreground">Credit Balance</p>
          <p className="text-2xl font-bold mt-1">{balance.toLocaleString()}</p>
          <Link href="/credits" className="text-sm text-primary mt-2 inline-block">
            Buy more
          </Link>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm text-muted-foreground">Active Containers</p>
          <p className="text-2xl font-bold mt-1">{activeContainers.length}</p>
          <Link href="/containers" className="text-sm text-primary mt-2 inline-block">
            View all
          </Link>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm text-muted-foreground">Wallet</p>
          <p className="text-sm font-mono mt-1 truncate">
            {user?.walletAddress || "Not connected"}
          </p>
          {!user?.username && (
            <p className="text-xs text-warning mt-2">Set a username to launch agents</p>
          )}
        </div>
      </div>

      {!user?.username && (
        <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 mb-8">
          <p className="text-sm font-medium text-warning">
            Set a username to get started
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Your username is used in container URLs (e.g., username-agent.domain.com)
          </p>
          <UsernameForm />
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Active Containers</h2>
          <Link
            href="/agents"
            className="text-sm text-primary hover:text-accent"
          >
            Launch new
          </Link>
        </div>
        {activeContainers.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <p className="text-muted-foreground mb-4">No active containers</p>
            <Link
              href="/agents"
              className="px-4 py-2 bg-primary hover:bg-accent text-primary-foreground rounded-lg text-sm font-medium transition-colors"
            >
              Launch an Agent
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {activeContainers.map((container) => (
              <ContainerCard
                key={container.id}
                container={container}
                onStop={stopContainer}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UsernameForm() {
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mt-3">
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
        placeholder="your-username"
        className="flex-1 px-3 py-1.5 bg-input border border-border rounded-lg text-sm"
        minLength={3}
        maxLength={20}
      />
      <button
        type="submit"
        disabled={saving || username.length < 3}
        className="px-4 py-1.5 bg-primary hover:bg-accent text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
